# Calculadora Robusta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a dependência única do Rotas Brasil por uma cadeia de provedores (HERE → TomTom → Rotas Brasil → Haversine) com interface abstrata, cache unificado e UI de validação por praça de pedágio.

**Architecture:** Uma interface `RoutingProvider` define o contrato de qualquer provedor. Uma cadeia (`chain.ts`) tenta provedores em ordem, cai para o próximo se km=0 ou pedagio=0, e armazena o resultado no cache unificado com `fonte`, `confianca` e `pracas`. A UI mostra qual provedor foi usado e permite correção manual por praça.

**Tech Stack:** TypeScript · Next.js App Router · Prisma · HERE Routing API v8 · TomTom Routing API · Google Geocoding API (fallback de geocodificação) · `npx tsx` para scripts

---

## Mapa de Arquivos

### Phase 1 — Core Routing Abstraction

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Create | `types/routing.ts` | Interfaces compartilhadas: RotaResult, RoutingProvider, ProviderFonte, PracaResult |
| Modify | `types/frete.ts` | Adiciona `fonte`, `confianca`, `pracas` a `LinhaFrete` |
| Modify | `lib/google-maps.ts` | Exporta `COORDS` e `normalizarChave` (antes privados) |
| Create | `lib/routing/geocode.ts` | Converte nome de cidade → `{lat, lng}` via COORDS ou Google Geocoding |
| Create | `lib/routing/haversine.ts` | `HaversineProvider` — adapter dos fallbacks já existentes |
| Create | `lib/routing/rotas-brasil.ts` | `RotasBrasilProvider` — adapter de `lib/rotas-brasil.ts` |
| Create | `lib/routing/here.ts` | `HereProvider` — HERE Routing API v8 |
| Create | `lib/routing/tomtom.ts` | `TomTomProvider` — TomTom Routing API |
| Create | `lib/routing/chain.ts` | Cadeia com fallback + cache unificado |
| Modify | `lib/route-cache.ts` | Adiciona `pracas` e `confianca` a `CacheEntry` |
| Modify | `app/api/calcular/route.ts` | Substitui `calcularRota` de `lib/rotas-brasil` por `calcularRotaComChain` |
| Create | `scripts/testar-provedores.ts` | Comparação lado a lado de provedores para um CSV de rotas |

### Phase 2 — Banco de Praças (longo prazo)

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Modify | `prisma/schema.prisma` | Adiciona `PracaPedagio`, `TarifaPraca`, `CorrecaoPedagio` |
| Create | `scripts/importar-pracas.ts` | Lê CSV de praças e faz upsert no banco |
| Create | `lib/routing/banco-proprio.ts` | `BancoProprioProvider` — matching geográfico via polyline |

### Phase 3 — UI de Validação

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Modify | `app/(protected)/page.tsx` | Badge de fonte, indicador de confiança, painel de praças expandível |
| Create | `lib/actions/correcao.ts` | Server Action que salva `CorrecaoPedagio` |

---

## Phase 1 — Core Routing Abstraction

---

### Task 1: Definir tipos compartilhados

**Files:**
- Create: `types/routing.ts`
- Modify: `types/frete.ts`

- [ ] **Step 1.1: Criar `types/routing.ts`**

```typescript
export type ProviderFonte =
  | 'here'
  | 'tomtom'
  | 'rotas-brasil'
  | 'banco-proprio'
  | 'estimativa'

export interface PracaResult {
  nome: string
  valor: number
  rodovia?: string
}

export interface RotaResult {
  km: number
  pedagio: number
  pracas?: PracaResult[]
  fonte: ProviderFonte
  confianca: 'alta' | 'media' | 'baixa'
}

export interface RoutingProvider {
  nome: ProviderFonte
  calcularRota(origem: string, destino: string, eixos: number): Promise<RotaResult>
}
```

- [ ] **Step 1.2: Adicionar campos a `LinhaFrete` em `types/frete.ts`**

Adicionar os imports e campos ao final da interface `LinhaFrete` (antes do campo `variacaoCompleta`):

```typescript
// No topo do arquivo, adicionar:
import { ProviderFonte, PracaResult } from './routing'

// Dentro de LinhaFrete, adicionar após `erro?`:
fonte?: ProviderFonte
confianca?: 'alta' | 'media' | 'baixa'
pracas?: PracaResult[]
```

- [ ] **Step 1.3: Commit**

```bash
git add types/routing.ts types/frete.ts
git commit -m "feat: add RoutingProvider types and extend LinhaFrete"
```

---

### Task 2: Exportar helpers de geocodificação e criar geocode.ts

**Files:**
- Modify: `lib/google-maps.ts`
- Create: `lib/routing/geocode.ts`

- [ ] **Step 2.1: Exportar `COORDS` e `normalizarChave` em `lib/google-maps.ts`**

Alterar as duas declarações de `const`/`function` de privadas para exportadas:

```typescript
// Linha atual:
const COORDS: Record<string, [number, number]> = {
// Mudar para:
export const COORDS: Record<string, [number, number]> = {

// Linha atual:
function normalizarChave(cidade: string): string {
// Mudar para:
export function normalizarChave(cidade: string): string {
```

- [ ] **Step 2.2: Criar `lib/routing/geocode.ts`**

```typescript
import { COORDS, normalizarChave } from '../google-maps'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

export async function geocodeCidade(
  cidade: string
): Promise<{ lat: number; lng: number } | null> {
  const key = normalizarChave(cidade)
  const coords = COORDS[key]
  if (coords) return { lat: coords[0], lng: coords[1] }

  if (!GOOGLE_MAPS_API_KEY) return null

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(cidade + ', Brasil')}` +
      `&key=${GOOGLE_MAPS_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[0]) return null
    const loc = data.results[0].geometry.location
    return { lat: loc.lat, lng: loc.lng }
  } catch {
    return null
  }
}
```

- [ ] **Step 2.3: Commit**

```bash
git add lib/google-maps.ts lib/routing/geocode.ts
git commit -m "feat: export geocoding helpers and create geocode.ts"
```

---

### Task 3: Criar HaversineProvider

**Files:**
- Create: `lib/routing/haversine.ts`

