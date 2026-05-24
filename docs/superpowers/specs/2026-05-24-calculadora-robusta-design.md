# Calculadora Robusta — Design Spec

**Data:** 2026-05-24
**Módulo:** Calculadora Robusta (substitui dependência única do Rotas Brasil)
**Status:** Aprovado

---

## Contexto

O sistema atual depende exclusivamente da API do Rotas Brasil para obter KM e pedágio. Essa API é paga, oferece apenas 50 requisições gratuitas (insuficiente para centenas de rotas novas por semana), e não permite validar se os valores retornados estão corretos. O resultado é um sistema frágil e sem confiabilidade auditável.

**Objetivo:** tornar o cálculo de frete independente de um único provedor, validável pelos usuários, e sustentável em escala para transportadoras reais.

---

## Princípio central

Em vez de depender de **um** provedor de rotas, o sistema passa a ter uma **camada de abstração** (`RoutingProvider`) que qualquer API pode implementar. Provedores são testáveis, substituíveis, e priorizáveis via configuração — sem reescrever o sistema.

---

## Arquitetura

### Fluxo de cálculo

```
Excel / Input manual
        ↓
  RoutingProvider (interface)
  ├── HereProvider         ← testar primeiro (250k req/mês grátis)
  ├── TomTomProvider       ← testar em paralelo (2.5k req/dia grátis)
  ├── RotasBrasilProvider  ← existente, vira um adapter
  ├── BancoProprioProvider ← longo prazo, máxima precisão e transparência
  └── HaversineProvider    ← último fallback (já existe)
        ↓
  Cache (30 dias) — armazena km, pedágio, fonte, praças cruzadas
        ↓
  Cálculo ANTT (lib/antt.ts — não muda)
        ↓
  UI: resultado + fonte dos dados + confiança + detalhamento por praça
```

### O que muda vs. o que fica

| Componente | Hoje | Após este módulo |
|---|---|---|
| KM | Rotas Brasil (eixo=6) | Provedor primário configurável |
| Pedágio | Rotas Brasil (black box, total) | Provedor externo OU banco próprio de praças |
| Validação | Impossível | UI mostra praça a praça, usuário corrige |
| Custo por rota nova | Crédito Rotas Brasil | ~$0 dentro do free tier HERE/TomTom |
| Fallback | Google Maps KM + estimativa | Cadeia de provedores com degradação gradual |
| Cálculo ANTT | `lib/antt.ts` | Sem mudança |
| API routes `/api/calcular`, `/api/exportar` | Existentes | Mantidas (internamente usam o novo provider) |
| Cache de rotas | JSON 30 dias | Mantido, agora armazena `fonte` e `pracas[]` |

---

## Seção 1 — Interface RoutingProvider

### Contrato

```typescript
// types/routing.ts

interface PracaResult {
  nome: string
  valor: number
  rodovia?: string
}

interface RotaResult {
  km: number
  pedagio: number
  pracas?: PracaResult[]   // detalhamento por praça, quando disponível
  fonte: ProviderFonte
  confianca: 'alta' | 'media' | 'baixa'
}

type ProviderFonte =
  | 'here'
  | 'tomtom'
  | 'rotas-brasil'
  | 'banco-proprio'
  | 'estimativa'

interface RoutingProvider {
  nome: ProviderFonte
  calcularRota(origem: string, destino: string, eixos: number): Promise<RotaResult>
}
```

### Cadeia de prioridade

O sistema tenta os provedores em ordem. Passa para o próximo se:
- A chamada lança erro
- `pedagio === 0` (sinal de cobertura incompleta)
- `km === 0`

```typescript
// lib/routing/chain.ts
const PROVIDERS: RoutingProvider[] = [
  new HereProvider(),
  new TomTomProvider(),
  new RotasBrasilProvider(),   // só ativo se ROTAS_BRASIL_TOKEN configurado
  new BancoProprioProvider(),
  new HaversineProvider(),
]
```

A ordem dos provedores é configurável via variável de ambiente (`ROUTING_PROVIDER_ORDER`) para facilitar testes sem deploy.

### Confiança por provedor

| Provedor | Confiança padrão | Quando sobe/desce |
|---|---|---|
| `banco-proprio` | alta | — |
| `here` / `tomtom` | média → alta | Sobe após validação manual do usuário para aquela rota |
| `rotas-brasil` | média | — |
| `estimativa` | baixa | — |

---

## Seção 2 — Implementação dos Provedores

### HereProvider

