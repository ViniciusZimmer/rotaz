# Comparação Multi-Provedor — Design Spec

> **For agentic workers:** Use superpowers:writing-plans to implement this spec.

**Goal:** Permitir que o usuário habilite/desabilite provedores de rota e compare resultados de múltiplos provedores simultaneamente — tanto na planilha principal quanto numa página de validação avulsa.

**Architecture:** Server Action `compararProvedores` roda todos provedores ativos em paralelo via `Promise.allSettled` e retorna `ComparacaoResult`. Settings de provedores ficam em `localStorage` via hook `useProviderSettings`. Dois pontos de entrada: botão "Comparar provedores" na planilha e página `/validacao`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Clerk auth, localStorage

---

## Contexto

O sistema já possui 4 provedores de rota:
- **HERE** — 250k req/mês grátis, retorna KM + pedágio por praça (`confianca: 'alta'`)
- **TomTom** — 2.5k/dia grátis, retorna KM apenas (sem pedágio no tier free, `confianca: 'media'`)
- **Rotas Brasil** — API paga, 50 req grátis, retorna KM + pedágio (`confianca: 'alta'`)
- **Haversine** — estimativa local, sem chamada externa (`confianca: 'baixa'`)

O chain atual (`lib/routing/chain.ts`) retorna o primeiro resultado válido. Este spec adiciona modo de comparação paralela.

---

## Tipos

Adicionar em `types/routing.ts`:

```typescript
export type ComparacaoItem = RotaResult | { error: string }
export type ComparacaoResult = Partial<Record<ProviderFonte, ComparacaoItem>>
```

Adicionar em `types/frete.ts` (campo opcional em `LinhaFrete`):

```typescript
comparacao?: ComparacaoResult
```

---

## Componentes

### 1. `lib/actions/comparar.ts` — Server Action

```typescript
'use server'
export async function compararProvedores(
  origem: string,
  destino: string,
  eixos: number,
  providers: ProviderFonte[]
): Promise<ComparacaoResult>
```

- Importa `ALL_PROVIDERS` de `lib/routing/chain.ts` (precisa ser exportado)
- Filtra provedores solicitados que existem e têm `isActive() === true`
- Roda `Promise.allSettled` em todos simultaneamente
- `fulfilled` → `RotaResult`; `rejected` → `{ error: message }`
- Não usa cache — comparação sempre busca dados frescos

### 2. `lib/routing/chain.ts` — Exportar ALL_PROVIDERS

```typescript
export const ALL_PROVIDERS = { ... }  // já existe, só adicionar export
```

### 3. `hooks/useProviderSettings.ts` — Hook de settings

```typescript
export function useProviderSettings(): {
  settings: Record<ProviderFonte, boolean>
  toggle: (fonte: ProviderFonte) => void
  activeProviders: ProviderFonte[]
}
```

- Chave localStorage: `'frete_provider_settings'`
- Default: `{ here: true, tomtom: false, 'rotas-brasil': true, estimativa: false }`
- TomTom e Estimativa desabilitados por padrão (TomTom sem pedágio, Estimativa imprecisa)
- `activeProviders` = chaves onde `settings[key] === true`

### 4. `app/(protected)/page.tsx` — Modificações

**Painel de settings (⚙):**
- Botão ⚙ no header abre popover/dropdown
- 4 checkboxes: HERE | TomTom | Rotas Brasil | Estimativa
- Se provedor não tem API key (`isActive() === false`): checkbox desabilitado + label "(sem API key)"
- Toggle chama `useProviderSettings().toggle()`

**Botão "Comparar provedores":**
- Renderizado ao lado do botão "Calcular"
- Desabilitado se: sem arquivo carregado OU `activeProviders.length === 0` OU comparação em andamento
- Ao clicar: itera linhas sequencialmente (1s entre cada), chama `compararProvedores` por linha
- State: `comparando: boolean`, `progressoComparacao: number` (índice atual)
- Label durante execução: "Comparando rota 3/12…"
- Resultado salvo em `linhas[i].comparacao`

**Mini-tabela no accordion (linha expandida):**
- Aparece se `linha.comparacao` existe
- Colunas: Provedor | KM | Pedágio | Confiança
- Linha com `error` mostra mensagem de erro em vermelho
- Diferença de pedágio >10% entre provedores → linha destacada em `bg-yellow-50`
- Referência para highlight: usa resultado do provedor principal (`linha.fonte`) como baseline

### 5. `app/(protected)/validacao/page.tsx` — Página de validação

- Rota: `/validacao`
- Form: campos "Origem", "Destino", "Eixos" (select 2-9) + botão "Comparar"
- Usa `useProviderSettings()` — mesmos settings da página principal
- Chama `compararProvedores` com `activeProviders`
- Tabela de resultado:
  - Colunas: Provedor | KM | Pedágio | Confiança | Praças
  - Coluna Praças: lista `praça.nome — R$valor` por linha, collapsível
  - Erros em vermelho com mensagem
- Link "← Calculadora" no topo

---

## Fluxo de dados

```
useProviderSettings() ─── localStorage ───► settings { here: true, ... }
                                                      │
                                            activeProviders[]
                                                      │
                         ┌────────────────────────────┤
                         │                            │
              [Planilha] "Comparar"        [/validacao] "Comparar"
                         │                            │
                         └──► compararProvedores(origem, destino, eixos, activeProviders[])
                                        │
                               Promise.allSettled(ALL_PROVIDERS[p].calcularRota(...))
                                        │
                              ComparacaoResult { here: RotaResult, 'rotas-brasil': RotaResult, ... }
                                        │
                         ┌─────────────┴──────────────┐
                         │                            │
              linha.comparacao                  tabela na página
              → mini-tabela no accordion        → tabela com praças
```

---

## Regras de negócio

- Comparação nunca lê/escreve cache — sempre chama APIs frescas
- Provedores sem API key são filtrados antes de chamar `compararProvedores` (server-side via `isActive()`)
- Sequencial na planilha (1s entre rotas) para evitar rate-limit do HERE/TomTom
- Highlight de divergência: calcula `max - min` do pedágio entre provedores sem erro; se `(max - min) / min > 0.10` → destaca todas as linhas do grupo
- TomTom desabilitado por default mas disponível para comparar KM (útil para validar distância mesmo sem pedágio)

---

## O que NÃO está no escopo

- Persistir resultados de comparação no banco
- Histórico de comparações
- Export de comparação para Excel
- Editar/corrigir valores diretamente na tabela de comparação (usa fluxo existente de "Corrigir pedágio")