- [ ] **Step 3.1: Criar `lib/routing/haversine.ts`**

```typescript
import { RoutingProvider, RotaResult } from '@/types/routing'
import { calcularKM } from '../google-maps'
import { getPedagio } from '../pedagio'

export class HaversineProvider implements RoutingProvider {
  nome = 'estimativa' as const

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    const km = await calcularKM(origem, destino)
    const pedagio = getPedagio(origem, destino, km, eixos)
    return { km, pedagio, fonte: 'estimativa', confianca: 'baixa' }
  }
}
```

> Nota: `calcularKM` usa Google Maps Distance Matrix se `GOOGLE_MAPS_API_KEY` estiver configurada, caso contrário usa Haversine. O `fonte` permanece `'estimativa'` independentemente — o que importa é que o pedágio é estimado.

- [ ] **Step 3.2: Commit**

```bash
git add lib/routing/haversine.ts
git commit -m "feat: add HaversineProvider adapter"
```

---

### Task 4: Criar RotasBrasilProvider (adapter)

**Files:**
- Create: `lib/routing/rotas-brasil.ts`

- [ ] **Step 4.1: Criar `lib/routing/rotas-brasil.ts`**

```typescript
import { RoutingProvider, RotaResult } from '@/types/routing'
import { calcularRota as calcularRotaRB } from '../rotas-brasil'

export class RotasBrasilProvider implements RoutingProvider {
  nome = 'rotas-brasil' as const

  isActive(): boolean {
    return !!process.env.ROTAS_BRASIL_TOKEN
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    const result = await calcularRotaRB(origem, destino, eixos)
    return {
      km: result.km,
      pedagio: result.pedagio,
      fonte: 'rotas-brasil',
      confianca: 'media',
    }
  }
}
```

> Nota: `calcularRota` de `lib/rotas-brasil.ts` já lida com cache interno e retries. O adapter apenas adapta o formato de resposta.

- [ ] **Step 4.2: Commit**

```bash
git add lib/routing/rotas-brasil.ts
git commit -m "feat: add RotasBrasilProvider adapter"
```

---

### Task 5: Criar HereProvider

**Files:**
- Create: `lib/routing/here.ts`

- [ ] **Step 5.1: Criar `lib/routing/here.ts`**

```typescript
import { RoutingProvider, RotaResult, PracaResult } from '@/types/routing'
import { geocodeCidade } from './geocode'

const HERE_API_KEY = process.env.HERE_API_KEY ?? ''

export class HereProvider implements RoutingProvider {
  nome = 'here' as const

  isActive(): boolean {
    return !!HERE_API_KEY
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    if (!HERE_API_KEY) throw new Error('HERE_API_KEY não configurada')

    const [orig, dest] = await Promise.all([
      geocodeCidade(origem),
      geocodeCidade(destino),
    ])
    if (!orig || !dest) throw new Error(`Cidade não encontrada: ${!orig ? origem : destino}`)

    const params = new URLSearchParams({
      transportMode: 'truck',
      origin: `${orig.lat},${orig.lng}`,
      destination: `${dest.lat},${dest.lng}`,
      'return': 'summary,tolls',
      'vehicle[axleCount]': String(eixos),
      apikey: HERE_API_KEY,
    })

    const res = await fetch(`https://router.hereapi.com/v8/routes?${params}`)
    if (!res.ok) throw new Error(`HERE API HTTP ${res.status}`)

    const data = await res.json()
    // Verificar a estrutura exata da resposta consultando:
    // https://www.here.com/docs/bundle/routing-api-v8-api-reference/page/index.html
    const sections: HereSection[] = data.routes?.[0]?.sections ?? []

    let totalMeters = 0
    const pracas: PracaResult[] = []

    for (const section of sections) {
      totalMeters += section.summary?.length ?? 0
      for (const toll of section.tolls ?? []) {
        const valor = toll.tollFare?.price ?? toll.fare?.summary?.totalAmount ?? 0
        if (valor > 0) {
          pracas.push({
            nome: toll.tollPlaza?.name ?? 'Praça sem nome',
            valor,
            rodovia: toll.tollPlaza?.id,
          })
        }
      }
    }

    const km = Math.round(totalMeters / 1000)
    const pedagio = Math.round(pracas.reduce((sum, p) => sum + p.valor, 0) * 100) / 100

    return {
      km,
      pedagio,
      pracas: pracas.length > 0 ? pracas : undefined,
      fonte: 'here',
      confianca: 'media',
    }
  }
}

// Tipos locais para o response da HERE API
interface HereSection {
  summary?: { length: number }
  tolls?: Array<{
    tollPlaza?: { id?: string; name?: string }
    tollFare?: { price?: number; currency?: string }
    fare?: { summary?: { totalAmount?: number } }
  }>
}
```

> **Atenção na implementação:** A estrutura exata da resposta da HERE API deve ser verificada na documentação oficial antes de fazer deploy. Se a resposta retornar `pedagio === 0` mesmo para rotas com pedágio, adicionar logs do `data` bruto para depurar: `console.log('[HERE]', JSON.stringify(data.routes?.[0]?.sections?.[0]?.tolls?.slice(0,2)))`

- [ ] **Step 5.2: Adicionar `HERE_API_KEY` ao `.env.local`**

```bash
# Obter chave gratuita em https://developer.here.com → My Projects → Create Project → API Keys
# Adicionar ao .env.local:
HERE_API_KEY=sua_chave_aqui
```

- [ ] **Step 5.3: Commit**

```bash
git add lib/routing/here.ts
git commit -m "feat: add HereProvider (HERE Routing API v8)"
```

---

### Task 6: Criar TomTomProvider

**Files:**
- Create: `lib/routing/tomtom.ts`

- [ ] **Step 6.1: Criar `lib/routing/tomtom.ts`**

```typescript
import { RoutingProvider, RotaResult } from '@/types/routing'
import { geocodeCidade } from './geocode'

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY ?? ''

export class TomTomProvider implements RoutingProvider {
  nome = 'tomtom' as const

