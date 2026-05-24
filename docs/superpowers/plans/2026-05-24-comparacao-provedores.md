# Comparação Multi-Provedor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar toggle de provedores (localStorage) + botão "Comparar provedores" na planilha + página `/validacao` para comparar provedores numa rota avulsa.

**Architecture:** Server Action `compararProvedores` roda todos provedores solicitados em paralelo via `Promise.allSettled`. Hook `useProviderSettings` gerencia estado em localStorage. Dois pontos de entrada: botão na planilha principal e página `/validacao`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Clerk auth

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `types/routing.ts` | Adicionar `ComparacaoItem`, `ComparacaoResult` |
| Modify | `types/frete.ts` | Adicionar `comparacao?: ComparacaoResult` em `LinhaFrete` |
| Modify | `lib/routing/chain.ts` | Exportar `ALL_PROVIDERS` |
| Create | `lib/actions/comparar.ts` | Server Action que roda provedores em paralelo |
| Create | `hooks/useProviderSettings.ts` | Hook localStorage para toggle de provedores |
| Modify | `app/(protected)/page.tsx` | Settings panel + botão comparar + mini-tabela no accordion + link /validacao |
| Create | `app/(protected)/validacao/page.tsx` | Página de validação avulsa |

---

### Task 1: Tipos ComparacaoItem e ComparacaoResult

**Files:**
- Modify: `types/routing.ts`
- Modify: `types/frete.ts`

- [ ] **Step 1: Adicionar tipos em `types/routing.ts`**

Adicionar ao final do arquivo (após a interface `RoutingProvider`):

```typescript
export type ComparacaoItem = RotaResult | { error: string }
export type ComparacaoResult = Partial<Record<ProviderFonte, ComparacaoItem>>
```

- [ ] **Step 2: Adicionar campo `comparacao` em `types/frete.ts`**

Adicionar após `pracas?: PracaResult[]` na interface `LinhaFrete`:

```typescript
  comparacao?: ComparacaoResult
```

O import de `ComparacaoResult` fica na linha 1 existente — atualizar:

```typescript
import { ProviderFonte, PracaResult, ComparacaoResult } from './routing'
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add types/routing.ts types/frete.ts
git commit -m "feat: add ComparacaoItem, ComparacaoResult types"
```

---

### Task 2: Exportar ALL_PROVIDERS de chain.ts

**Files:**
- Modify: `lib/routing/chain.ts:13`

- [ ] **Step 1: Adicionar `export` ao ALL_PROVIDERS**

Linha 13 atual:
```typescript
const ALL_PROVIDERS = {
```

Alterar para:
```typescript
export const ALL_PROVIDERS = {
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/routing/chain.ts
git commit -m "feat: export ALL_PROVIDERS from chain"
```

---

### Task 3: Server Action compararProvedores

**Files:**
- Create: `lib/actions/comparar.ts`

- [ ] **Step 1: Criar `lib/actions/comparar.ts`**

```typescript
'use server'

import { ProviderFonte, ComparacaoResult } from '@/types/routing'
import { ALL_PROVIDERS } from '@/lib/routing/chain'

export async function compararProvedores(
  origem: string,
  destino: string,
  eixos: number,
  providers: ProviderFonte[]
): Promise<ComparacaoResult> {
  const entries = providers
    .filter(nome => nome in ALL_PROVIDERS)
    .map(nome => ({
      nome,
      provider: ALL_PROVIDERS[nome as keyof typeof ALL_PROVIDERS],
    }))

  const results = await Promise.allSettled(
    entries.map(({ provider }) => {
      if ('isActive' in provider && !(provider as { isActive(): boolean }).isActive()) {
        return Promise.reject(new Error('API key não configurada'))
      }
      return provider.calcularRota(origem, destino, eixos)
    })
  )

  const out: ComparacaoResult = {}
  for (let i = 0; i < entries.length; i++) {
    const { nome } = entries[i]
    const result = results[i]
    if (result.status === 'fulfilled') {
      out[nome] = result.value
    } else {
      out[nome] = { error: result.reason?.message ?? String(result.reason) }
    }
  }
  return out
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/comparar.ts
git commit -m "feat: add compararProvedores server action"
```

