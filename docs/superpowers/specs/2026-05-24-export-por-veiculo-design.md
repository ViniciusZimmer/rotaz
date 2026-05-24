# Export por Tipo de Veículo — Design Spec

**Data:** 2026-05-24
**Módulo:** Novo formato de input/export — 5 abas por tipo de veículo
**Status:** Aprovado

---

## Contexto

O sistema atual recebe Excel com colunas Origem, Destino, Eixos e exporta uma grade com 28 combinações ANTT por rota. O novo fluxo elimina a coluna Eixos do input e exporta um Excel com 5 abas fixas — uma por tipo de veículo — cada uma com ANTT Sem AD, ANTT Com AD, Pedágio e Totais.

---

## Fluxo geral

```
Input Excel (Origem | UF | Destino | UF)
    ↓  parsePorVeiculo()  — novo parser em app/page.tsx
Tela: tabela igual à atual (grade 28 variações por rota)
    ↓  clique "Exportar"
gerarExcelPorVeiculo()  — nova função em lib/excel.ts
    ↓
Excel com 5 abas: Truck | Bitruck | Carreta Simples | Carreta Truckada | Rodotrem
```

A API `/api/calcular` não muda. Rotas Brasil continua sendo chamada com `eixo=6` (referência). `variacaoCompleta` já contém os 28 pares — o export extrai os 5 pares relevantes por aba.

---

## Seção 1 — Input

### Formato novo (substitui todos os anteriores)

| Origem | UF | Destino | UF |
|---|---|---|---|
| São Paulo | SP | Curitiba | PR |

Sem coluna Eixos. Sem coluna Cliente.

### Parser

Nova função `parsePorVeiculo(rows: string[][]): LinhaFrete[]` em `app/page.tsx`.

- Detecta colunas: `Origem`, `UF` (origem), `Destino`, `UF` (destino)
- Injeta `eixos: 6` internamente (usado apenas como parâmetro da chamada Rotas Brasil)
- Ignora linhas com Origem ou Destino vazios

### Remoções e atualizações

- `parsePadrao` — removido
- `parseModeloIA` — removido
- `gerarExcelModelo()` em `lib/excel.ts` → atualizado para gerar template com 4 colunas (Origem, UF, Destino, UF)
- `/api/modelo/route.ts` → usa `gerarExcelModelo()` atualizado, sem mudança na rota
- `public/modelo.xlsx` → regenerado com novo formato
- `scripts/gerar-modelo.mjs` → atualizado para novo formato (se mantido)
- Botão "Baixar Modelo" → sem mudança na UI, serve novo template

---

## Seção 2 — Cálculo (sem mudança)

| Componente | Status |
|---|---|
| `/api/calcular` | Sem mudança |
| `lib/antt.ts` | Sem mudança |
| `lib/rotas-brasil.ts` | Sem mudança — chama com eixo=6 |
| `lib/route-cache.ts` | Sem mudança |
| `variacaoCompleta` | Sem mudança — já contém 28 combinações |

---

## Seção 3 — Export

### Função

`gerarExcelPorVeiculo(linhas: LinhaFrete[]): Buffer` em `lib/excel.ts`.

Substitui `gerarExcel` e `gerarExcelModeloIA`. Remove sheet "Verificação ANTT".

### 5 abas

| Nome da Aba | Eixos | composicaoVeicular | Linha do cabeçalho |
|---|---|---|---|
| Truck | 3 | false | TRUCK (3 Eixos — Simples) |
| Bitruck | 4 | false | BITRUCK (4 Eixos — Simples) |
| Carreta Simples | 5 | true | CARRETA SIMPLES (5 Eixos — Composição) |
| Carreta Truckada | 6 | true | CARRETA TRUCKADA (6 Eixos — Composição) |
| Rodotrem | 9 | true | RODOTREM (9 Eixos — Composição) |

### Layout de cada aba

```
Row 0: ["{NOME DA ABA}", "", "", "", "", "", "", "", "", ""]   ← mesclado A:J
Row 1: ["Origem", "", "Destino", "", "", "", "", "", "", ""]   ← mesclado A:B e C:D
Row 2: ["Cidade","UF","Cidade","UF","Eixos","ANTT Sem AD","ANTT Com AD","Pedágio (ref. 6 eixos)","Total Sem AD","Total Com AD"]
Row 3+: uma linha por rota
```

### Mapeamento variacaoCompleta → colunas

Para cada aba com `(eixos, composicao)`:

| Coluna | Campo em variacaoCompleta |
|---|---|
| ANTT Sem AD | `eixos=N, composicaoVeicular=X, altoDesempenho=false` → `.antt` |
| ANTT Com AD | `eixos=N, composicaoVeicular=X, altoDesempenho=true` → `.antt` |
| Pedágio (ref. 6 eixos) | `linha.pedagio` |
| Total Sem AD | ANTT Sem AD + Pedágio |
| Total Com AD | ANTT Com AD + Pedágio |

### Tratamento de erro

Rota com `linha.erro` → todas as colunas de valor preenchidas com `"ERRO: <mensagem>"`.

Rota sem `variacaoCompleta` → colunas com `"-"`.

---

## Seção 4 — Mudanças de UI

| Elemento | Antes | Depois |
|---|---|---|
| Upload | Aceita 2 formatos (padrão / modelo IA) | Aceita 1 formato (Origem, UF, Destino, UF) |
| Tabela na tela | Grade 28 variações | Igual — sem mudança |
| Botão "Baixar Modelo" | Modelo com Cliente/Eixos | Modelo com só Origem+UF+Destino+UF |
| Botão "Exportar" | Gera grade por rota | Gera 5 abas por tipo de veículo |
| Sheet "Verificação ANTT" | Presente | Removida |

---

## O que não muda

- `lib/antt.ts`
- `lib/rotas-brasil.ts`
- `lib/route-cache.ts`
- `lib/google-maps.ts`
- `lib/pedagio.ts`
- `/api/calcular/route.ts`
- Lógica de cache (30 dias, chave `origem|destino|eixos`)
- Visualização na tela (tabela/accordion)