- **API:** HERE Routing API v8
- **Endpoint:** `router.hereapi.com/v8/routes`
- **Parâmetros relevantes:** `vehicle[type]=truck`, `vehicle[axleCount]=<eixos>`, `return=summary,tolls`
- **Free tier:** 250.000 req/mês — suficiente para centenas de rotas/dia
- **Variável de ambiente:** `HERE_API_KEY`
- **Retorna:** km, toll cost total, lista de toll plazas (quando disponível)

### TomTomProvider

- **API:** TomTom Routing API
- **Endpoint:** `api.tomtom.com/routing/1/calculateRoute`
- **Parâmetros relevantes:** `vehicleCommercial=true`, `vehicleAxles=<eixos>` — confirmar na implementação quais flags retornam custo de pedágio (documentação TomTom deve ser consultada para o campo exato de toll cost)
- **Free tier:** 2.500 req/dia
- **Variável de ambiente:** `TOMTOM_API_KEY`
- **Uso:** fallback do HERE ou testes comparativos

### RotasBrasilProvider

- Adapter do código existente em `lib/rotas-brasil.ts`
- Comportamento mantido identicamente
- Só ativo se `ROTAS_BRASIL_TOKEN` estiver configurado

### BancoProprioProvider

- Usa Google Maps Directions para obter polyline da rota
- Decodifica polyline em array de pontos lat/lng
- Faz matching geográfico contra `PracaPedagio` no banco (ver Seção 3)
- Retorna lista de praças cruzadas + total por eixo
- **Variável de ambiente:** `GOOGLE_MAPS_API_KEY` (já existe no projeto)

### HaversineProvider

- Adapter do código existente em `lib/google-maps.ts`
- KM via Haversine × 1.35
- Pedágio via estimativa de `lib/pedagio.ts`
- Confiança sempre `baixa`

---

## Seção 3 — Banco de Praças de Pedágio

### Schema Prisma

```prisma
model PracaPedagio {
  id             String        @id @default(cuid())
  nome           String        // "Praça Guaratinguetá"
  rodovia        String        // "BR-116"
  concessionaria String        // "Autopista Régis Bittencourt"
  uf             String
  lat            Float
  lng            Float
  sentido        String        // "AMBOS" | "CRESCENTE" | "DECRESCENTE"
  ativa          Boolean       @default(true)
  tarifas        TarifaPraca[]
}

model TarifaPraca {
  id       String       @id @default(cuid())
  pracaId  String
  praca    PracaPedagio @relation(fields: [pracaId], references: [id])
  eixos    Int          // 2, 3, 4, 5, 6, 7, 9
  valor    Float
  vigencia DateTime     // quando essa tarifa entrou em vigor
}

model CorrecaoPedagio {
  id             String   @id @default(cuid())
  userId         String
  origem         String   // normalizado (sem acento, minúsculas)
  destino        String
  eixos          Int
  pracaId        String?  // null = correção do total da rota
  valorOriginal  Float
  valorCorrigido Float
  createdAt      DateTime @default(now())
}
```

### Algoritmo de matching geográfico (BancoProprioProvider)

```
1. Chamar Google Maps Directions API com origem, destino e waypoints relevantes
2. Decodificar overview_polyline em array de pontos {lat, lng}
3. Filtrar PracaPedagio no banco pelos UFs do trajeto (reduz comparações)
4. Para cada praça candidata:
   a. Calcular distância mínima (Haversine) até qualquer ponto da polyline
   b. Se distância < 800m → praça está na rota
5. Verificar sentido da praça vs. sentido do trajeto (para praças unidirecionais)
6. Somar TarifaPraca.valor onde eixos = eixos da rota
7. Retornar lista de praças + total
```

O matching roda inteiramente no servidor sem API adicional — é matemática Haversine.

### Estratégia de importação (faseada)

Fonte dos dados: ANTT (portaria pública) + sites das concessionárias. Importação via script `scripts/importar-pracas.ts` que lê CSV e faz upsert no banco.

| Fase | Rodovias | Cobertura estimada |
|---|---|---|
| 1 | BR-116, BR-101, BR-381, BR-163, BR-153, BR-364, BR-262, BR-040, BR-050, BR-060, BR-070, BR-080, BR-020, BR-010, BR-230 | ~70% das rotas |
| 2 | Todas as federais (~900 praças) | ~95% |
| 3 | Estaduais principais | ~99% |

Atualização anual: quando ANTT publica novas tarifas (geralmente março), atualiza-se o CSV e roda o script. Todos os cálculos futuros usam os valores novos automaticamente.

---

## Seção 4 — UI de Validação

### Painel por rota (expansível)