---

### Task 4: Hook useProviderSettings

**Files:**
- Create: `hooks/useProviderSettings.ts`

- [ ] **Step 1: Criar `hooks/useProviderSettings.ts`**

```typescript
import { useState, useEffect } from 'react'
import { ProviderFonte } from '@/types/routing'

type ProviderSettings = Partial<Record<ProviderFonte, boolean>>

const STORAGE_KEY = 'frete_provider_settings'

const DEFAULTS: ProviderSettings = {
  here: true,
  tomtom: false,
  'rotas-brasil': true,
  estimativa: false,
}

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch {}
  }, [])

  function toggle(fonte: ProviderFonte) {
    setSettings(prev => {
      const next = { ...prev, [fonte]: !prev[fonte] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const activeProviders = (Object.keys(settings) as ProviderFonte[]).filter(
    k => settings[k] === true
  )

  return { settings, toggle, activeProviders }
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add hooks/useProviderSettings.ts
git commit -m "feat: add useProviderSettings hook (localStorage)"
```

---

### Task 5: Modificar page.tsx — settings panel + compare button + mini-tabela

**Files:**
- Modify: `app/(protected)/page.tsx`

Contexto: arquivo de 468 linhas, componente cliente. Fazer as edições abaixo em sequência.

- [ ] **Step 1: Adicionar imports**

Substituir bloco de imports atual (linhas 1-9):

```typescript
'use client'

import React, { useState, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import { LinhaFrete } from '@/types/frete'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { salvarCotacao } from '@/lib/actions/cotacao'
import { salvarCorrecaoPedagio } from '@/lib/actions/correcao'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'
```

- [ ] **Step 2: Adicionar constante PROVIDER_OPTIONS após imports (antes de `type StatusGlobal`)**

```typescript
const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here', label: 'HERE Maps' },
  { fonte: 'tomtom', label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa', label: 'Estimativa (Haversine)' },
]
```

- [ ] **Step 3: Adicionar state e hook dentro do componente `Home()`**

Logo após a declaração `const fileRef = useRef<HTMLInputElement>(null)` (linha ~88), adicionar:

```typescript
  const [settingsAberto, setSettingsAberto] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [progressoComparacao, setProgressoComparacao] = useState(0)
  const { settings, toggle, activeProviders } = useProviderSettings()
```

- [ ] **Step 4: Adicionar função `comparar()` dentro do componente**

Logo após a função `limpar()` (após linha ~151), adicionar:

```typescript
  async function comparar() {
    if (!linhas.length || !activeProviders.length) return
    setComparando(true)
    setProgressoComparacao(0)
    const atualizadas = [...linhas]
    for (let i = 0; i < atualizadas.length; i++) {
      setProgressoComparacao(i + 1)
      const l = atualizadas[i]
      if (!l.origem || !l.destino) continue
      try {
        const resultado = await compararProvedores(l.origem, l.destino, l.eixos, activeProviders)
        atualizadas[i] = { ...l, comparacao: resultado }
      } catch (err) {
        console.warn(`[comparar] linha ${i} falhou:`, err)
      }
      if (i < atualizadas.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    setLinhas(atualizadas)
    setComparando(false)
  }
```

- [ ] **Step 5: Atualizar header — adicionar link /validacao + settings popover**

Substituir o bloco `<div className="flex items-center gap-4">` do header (o que contém "Baixar modelo Excel" e `<UserButton />`):