  isActive(): boolean {
    return !!TOMTOM_API_KEY
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    if (!TOMTOM_API_KEY) throw new Error('TOMTOM_API_KEY não configurada')

    const [orig, dest] = await Promise.all([
      geocodeCidade(origem),
      geocodeCidade(destino),
    ])
    if (!orig || !dest) throw new Error(`Cidade não encontrada: ${!orig ? origem : destino}`)

    const url =
      `https://api.tomtom.com/routing/1/calculateRoute/` +
      `${orig.lat},${orig.lng}:${dest.lat},${dest.lng}/json` +
      `?vehicleCommercial=true` +
      `&vehicleAxles=${eixos}` +
      `&routeType=fastest` +
      `&traffic=false` +
      `&key=${TOMTOM_API_KEY}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`TomTom API HTTP ${res.status}`)

    const data = await res.json()
    // Verificar campos exatos na documentação:
    // https://developer.tomtom.com/routing-api/documentation/routing/calculate-route
    const summary = data.routes?.[0]?.summary

    const km = Math.round((summary?.lengthInMeters ?? 0) / 1000)
    // TomTom pode retornar toll cost em summary.tollCost ou summary.tollCosts
    // Verificar na resposta real — logar data.routes[0].summary para depurar
    const pedagio = Math.round(
      (summary?.tollCost?.amount ?? summary?.totalCost?.toll ?? 0) * 100
    ) / 100

    return {
      km,
      pedagio,
      // TomTom API padrão não retorna breakdown por praça — pracas fica undefined
      fonte: 'tomtom',
      confianca: 'media',
    }
  }
}
```

> **Atenção na implementação:** Os campos `tollCost.amount` e `totalCost.toll` são estimativas baseadas na documentação. Ao testar, logar `data.routes[0].summary` completo para encontrar o campo correto.

- [ ] **Step 6.2: Adicionar `TOMTOM_API_KEY` ao `.env.local`**

```bash
# Obter chave gratuita em https://developer.tomtom.com → My Account → Keys
# Adicionar ao .env.local:
TOMTOM_API_KEY=sua_chave_aqui
```

- [ ] **Step 6.3: Commit**

```bash
git add lib/routing/tomtom.ts
git commit -m "feat: add TomTomProvider (TomTom Routing API)"
```

---

### Task 7: Criar provider chain

**Files:**
- Create: `lib/routing/chain.ts`

- [ ] **Step 7.1: Criar `lib/routing/chain.ts`**

```typescript
import { RotaResult } from '@/types/routing'
import { HereProvider } from './here'
import { TomTomProvider } from './tomtom'
import { RotasBrasilProvider } from './rotas-brasil'
import { HaversineProvider } from './haversine'
import { getCached, setCached } from '../route-cache'

const HERE = new HereProvider()
const TOMTOM = new TomTomProvider()
const ROTAS_BRASIL = new RotasBrasilProvider()
const HAVERSINE = new HaversineProvider()

const ALL_PROVIDERS = { here: HERE, tomtom: TOMTOM, 'rotas-brasil': ROTAS_BRASIL, estimativa: HAVERSINE }

const DEFAULT_ORDER = ['here', 'tomtom', 'rotas-brasil', 'estimativa'] as const

function getOrder(): string[] {
  const env = process.env.ROUTING_PROVIDER_ORDER
  if (!env) return [...DEFAULT_ORDER]
  return env.split(',').map(s => s.trim()).filter(s => s in ALL_PROVIDERS)
}

export async function calcularRotaComChain(
  origem: string,
  destino: string,
  eixos: number
): Promise<RotaResult> {
  // Cache check — skip entries without pedagio
  const cached = getCached(origem, destino, eixos)
  if (cached && cached.pedagio > 0) {
    return {
      km: cached.km,
      pedagio: cached.pedagio,
      pracas: cached.pracas,
      fonte: (cached.fonte as RotaResult['fonte']) ?? 'estimativa',
      confianca: (cached.confianca as RotaResult['confianca']) ?? 'media',
    }
  }

  const order = getOrder()

  for (const name of order) {
    const provider = ALL_PROVIDERS[name as keyof typeof ALL_PROVIDERS]
    if (!provider) continue

    // Skip providers that need env vars that aren't set
    if ('isActive' in provider && !(provider as { isActive(): boolean }).isActive()) {
      continue
    }

    try {
      const result = await provider.calcularRota(origem, destino, eixos)

      if (result.km <= 0) {
        console.warn(`[chain] ${name} retornou km=0, tentando próximo`)
        continue
      }

      if (result.pedagio <= 0 && name !== 'estimativa') {
        console.warn(`[chain] ${name} retornou pedagio=0, tentando próximo`)
        continue
      }

      setCached(origem, destino, eixos, {
        km: result.km,
        pedagio: result.pedagio,
        pracas: result.pracas,
        fonte: result.fonte,
        confianca: result.confianca,
      })

      return result
    } catch (err) {
      console.warn(`[chain] ${name} falhou:`, err instanceof Error ? err.message : err)
    }
  }

  // Fallback de último recurso — nunca deve chegar aqui se HaversineProvider está na cadeia
  return { km: 500, pedagio: 0, fonte: 'estimativa', confianca: 'baixa' }
}
```

- [ ] **Step 7.2: Commit**

```bash
git add lib/routing/chain.ts
git commit -m "feat: add provider chain with fallback logic"
```

---

### Task 8: Atualizar lib/route-cache.ts

**Files:**
- Modify: `lib/route-cache.ts`

- [ ] **Step 8.1: Adicionar `pracas` e `confianca` à interface `CacheEntry`**

Substituir a interface `CacheEntry` e a função `setCached` em `lib/route-cache.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PracaResult } from '@/types/routing'

const CACHE_FILE = join(process.cwd(), '.route-cache.json')
const TTL_MS = 30 * 24 * 60 * 60 * 1000

interface CacheEntry {
  km: number
  pedagio: number
  pracas?: PracaResult[]
  fonte: string
  confianca: string
  cachedAt: number
}

// Map em memória — populado do arquivo na primeira chamada
let mem: Map<string, CacheEntry> | null = null

function getMap(): Map<string, CacheEntry> {
  if (mem) return mem
  try {
    const raw = existsSync(CACHE_FILE)
      ? JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
      : {}
    mem = new Map(Object.entries(raw))
  } catch {
    mem = new Map()
  }
  return mem
}

function persist() {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(getMap())))
  } catch {}
}

function chave(origem: string, destino: string, eixos: number): string {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  return `${norm(origem)}|${norm(destino)}|${eixos}`
}

export function getCached(
  origem: string,
  destino: string,
  eixos: number
): CacheEntry | null {
  const entry = getMap().get(chave(origem, destino, eixos))
  if (!entry) return null
  if (Date.now() - entry.cachedAt > TTL_MS) {
    getMap().delete(chave(origem, destino, eixos))
    return null
  }
  return entry
}

export function setCached(
  origem: string,
  destino: string,
  eixos: number,
  data: Omit<CacheEntry, 'cachedAt'>
) {
  getMap().set(chave(origem, destino, eixos), { ...data, cachedAt: Date.now() })
  persist()
}
```

> Nota: `CacheEntry` agora exporta `pracas` e `confianca`. Entradas antigas no `.route-cache.json` sem esses campos continuam funcionando — serão lidas com `pracas: undefined` e `confianca: undefined`, e a chain trata isso com `?? 'media'`.

- [ ] **Step 8.2: Commit**

```bash
git add lib/route-cache.ts
git commit -m "feat: extend cache entry with pracas and confianca fields"
```

---

### Task 9: Atualizar app/api/calcular/route.ts

**Files:**
- Modify: `app/api/calcular/route.ts`

- [ ] **Step 9.1: Substituir chamada direta ao Rotas Brasil pela chain**

Substituir o conteúdo completo de `app/api/calcular/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { calcularRotaComChain } from '@/lib/routing/chain'
import { calcularANTT, EIXOS_LISTA } from '@/lib/antt'
import { LinhaFrete, LinhaVariacao } from '@/types/frete'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function processarLinha(linha: LinhaFrete): Promise<LinhaFrete> {
  try {
    const { km, pedagio, fonte, confianca, pracas } = await calcularRotaComChain(
      linha.origem,
      linha.destino,
      6  // referência eixo=6, mesmo comportamento de antes
    )

    const antt = calcularANTT(km, {
      eixos: linha.eixos,
      tipoCarga: linha.tipoCarga,
      retornoVazio: linha.retornoVazio,
      composicaoVeicular: linha.composicaoVeicular,
    })
    const freteTotal = Math.round((pedagio + antt) * 100) / 100

    const variacaoCompleta: LinhaVariacao[] = []
    for (const e of EIXOS_LISTA) {
      for (const composicaoVeicular of [false, true]) {
        for (const altoDesempenho of [false, true]) {
          const anttVar = calcularANTT(km, {
            eixos: e,
            tipoCarga: linha.tipoCarga,
            retornoVazio: linha.retornoVazio,
            composicaoVeicular,
            altoDesempenho,
          })
          variacaoCompleta.push({
            eixos: e,
            composicaoVeicular,
            altoDesempenho,
            km,
            pedagio,
            antt: anttVar,
            freteTotal: Math.round((pedagio + anttVar) * 100) / 100,
          })
        }
      }
    }

    return {
      ...linha,
      km,
      pedagio,
      antt,
      freteTotal,
      variacaoCompleta,
      fonte,
      confianca,
      pracas,
      status: 'ok',
    }
  } catch (err) {
    return {
      ...linha,
      status: 'erro',
      erro: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

export async function POST(req: NextRequest) {
  const linhas: LinhaFrete[] = await req.json()
  const resultados: LinhaFrete[] = []

  for (let i = 0; i < linhas.length; i++) {
    resultados.push(await processarLinha(linhas[i]))
    if (i < linhas.length - 1) await delay(1000)
  }

  return NextResponse.json(resultados)
}
```

- [ ] **Step 9.2: Commit**

```bash
git add app/api/calcular/route.ts
git commit -m "feat: use routing chain in calcular API route"
```

---

### Task 10: Verificar Phase 1 com dev server

**Files:** nenhum arquivo novo

- [ ] **Step 10.1: Configurar provedores no `.env.local`**

Adicionar ao `.env.local` (não commitar este arquivo):

```bash
# Provedor HERE (250k req/mês grátis — https://developer.here.com)
HERE_API_KEY=sua_chave_aqui

# Provedor TomTom (2.5k req/dia grátis — https://developer.tomtom.com)
TOMTOM_API_KEY=sua_chave_aqui

# Ordem de prioridade (opcional — padrão: here,tomtom,rotas-brasil,estimativa)
# ROUTING_PROVIDER_ORDER=here,tomtom,rotas-brasil,estimativa
```

- [ ] **Step 10.2: Iniciar dev server e testar**

```bash
npm run dev
```

- [ ] **Step 10.3: Fazer um cálculo de teste**

1. Abrir `http://localhost:3000`
2. Importar um Excel com 2–3 rotas conhecidas (ex: São Paulo, SP → Curitiba, PR com 6 eixos)
3. Clicar em "Calcular"
4. Verificar no terminal os logs `[chain]` mostrando qual provedor foi usado
5. Verificar que o resultado retorna `km` e `pedagio` > 0

- [ ] **Step 10.4: Verificar fallback**

Remover temporariamente `HERE_API_KEY` do `.env.local` (ou deixar inválida), reiniciar o servidor e recalcular. Os logs devem mostrar `[chain] here falhou` e usar o próximo provedor.

Restaurar a chave ao finalizar.

---

### Task 11: Criar script de comparação de provedores

**Files:**
- Create: `scripts/testar-provedores.ts`

- [ ] **Step 11.1: Criar `scripts/testar-provedores.ts`**

```typescript
// Execução: npx tsx scripts/testar-provedores.ts scripts/rotas-teste.csv
// Formato do CSV: origem,destino,eixos
// Exemplo: "São Paulo, SP","Curitiba, PR",6

import { readFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { HereProvider } from '../lib/routing/here'
import { TomTomProvider } from '../lib/routing/tomtom'
import { RotasBrasilProvider } from '../lib/routing/rotas-brasil'
import { HaversineProvider } from '../lib/routing/haversine'

const PROVEDORES = [
  new HereProvider(),
  new TomTomProvider(),
  new RotasBrasilProvider(),
  new HaversineProvider(),
]

interface Rota { origem: string; destino: string; eixos: number }

function parseCSV(path: string): Rota[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .slice(1) // pula cabeçalho
    .filter(l => l.trim())
    .map(l => {
      const parts = l.match(/(".*?"|[^,]+)/g) ?? []
      const clean = (s: string) => s.replace(/^"|"$/g, '').trim()
      return {
        origem: clean(parts[0] ?? ''),
        destino: clean(parts[1] ?? ''),
        eixos: parseInt(clean(parts[2] ?? '6'), 10),
      }
    })
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Uso: npx tsx scripts/testar-provedores.ts <arquivo.csv>')
    process.exit(1)
  }

  const rotas = parseCSV(csvPath)
  console.log(`\nTestando ${rotas.length} rotas em ${PROVEDORES.length} provedores...\n`)

  for (const rota of rotas) {
    console.log(`\n── ${rota.origem} → ${rota.destino} (${rota.eixos} eixos) ──`)
    const resultados = await Promise.allSettled(
      PROVEDORES.map(p => p.calcularRota(rota.origem, rota.destino, rota.eixos))
    )
    for (let i = 0; i < PROVEDORES.length; i++) {
      const r = resultados[i]
      const nome = PROVEDORES[i].nome.padEnd(15)
      if (r.status === 'fulfilled') {
        const { km, pedagio, confianca } = r.value
        console.log(`  ${nome} km=${String(km).padStart(5)}  pedagio=R$${pedagio.toFixed(2).padStart(8)}  [${confianca}]`)
      } else {
        console.log(`  ${nome} FALHOU: ${r.reason?.message ?? r.reason}`)
      }
    }
  }

  console.log('\nConcluído. Compare os valores de pedagio com extratos reais (tag/nota fiscal).')
}

main().catch(console.error)
```

- [ ] **Step 11.2: Criar arquivo de rotas de teste**

Criar `scripts/rotas-teste.csv`:

```csv
origem,destino,eixos
"São Paulo, SP","Curitiba, PR",6
"São Paulo, SP","Porto Alegre, RS",6
"Florianópolis, SC","São Paulo, SP",6
"Joinville, SC","Rio de Janeiro, RJ",6
"Curitiba, PR","Blumenau, SC",6
```

Adicionar as rotas que seus clientes fazem com frequência e cujos pedágios você conhece do extrato de tag.

- [ ] **Step 11.3: Executar o script**

```bash
npx tsx scripts/testar-provedores.ts scripts/rotas-teste.csv
```

Saída esperada:
```
── São Paulo, SP → Curitiba, PR (6 eixos) ──
  here            km=  842  pedagio=R$  187.40  [media]
  tomtom          km=  838  pedagio=R$  185.20  [media]
  rotas-brasil    km=  840  pedagio=R$  189.30  [media]
  estimativa      km=  847  pedagio=R$  152.00  [baixa]
```

- [ ] **Step 11.4: Decidir provedor primário**

Com base na comparação com valores reais conhecidos:
- Se HERE bateu melhor → manter `ROUTING_PROVIDER_ORDER=here,tomtom,rotas-brasil,estimativa`
- Se TomTom bateu melhor → trocar: `ROUTING_PROVIDER_ORDER=tomtom,here,rotas-brasil,estimativa`
- Se ambos erraram muito → `BancoProprioProvider` passa a ser prioridade (Phase 2)

- [ ] **Step 11.5: Commit**

```bash
git add scripts/testar-provedores.ts scripts/rotas-teste.csv
git commit -m "feat: add provider comparison script"
```

---

## Phase 2 — Banco de Praças de Pedágio

> Esta fase é independente da Phase 1 e pode ser implementada depois. Só é necessária se HERE e TomTom não fornecerem precisão suficiente para os clientes.

---

### Task 12: Adicionar modelos ao Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 12.1: Adicionar os modelos ao final de `prisma/schema.prisma`**

```prisma
model PracaPedagio {
  id             String        @id @default(cuid())
  nome           String
  rodovia        String
  concessionaria String
  uf             String
  lat            Float
  lng            Float
  sentido        String        @default("AMBOS") // "AMBOS" | "CRESCENTE" | "DECRESCENTE"
  ativa          Boolean       @default(true)
  tarifas        TarifaPraca[]

  @@map("pracas_pedagio")
}

model TarifaPraca {
  id       String       @id @default(cuid())
  pracaId  String
  praca    PracaPedagio @relation(fields: [pracaId], references: [id])
  eixos    Int
  valor    Float
  vigencia DateTime

  @@map("tarifas_praca")
}

model CorrecaoPedagio {
  id             String   @id @default(cuid())
  userId         String
  origem         String
  destino        String
  eixos          Int
  pracaId        String?
  valorOriginal  Float
  valorCorrigido Float
  createdAt      DateTime @default(now())

  @@map("correcoes_pedagio")
}
```

- [ ] **Step 12.2: Rodar migration**

```bash
npx prisma migrate dev --name add-pracas-pedagio
```

Saída esperada: `The following migration(s) have been applied: .../add-pracas-pedagio`

- [ ] **Step 12.3: Commit**

```bash
git add prisma/
git commit -m "feat: add PracaPedagio, TarifaPraca, CorrecaoPedagio to schema"
```

---

### Task 13: Criar script de importação de praças

**Files:**
- Create: `scripts/importar-pracas.ts`

- [ ] **Step 13.1: Criar `scripts/importar-pracas.ts`**

```typescript
// Execução: npx tsx scripts/importar-pracas.ts scripts/pracas.csv
// Formato do CSV:
// nome,rodovia,concessionaria,uf,lat,lng,sentido,eixos2,eixos3,eixos4,eixos5,eixos6,eixos7,eixos9
// "Praça Miracatu","BR-116","Autopista Régis Bittencourt","SP",-24.2000,-47.4700,"AMBOS",14.00,19.50,28.50,33.00,36.00,39.50,46.00

import { readFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const VIGENCIA = new Date('2026-03-20') // PORT.SUROC Nº 04/2026

interface PracaRow {
  nome: string; rodovia: string; concessionaria: string; uf: string
  lat: number; lng: number; sentido: string
  eixos: Record<number, number> // eixos → valor
}

function parseCSV(path: string): PracaRow[] {
  const EIXOS_LISTA = [2, 3, 4, 5, 6, 7, 9]
  return readFileSync(path, 'utf-8')
    .split('\n')
    .slice(1)
    .filter(l => l.trim())
    .map(l => {
      const parts = l.match(/(".*?"|[^,]+)/g)?.map(s => s.replace(/^"|"$/g, '').trim()) ?? []
      const eixos: Record<number, number> = {}
      EIXOS_LISTA.forEach((e, i) => { eixos[e] = parseFloat(parts[7 + i] ?? '0') })
      return {
        nome: parts[0], rodovia: parts[1], concessionaria: parts[2], uf: parts[3],
        lat: parseFloat(parts[4]), lng: parseFloat(parts[5]), sentido: parts[6] ?? 'AMBOS',
        eixos,
      }
    })
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) { console.error('Uso: npx tsx scripts/importar-pracas.ts <arquivo.csv>'); process.exit(1) }

  const pracas = parseCSV(csvPath)
  console.log(`Importando ${pracas.length} praças...`)

  for (const p of pracas) {
    const praca = await prisma.pracaPedagio.upsert({
      where: { id: `${p.rodovia}-${p.nome}`.toLowerCase().replace(/\s+/g, '-') },
      create: {
        id: `${p.rodovia}-${p.nome}`.toLowerCase().replace(/\s+/g, '-'),
        nome: p.nome, rodovia: p.rodovia, concessionaria: p.concessionaria,
        uf: p.uf, lat: p.lat, lng: p.lng, sentido: p.sentido,
      },
      update: { lat: p.lat, lng: p.lng, ativa: true },
    })

    for (const [eixosStr, valor] of Object.entries(p.eixos)) {
      await prisma.tarifaPraca.upsert({
        where: { id: `${praca.id}-${eixosStr}` },
        create: { id: `${praca.id}-${eixosStr}`, pracaId: praca.id, eixos: parseInt(eixosStr), valor, vigencia: VIGENCIA },
        update: { valor, vigencia: VIGENCIA },
      })
    }
    process.stdout.write('.')
  }

  console.log(`\nImportado com sucesso: ${pracas.length} praças.`)
  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
```

- [ ] **Step 13.2: Criar CSV de exemplo (Fase 1 do banco)**

Criar `scripts/pracas.csv` com as praças das principais rodovias. Fonte: ANTT e sites das concessionárias.
Formato (primeira linha é cabeçalho):

```csv
nome,rodovia,concessionaria,uf,lat,lng,sentido,eixos2,eixos3,eixos4,eixos5,eixos6,eixos7,eixos9
"Praça de Miracatu","BR-116","Autopista Régis Bittencourt","SP",-24.2020,-47.4580,"AMBOS",14.00,19.50,28.50,33.00,36.00,39.50,46.00
```

Consultar tabelas oficiais em:
- ANTT: `antt.gov.br` → Rodovias → Tarifas de Pedágio
- Autopista Régis Bittencourt (BR-116): `autopistaregisbittencourt.com.br`
- CCR NovaDutra (BR-116/SP): `novadutra.com.br`
- Arteris Planalto Sul (BR-116/SC/PR): `arteris.com.br`

- [ ] **Step 13.3: Executar importação**

```bash
npx tsx scripts/importar-pracas.ts scripts/pracas.csv
```

- [ ] **Step 13.4: Commit**

```bash
git add scripts/importar-pracas.ts scripts/pracas.csv
git commit -m "feat: add praca import script and initial CSV"
```

---

### Task 14: Criar BancoProprioProvider

**Files:**
- Create: `lib/routing/banco-proprio.ts`
- Modify: `lib/routing/chain.ts`

- [ ] **Step 14.1: Criar `lib/routing/banco-proprio.ts`**

```typescript
import { RoutingProvider, RotaResult, PracaResult } from '@/types/routing'
import { geocodeCidade } from './geocode'
import { db } from '../db'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''
const THRESHOLD_METROS = 800

function haversineMetros(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Decodifica polyline encoded do Google Maps
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let idx = 0, lat = 0, lng = 0
  while (idx < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

function distanciaMinimaPraca(
  pracaLat: number, pracaLng: number,
  pontos: [number, number][]
): number {
  let min = Infinity
  for (const [lat, lng] of pontos) {
    const d = haversineMetros(pracaLat, pracaLng, lat, lng)
    if (d < min) min = d
  }
  return min
}

export class BancoProprioProvider implements RoutingProvider {
  nome = 'banco-proprio' as const

  isActive(): boolean {
    return !!GOOGLE_MAPS_API_KEY
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    if (!GOOGLE_MAPS_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY necessária para BancoProprioProvider')

    // 1. Obter polyline da rota via Google Maps Directions
    const [orig, dest] = await Promise.all([geocodeCidade(origem), geocodeCidade(destino)])
    if (!orig || !dest) throw new Error(`Cidade não encontrada: ${!orig ? origem : destino}`)

    const directionsUrl =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${orig.lat},${orig.lng}` +
      `&destination=${dest.lat},${dest.lng}` +
      `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`

    const dirRes = await fetch(directionsUrl)
    const dirData = await dirRes.json()
    if (dirData.status !== 'OK') throw new Error(`Google Directions: ${dirData.status}`)

    const route = dirData.routes?.[0]
    if (!route) throw new Error('Sem rota disponível')

    const km = Math.round(
      route.legs.reduce((sum: number, l: { distance: { value: number } }) => sum + l.distance.value, 0) / 1000
    )

    // 2. Decodificar polyline
    const pontos = decodePolyline(route.overview_polyline.points)

    // 3. Coletar UFs do trajeto (para filtrar praças relevantes)
    const ufs = new Set<string>()
    for (const leg of route.legs) {
      for (const step of leg.steps ?? []) {
        // Aproximação: inferir UF das geocoordenadas não é trivial.
        // Buscar todas as praças ativas é simples para < 1000 registros.
      }
    }

    // 4. Buscar praças ativas no banco com suas tarifas
    const todasPracas = await db.pracaPedagio.findMany({
      where: { ativa: true },
      include: { tarifas: { where: { eixos } } },
    })

    // 5. Matching geográfico
    const pracasNaRota: PracaResult[] = []
    for (const praca of todasPracas) {
      if (!praca.tarifas[0]) continue // sem tarifa para estes eixos
      const distancia = distanciaMinimaPraca(praca.lat, praca.lng, pontos)
      if (distancia <= THRESHOLD_METROS) {
        pracasNaRota.push({
          nome: praca.nome,
          valor: praca.tarifas[0].valor,
          rodovia: praca.rodovia,
        })
      }
    }

    const pedagio = Math.round(
      pracasNaRota.reduce((sum, p) => sum + p.valor, 0) * 100
    ) / 100

    return {
      km,
      pedagio,
      pracas: pracasNaRota.length > 0 ? pracasNaRota : undefined,
      fonte: 'banco-proprio',
      confianca: 'alta',
    }
  }
}
```

- [ ] **Step 14.2: Registrar BancoProprioProvider na chain**

Em `lib/routing/chain.ts`, adicionar o import e registrar o provider:

```typescript
// Adicionar import:
import { BancoProprioProvider } from './banco-proprio'