```
┌─────────────────────────────────────────────────────┐
│ São Paulo → Curitiba   842 km   ● Alta confiança    │
│ Pedágio: R$ 187,40  [via HERE]          [▼ detalhar]│
├─────────────────────────────────────────────────────┤
│ Praças cruzadas:                                    │
│   Praça Miracatu (BR-116)              R$  28,50    │
│   Praça Juquiá (BR-116)               R$  31,20    │
│   Praça Jurupará (BR-116)             R$  33,40    │
│   Praça Cajati (BR-116)               R$  31,20    │
│   Praça Registro (BR-116)             R$  31,10    │
│   Praça Pariquera-Açu (BR-116)        R$  32,00    │
│                              Total:   R$ 187,40    │
│                                   [✎ Corrigir]     │
└─────────────────────────────────────────────────────┘
```

Quando o provedor não retorna praças (ex: Rotas Brasil retorna só o total), o painel mostra apenas o total e a fonte, sem detalhamento.

### Indicadores de confiança

| Indicador | Quando |
|---|---|
| ● verde — Alta | Banco próprio com praças mapeadas, ou provedor validado manualmente para essa rota |
| ● amarelo — Média | Provedor externo (HERE/TomTom) ainda não confirmado para essa rota |
| ● vermelho — Baixa | Estimativa (Haversine/pedagio.ts) ou pedágio zero |

### Fluxo de correção

1. Usuário clica em "Corrigir"
2. Modal abre com a lista de praças (se disponível) e campos de valor editáveis
3. Usuário ajusta uma praça específica ou o total da rota
4. Salva em `CorrecaoPedagio` com `userId`, rota, praça, valor original e corrigido
5. Na próxima vez que essa rota for calculada, as correções são aplicadas automaticamente sobre o resultado do provedor
6. Indicador sobe para "Alta" após a primeira correção confirmada

---

## Seção 5 — Estratégia de Teste de Provedores

Antes de definir o provedor primário em produção, rodar comparação em ambiente de desenvolvimento:

### Script de comparação

```
scripts/testar-provedores.ts <arquivo-rotas.csv>

Para cada rota no arquivo:
  → Chama HERE, TomTom, Rotas Brasil em paralelo
  → Imprime tabela comparativa: km e pedágio por provedor
  → Salva resultado em testar-provedores-resultado.json
```

### Critério de decisão

- Selecionar 20–30 rotas que os clientes fazem com frequência e cujos valores de pedágio são conhecidos (extrato de tag, nota fiscal)
- Provedor com menor desvio médio em relação aos valores reais → vira primário
- Se HERE e TomTom não forem precisos o suficiente → BancoProprioProvider passa a ser a prioridade de implementação

---

## Variáveis de Ambiente

| Variável | Provedor | Obrigatória |
|---|---|---|
| `HERE_API_KEY` | HereProvider | Não — provider desativado se ausente |
| `TOMTOM_API_KEY` | TomTomProvider | Não — provider desativado se ausente |
| `ROTAS_BRASIL_TOKEN` | RotasBrasilProvider | Não — já existia |
| `GOOGLE_MAPS_API_KEY` | BancoProprioProvider | Não — Haversine usado se ausente |
| `ROUTING_PROVIDER_ORDER` | chain.ts | Não — usa ordem padrão se ausente. Formato: `here,tomtom,rotas-brasil,banco-proprio,estimativa` |

Pelo menos um provedor com pedágio real deve estar configurado para confiança `alta` ou `média`. Se nenhum estiver, o sistema funciona mas indica confiança `baixa` em todos os resultados.

---

## Estrutura de Arquivos

```
lib/
  routing/
    types.ts              ← RotaResult, RoutingProvider, ProviderFonte
    chain.ts              ← cadeia de provedores com fallback
    here.ts               ← HereProvider
    tomtom.ts             ← TomTomProvider
    rotas-brasil.ts       ← adapter do lib/rotas-brasil.ts existente
    banco-proprio.ts      ← BancoProprioProvider (matching geográfico)
    haversine.ts          ← adapter do fallback existente

scripts/
  importar-pracas.ts      ← upsert de praças via CSV
  testar-provedores.ts    ← comparação lado a lado de provedores

prisma/
  schema.prisma           ← + PracaPedagio, TarifaPraca, CorrecaoPedagio
```

---

## Módulos fora do escopo deste spec

- Dashboard de analytics de cotações
- Histórico de cotações com busca e filtros
- Gestão de clientes e contratos
- Multi-tenant (múltiplas transportadoras)
- Atualização automática de tarifas ANTT (hoje é manual via script)