```tsx
        <div className="flex items-center gap-4">
          <a
            href="/validacao"
            className="text-sm text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 px-3 py-1.5 rounded transition"
          >
            Validar provedores
          </a>
          <a
            href="/api/modelo"
            className="text-sm text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-1.5 rounded transition"
          >
            Baixar modelo Excel
          </a>
          <div className="relative">
            <button
              onClick={() => setSettingsAberto(v => !v)}
              className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded transition"
              title="Configurar provedores"
            >
              ⚙ Provedores
            </button>
            {settingsAberto && (
              <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-4 z-10 min-w-[220px]">
                <p className="text-xs text-gray-500 font-medium mb-3">Provedores ativos</p>
                {PROVIDER_OPTIONS.map(({ fonte, label }) => (
                  <label key={fonte} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!settings[fonte]}
                      onChange={() => toggle(fonte)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <UserButton />
        </div>
```

- [ ] **Step 6: Adicionar botão "Comparar provedores" na seção 2**

Dentro do `<div className="flex items-center gap-4 flex-wrap">` que contém o botão "Calcular" (logo após o botão `Calcular KM · Pedágio · ANTT`), adicionar o botão de comparação:

```tsx
              <button
                onClick={comparar}
                disabled={comparando || !linhas.length || !activeProviders.length}
                className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition flex items-center gap-2"
              >
                {comparando ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Comparando rota {progressoComparacao}/{linhas.length}…
                  </>
                ) : (
                  `Comparar provedores${activeProviders.length > 0 ? ` (${activeProviders.length})` : ''}`
                )}
              </button>
```

- [ ] **Step 7: Adicionar mini-tabela de comparação no accordion**

Dentro do accordion detail row (`{aberto && linha.variacaoCompleta && ...}`), logo após o bloco de praças (`{linha.pracas && linha.pracas.length > 0 && ...}`) e antes da linha `<p className="text-xs text-gray-500 mb-3 ...">`, adicionar:

```tsx
                              {/* Comparação de provedores */}
                              {linha.comparacao && (
                                <div className="mb-4">
                                  <p className="text-xs text-gray-500 font-medium mb-2">
                                    Comparação de provedores
                                  </p>
                                  {(() => {
                                    const comp = linha.comparacao!
                                    const valores = (Object.values(comp) as Array<ComparacaoResult[keyof ComparacaoResult]>)
                                      .filter((r): r is RotaResult => !!r && 'km' in r && (r as RotaResult).pedagio > 0)
                                      .map(r => r.pedagio)
                                    const minP = valores.length > 0 ? Math.min(...valores) : 0
                                    const maxP = valores.length > 0 ? Math.max(...valores) : 0
                                    const diverge = valores.length > 1 && minP > 0 && (maxP - minP) / minP > 0.10
                                    return (
                                      <table className="text-xs border-collapse w-full max-w-sm">
                                        <thead>
                                          <tr className="text-gray-600">
                                            <th className="text-left pb-1 font-medium">Provedor</th>
                                            <th className="text-right pb-1 font-medium px-3">KM</th>
                                            <th className="text-right pb-1 font-medium px-3">Pedágio</th>
                                            <th className="text-right pb-1 font-medium">Confiança</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(Object.entries(comp) as [ProviderFonte, ComparacaoResult[keyof ComparacaoResult]][]).map(([nome, res]) => {
                                            if (!res) return null
                                            const isError = 'error' in res
                                            const isDivergente = !isError && diverge && (res as RotaResult).pedagio > 0
                                            return (
                                              <tr
                                                key={nome}
                                                className={`border-t border-gray-800 ${isDivergente ? 'bg-yellow-900/20' : ''}`}
                                              >
                                                <td className="py-1 pr-3 text-gray-400">{labelFonte(nome)}</td>
                                                {isError ? (
                                                  <td colSpan={3} className="py-1 px-3 text-red-400">{(res as { error: string }).error}</td>
                                                ) : (
                                                  <>
                                                    <td className="py-1 px-3 text-right text-gray-300">{(res as RotaResult).km} km</td>
                                                    <td className="py-1 px-3 text-right text-gray-300">{formatBRL((res as RotaResult).pedagio)}</td>
                                                    <td className="py-1 text-right">{badgeConfianca((res as RotaResult).confianca as Confianca)}</td>
                                                  </>
                                                )}
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    )
                                  })()}
                                </div>
                              )}
```