// Adicionar instância:
const BANCO_PROPRIO = new BancoProprioProvider()

// Atualizar ALL_PROVIDERS:
const ALL_PROVIDERS = {
  here: HERE,
  tomtom: TOMTOM,
  'rotas-brasil': ROTAS_BRASIL,
  'banco-proprio': BANCO_PROPRIO,
  estimativa: HAVERSINE,
}

// Atualizar DEFAULT_ORDER para incluir banco-proprio:
const DEFAULT_ORDER = ['here', 'tomtom', 'banco-proprio', 'rotas-brasil', 'estimativa'] as const
```

- [ ] **Step 14.3: Testar BancoProprioProvider**

```bash
# Forçar uso do banco próprio:
# No .env.local: ROUTING_PROVIDER_ORDER=banco-proprio,estimativa
npm run dev
# Calcular rota que tem praças importadas no CSV
# Verificar que o resultado mostra as praças listadas
```

- [ ] **Step 14.4: Commit**

```bash
git add lib/routing/banco-proprio.ts lib/routing/chain.ts
git commit -m "feat: add BancoProprioProvider with geographic plaza matching"
```

---

## Phase 3 — UI de Validação

---

### Task 15: Adicionar badge de fonte e indicador de confiança

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 15.1: Adicionar função de label e badge**

Em `app/(protected)/page.tsx`, adicionar após a função `formatBRL`:

```typescript
type Confianca = 'alta' | 'media' | 'baixa'
type Fonte = 'here' | 'tomtom' | 'rotas-brasil' | 'banco-proprio' | 'estimativa'

function badgeConfianca(confianca?: Confianca) {
  if (!confianca) return null
  const cfg = {
    alta:  { cor: 'bg-green-500',  label: '● Alta' },
    media: { cor: 'bg-yellow-500', label: '● Média' },
    baixa: { cor: 'bg-red-500',    label: '● Baixa' },
  }[confianca]
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-white px-1.5 py-0.5 rounded ${cfg.cor}`}>
      {cfg.label}
    </span>
  )
}

function labelFonte(fonte?: Fonte): string {
  const labels: Record<Fonte, string> = {
    here: 'HERE',
    tomtom: 'TomTom',
    'rotas-brasil': 'Rotas Brasil',
    'banco-proprio': 'Banco Próprio',
    estimativa: 'Estimativa',
  }
  return fonte ? labels[fonte] : ''
}
```

- [ ] **Step 15.2: Adicionar coluna "Fonte" na tabela**

No `<thead>`, adicionar após a coluna "Pedágio":

```tsx
<th className="px-4 py-3 font-medium text-right">Pedágio</th>
<th className="px-4 py-3 font-medium">Fonte</th>  {/* NOVO */}
<th className="px-4 py-3 font-medium text-right">ANTT</th>
```

No loop de linhas, substituir a célula do Pedágio e adicionar a célula de Fonte:

```tsx
<td className="px-4 py-3 text-right text-gray-300">{formatBRL(linha.pedagio)}</td>
{/* NOVO: célula de fonte e confiança */}
<td className="px-4 py-3">
  {linha.fonte && (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{labelFonte(linha.fonte as Fonte)}</span>
      {badgeConfianca(linha.confianca as Confianca)}
    </div>
  )}
</td>
```

Atualizar também a variável `cols` para refletir a nova coluna:

```tsx
// Antes: const cols = temCliente ? 9 : 8
// Depois:
const cols = temCliente ? 10 : 9
```

- [ ] **Step 15.3: Commit**

```bash
git add app/(protected)/page.tsx
git commit -m "feat: add fonte badge and confidence indicator to results table"
```

---

### Task 16: Adicionar painel de praças no detalhe expandível

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 16.1: Substituir o bloco de detalhe expandível em `app/(protected)/page.tsx`**

Localizar o `<tr>` com `key={`${i}-detail`}` (linha ~289 do arquivo atual) e substituir o bloco inteiro:

```tsx
{aberto && linha.variacaoCompleta && (
  <tr key={`${i}-detail`} className="bg-gray-800/20">
    <td colSpan={cols} className="px-6 py-4 overflow-x-auto">

      {/* Breakdown de praças (quando disponível) */}
      {linha.pracas && linha.pracas.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 font-medium mb-2">
            Praças de pedágio ({labelFonte(linha.fonte as Fonte)})
          </p>
          <table className="text-xs border-collapse mb-2">
            <tbody>
              {linha.pracas.map((praca, pi) => (
                <tr key={pi}>
                  <td className="pr-6 py-0.5 text-gray-400">
                    {praca.nome}
                    {praca.rodovia && <span className="ml-1 text-gray-600">({praca.rodovia})</span>}
                  </td>
                  <td className="text-right text-gray-300">{formatBRL(praca.valor)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-700">
                <td className="pr-6 py-0.5 text-gray-500 font-medium">Total</td>
                <td className="text-right text-gray-300 font-medium">{formatBRL(linha.pedagio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 mb-3">
        {linha.km} km · Pedágio ref. 6 eixos: {formatBRL(linha.pedagio)}
        {linha.confianca && (
          <span className="ml-2">{badgeConfianca(linha.confianca as Confianca)}</span>
        )}
      </p>

      <table className="text-xs border-collapse">
        <thead>
          <tr className="text-gray-500">
            <th className="pr-3 pb-2 text-left font-medium">Eixos (ANTT)</th>
            <th className="px-3 pb-2 text-right font-medium">Simples</th>
            <th className="px-3 pb-2 text-right font-medium">Simples + AD</th>
            <th className="px-3 pb-2 text-right font-medium">Composição</th>
            <th className="px-3 pb-2 text-right font-medium">Comp. + AD</th>
          </tr>
        </thead>
        <tbody>
          {eixosList.map(e => {
            const itens = colunas.map(c =>
              linha.variacaoCompleta!.find(
                x => x.eixos === e && x.composicaoVeicular === c.composicao && x.altoDesempenho === c.alto
              )
            )
            return (
              <tr key={e} className="border-t border-gray-800">
                <td className="pr-3 py-1.5 text-gray-400">{e} eixos</td>
                {itens.map((v, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-right text-gray-300">
                    {formatBRL(v?.antt)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </td>
  </tr>
)}
```

- [ ] **Step 16.2: Verificar no dev server**

```bash
npm run dev
```

Calcular uma rota. Clicar na linha para expandir. Verificar:
- Se o provedor retornou praças (HERE com `pracas[]`): o breakdown aparece
- Se o provedor não retornou praças (TomTom, Rotas Brasil): apenas o total é exibido

- [ ] **Step 16.3: Commit**

```bash
git add app/(protected)/page.tsx
git commit -m "feat: add per-praca breakdown in expandable detail panel"
```

---

### Task 17: Criar Server Action de correção e modal

**Files:**
- Create: `lib/actions/correcao.ts`
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 17.1: Criar `lib/actions/correcao.ts`**

```typescript
'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '../db'

export async function salvarCorrecaoPedagio(params: {
  origem: string
  destino: string
  eixos: number
  pracaId?: string
  valorOriginal: number
  valorCorrigido: number
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Não autenticado')

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  await db.correcaoPedagio.create({
    data: {
      userId,
      origem: norm(params.origem),
      destino: norm(params.destino),
      eixos: params.eixos,
      pracaId: params.pracaId ?? null,
      valorOriginal: params.valorOriginal,
      valorCorrigido: params.valorCorrigido,
    },
  })
}
```

- [ ] **Step 17.2: Adicionar estado e botão de correção em `page.tsx`**

Adicionar ao estado do componente `Home`:

```typescript
const [corrigindo, setCorrigindo] = useState<number | null>(null) // índice da linha sendo corrigida
const [valorCorrigido, setValorCorrigido] = useState('')
```

No painel de detalhe expandível, adicionar após o breakdown de praças:

```tsx
{/* Botão Corrigir */}
{linha.pedagio != null && (
  <div className="mt-2">
    {corrigindo === i ? (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Valor real (R$):</span>
        <input
          type="number"
          step="0.01"
          value={valorCorrigido}
          onChange={e => setValorCorrigido(e.target.value)}
          className="w-28 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
          placeholder={String(linha.pedagio)}
        />
        <button
          onClick={async () => {
            const v = parseFloat(valorCorrigido)
            if (!isNaN(v) && v >= 0) {
              await salvarCorrecaoPedagio({
                origem: linha.origem,
                destino: linha.destino,
                eixos: linha.eixos,
                valorOriginal: linha.pedagio!,
                valorCorrigido: v,
              })
            }
            setCorrigindo(null)
            setValorCorrigido('')
          }}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition"
        >
          Salvar
        </button>
        <button
          onClick={() => { setCorrigindo(null); setValorCorrigido('') }}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          Cancelar
        </button>
      </div>
    ) : (
      <button
        onClick={() => { setCorrigindo(i); setValorCorrigido(String(linha.pedagio)) }}
        className="text-xs text-gray-500 hover:text-blue-400 transition"
      >
        ✎ Corrigir pedágio
      </button>
    )}
  </div>
)}
```

Adicionar o import da Server Action no topo do arquivo:

```typescript
import { salvarCorrecaoPedagio } from '@/lib/actions/correcao'
```

- [ ] **Step 17.3: Verificar no dev server**

```bash
npm run dev
```

Calcular uma rota → expandir a linha → clicar "Corrigir pedágio" → inserir valor → Salvar.
Verificar no banco que a correção foi gravada:

```bash
npx prisma studio
# Navegar para CorrecaoPedagio → verificar o registro criado
```

- [ ] **Step 17.4: Commit**

```bash
git add lib/actions/correcao.ts app/(protected)/page.tsx
git commit -m "feat: add pedagio correction action and inline correction UI"
```

---

## Resumo de Variáveis de Ambiente

| Variável | Provider | Onde obter |
|---|---|---|
| `HERE_API_KEY` | HereProvider | developer.here.com → Free tier: 250k req/mês |
| `TOMTOM_API_KEY` | TomTomProvider | developer.tomtom.com → Free tier: 2.5k req/dia |
| `ROTAS_BRASIL_TOKEN` | RotasBrasilProvider | rotasbrasil.com.br (já existia) |
| `GOOGLE_MAPS_API_KEY` | geocode.ts + BancoProprioProvider | console.cloud.google.com (já existia) |
| `ROUTING_PROVIDER_ORDER` | chain.ts | Opcional — padrão: `here,tomtom,banco-proprio,rotas-brasil,estimativa` |

---

## Decisão Pós-Testes

Após rodar `scripts/testar-provedores.ts` com 20–30 rotas reais:

| Cenário | Ação |
|---|---|
| HERE acertou pedagio (desvio < 5%) | Manter `ROUTING_PROVIDER_ORDER` padrão |
| TomTom acertou melhor | `ROUTING_PROVIDER_ORDER=tomtom,here,rotas-brasil,estimativa` |
| Ambos erraram (> 10% de desvio) | Priorizar Phase 2: popular o banco de praças e usar `banco-proprio` como primário |
| Rotas Brasil ainda é o mais preciso | `ROUTING_PROVIDER_ORDER=rotas-brasil,here,tomtom,estimativa` |