- [ ] **Step 8: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add app/\(protected\)/page.tsx
git commit -m "feat: add provider settings panel and compare button to calculator"
```

---

### Task 6: Página /validacao

**Files:**
- Create: `app/(protected)/validacao/page.tsx`

- [ ] **Step 1: Criar `app/(protected)/validacao/page.tsx`**

```typescript
'use client'

import React, { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'

type Confianca = 'alta' | 'media' | 'baixa'

function formatBRL(valor?: number) {
  if (valor == null) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function badgeConfianca(confianca?: Confianca) {
  if (!confianca) return null
  const cfg = {
    alta:  { cor: 'bg-green-600',  label: '● Alta' },
    media: { cor: 'bg-yellow-600', label: '● Média' },
    baixa: { cor: 'bg-red-700',    label: '● Baixa' },
  }[confianca]
  return (
    <span className={`inline-flex items-center text-xs text-white px-1.5 py-0.5 rounded ${cfg.cor}`}>
      {cfg.label}
    </span>
  )
}

function labelFonte(fonte: ProviderFonte): string {
  const labels: Record<ProviderFonte, string> = {
    here: 'HERE Maps',
    tomtom: 'TomTom',
    'rotas-brasil': 'Rotas Brasil',
    'banco-proprio': 'Banco Próprio',
    estimativa: 'Estimativa',
  }
  return labels[fonte]
}

const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here', label: 'HERE Maps' },
  { fonte: 'tomtom', label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa', label: 'Estimativa (Haversine)' },
]

export default function ValidacaoPage() {
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [eixos, setEixos] = useState(6)
  const [resultado, setResultado] = useState<ComparacaoResult | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [pracasExpandidas, setPracasExpandidas] = useState<Set<string>>(new Set())
  const { settings, toggle, activeProviders } = useProviderSettings()

  async function comparar(e: React.FormEvent) {
    e.preventDefault()
    if (!origem.trim() || !destino.trim() || !activeProviders.length) return
    setCarregando(true)
    setErro('')
    setResultado(null)
    try {
      const res = await compararProvedores(origem.trim(), destino.trim(), eixos, activeProviders)
      setResultado(res)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  function togglePracas(nome: string) {
    setPracasExpandidas(prev => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-200 transition">
            ← Calculadora
          </a>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Validação de Provedores</h1>
            <p className="text-sm text-gray-400 mt-0.5">Compare KM e pedágio entre fontes</p>
          </div>
        </div>
        <UserButton />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Provedores ativos</h2>
          <div className="flex flex-wrap gap-6">
            {PROVIDER_OPTIONS.map(({ fonte, label }) => (
              <label key={fonte} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings[fonte]}
                  onChange={() => toggle(fonte)}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">{label}</span>
              </label>
            ))}
          </div>
          {activeProviders.length === 0 && (
            <p className="mt-3 text-sm text-yellow-400">Nenhum provedor selecionado.</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Rota para comparar</h2>
          <form onSubmit={comparar} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Origem</label>
              <input
                type="text"
                value={origem}
                onChange={e => setOrigem(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                required
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-52"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Destino</label>
              <input
                type="text"
                value={destino}
                onChange={e => setDestino(e.target.value)}
                placeholder="Ex: Curitiba, PR"
                required
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-52"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Eixos</label>
              <select
                value={eixos}
                onChange={e => setEixos(Number(e.target.value))}
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              >
                {[2, 3, 4, 5, 6, 7, 9].map(n => (
                  <option key={n} value={n}>{n} eixos</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={carregando || !activeProviders.length}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition flex items-center gap-2"
            >
              {carregando ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  Comparando…
                </>
              ) : 'Comparar'}
            </button>
          </form>
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-medium text-gray-300">
                {origem} → {destino} · {eixos} eixos
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-left">
                  <th className="px-6 py-3 font-medium">Provedor</th>
                  <th className="px-4 py-3 font-medium text-right">KM</th>
                  <th className="px-4 py-3 font-medium text-right">Pedágio</th>
                  <th className="px-4 py-3 font-medium">Confiança</th>
                  <th className="px-4 py-3 font-medium">Praças</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {(Object.entries(resultado) as [ProviderFonte, ComparacaoResult[keyof ComparacaoResult]][]).map(([nome, res]) => {
                  if (!res) return null
                  const isError = 'error' in res
                  return (
                    <React.Fragment key={nome}>
                      <tr className="hover:bg-gray-800/50 transition">
                        <td className="px-6 py-3 text-gray-300 font-medium">{labelFonte(nome)}</td>
                        {isError ? (
                          <td colSpan={4} className="px-4 py-3 text-red-400 text-xs">
                            {(res as { error: string }).error}
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {(res as RotaResult).km} km
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {formatBRL((res as RotaResult).pedagio)}
                            </td>
                            <td className="px-4 py-3">
                              {badgeConfianca((res as RotaResult).confianca as Confianca)}
                            </td>
                            <td className="px-4 py-3">
                              {(res as RotaResult).pracas && (res as RotaResult).pracas!.length > 0 ? (
                                <button
                                  onClick={() => togglePracas(nome)}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                                >
                                  {pracasExpandidas.has(nome)
                                    ? 'Ocultar'
                                    : `${(res as RotaResult).pracas!.length} praças`}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-600">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      {!isError &&
                        (res as RotaResult).pracas &&
                        (res as RotaResult).pracas!.length > 0 &&
                        pracasExpandidas.has(nome) && (
                          <tr>
                            <td colSpan={5} className="px-8 py-3 bg-gray-800/30">
                              <table className="text-xs border-collapse">
                                <tbody>
                                  {(res as RotaResult).pracas!.map((p, pi) => (
                                    <tr key={pi}>
                                      <td className="pr-6 py-0.5 text-gray-400">
                                        {p.nome}
                                        {p.rodovia && (
                                          <span className="ml-1 text-gray-600">({p.rodovia})</span>
                                        )}
                                      </td>
                                      <td className="text-right text-gray-300">{formatBRL(p.valor)}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t border-gray-700">
                                    <td className="pr-6 py-0.5 text-gray-500 font-medium">Total</td>
                                    <td className="text-right text-gray-300 font-medium">
                                      {formatBRL((res as RotaResult).pedagio)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/validacao/page.tsx
git commit -m "feat: add /validacao provider comparison page"
```

---

## Self-Review

**Spec coverage:**
- [x] Toggle provedores → `useProviderSettings` + settings panel no header
- [x] Settings em localStorage → `STORAGE_KEY = 'frete_provider_settings'`
- [x] Botão "Comparar provedores" opt-in → Task 5 Step 6
- [x] Comparação paralela via `Promise.allSettled` → Task 3
- [x] Mini-tabela no accordion com highlight >10% → Task 5 Step 7
- [x] Página `/validacao` com form + tabela + praças collapsíveis → Task 6
- [x] Link da planilha para `/validacao` → Task 5 Step 5
- [x] Link "← Calculadora" em `/validacao` → Task 6

**Placeholder scan:** Limpo.

**Type consistency:**
- `ComparacaoResult` definido em Task 1, usado em Tasks 3, 4, 5, 6 ✓
- `activeProviders: ProviderFonte[]` do hook, passado para `compararProvedores(... providers: ProviderFonte[])` ✓
- `ComparacaoResult[keyof ComparacaoResult]` = `ComparacaoItem | undefined` = `RotaResult | { error: string } | undefined` — type guards com `'error' in res` e `'km' in res` corretos ✓
