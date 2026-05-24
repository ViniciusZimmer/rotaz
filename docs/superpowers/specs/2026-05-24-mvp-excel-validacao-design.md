# MVP Excel + Validação ANTT — Design Spec

> **For agentic workers:** Use superpowers:writing-plans to implement this spec.

**Goal:** Transformar o Excel exportado em output confiável e completo (2 abas) e adicionar 4 melhorias mínimas de UI que aumentam a confiança nos cálculos sem redesign.

**Architecture:** Mudanças concentradas em `lib/excel.ts` (nova Sheet 2 + header enriquecido), pequena extensão de `lib/antt.ts` (expor coeficientes), e ajustes pontuais em `app/(protected)/page.tsx` (banner, erros, fórmula no accordion, label botão).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, xlsx (SheetJS), Tailwind CSS

---

## Contexto

O sistema atual gera um Excel com 1 aba (Tabela de Frete) contendo grade de variações ANTT. Problemas:
- Header da rota não mostra qual provedor gerou os dados nem nível de confiança
- Valores na grade não têm formatação BRL consistente
- Não existe forma de verificar a fórmula ANTT sem acesso à resolução oficial
- Erros na UI mostram apenas "erro" sem mensagem real
- Sem resumo pós-cálculo de quantas rotas usaram cada provedor

---

## Mudanças

### 1. `lib/antt.ts` — Expor coeficientes

Adicionar função exportada:

```typescript
export function getCoeficientes(
  eixos: number,
  composicao: boolean,
  alto: boolean,
  tipoCarga: TipoCarga = 'carga_geral'
): { ccd: number; cc: number } | null
```

Retorna `{ ccd, cc }` da tabela correspondente, ou `null` se eixos não existir na tabela. Usado pelo Excel (Sheet 2) e pela UI (accordion).

### 2. `lib/excel.ts` — Sheet 1 melhorada + Sheet 2 nova

**Sheet 1 — Tabela de Frete (melhorada):**

Header da rota ampliado para 6 colunas (de 5):

```
São Paulo, SP → Curitiba, PR  |  523 km  |  Pedágio ref. 6 eixos: R$ 142,50  |  HERE ● Alta  |  24/05/2026
```

Coluna extra no header = coluna de data/fonte. `buildGrade` recebe `fonte`, `confianca`, `km`, `pedagio` explicitamente.

Valores na grade: formatados como BRL string (mantém comportamento atual via `brl()`).

Erros: linha única `ERRO: <mensagem real>` (já funciona, garantir que `erro` seja passado).

**Sheet 2 — Verificação ANTT (nova):**

Uma linha por rota × eixo × variante (28 linhas por rota). Colunas:

| Origem | Destino | KM | Eixos | Composição | Alto Desempenho | Tipo Carga | CCD | CC | Fórmula | ANTT Calculado |
|---|---|---|---|---|---|---|---|---|---|---|
| São Paulo, SP | Curitiba, PR | 523 | 6 | Não | Não | Carga Geral | 6,6896 | 588,17 | 6,6896 × 523 + 588,17 | R$ 3.088,04 |

- Coluna "Fórmula" é string: `"CCD × KM + CC"` com valores substituídos
- Coluna "ANTT Calculado" é número (para filtros/ordenação no Excel)
- Cabeçalho fixado na linha 1 (freeze pane)
- Larguras de coluna ajustadas para leitura

**Assinatura das funções:**

```typescript
export function gerarExcel(linhas: LinhaFrete[]): Buffer        // retorna workbook com 2 sheets
export function gerarExcelModeloIA(linhas: LinhaFrete[]): Buffer // retorna workbook com 2 sheets
```

Interface interna atualizada:
```typescript
// buildGrade recebe campos extras opcionais
function buildGrade(
  rows: (string | number)[][],
  merges: XLSX.Range[],
  linha: LinhaFrete  // passa o objeto completo para extrair fonte/confiança
): void
```

```typescript
// buildVerificacao gera array de linhas para Sheet 2
function buildVerificacao(linhas: LinhaFrete[]): (string | number)[][]
```

### 3. `app/(protected)/page.tsx` — 4 mudanças UI

**Mudança A — Banner de resumo pós-cálculo**

Exibir após `status === 'pronto'`, acima da tabela. Computado de `linhas`:

```
✓ 12 rotas calculadas  ·  HERE: 10  Rotas Brasil: 2  ·  Alta: 10  Média: 2  Baixa: 0
```

Implementação: função `calcularResumo(linhas)` retorna `{ total, porFonte, porConfianca }`. Renderizado como `<div>` com badges coloridos.

**Mudança B — Mensagens de erro reais**

Trocar:
```tsx
{linha.status === 'erro' && <span className="text-red-400 text-xs" title={linha.erro}>erro</span>}
```
Por:
```tsx
{linha.status === 'erro' && (
  <span className="text-red-400 text-xs" title={linha.erro}>
    {linha.erro ? `erro: ${linha.erro.slice(0, 40)}` : 'erro'}
  </span>
)}
```

**Mudança C — Fórmula ANTT no accordion**

No accordion expandido, abaixo da grade de variações, adicionar seção:

```
Fórmula ANTT (eixos do arquivo: 6, Simples, Carga Geral)
6,6896 × 523 km + 588,17 = R$ 3.088,04
```

Implementação: importar `getCoeficientes` de `lib/antt.ts` no componente. Para a linha `linha.eixos`, variante Simples (`composicaoVeicular=false`, `altoDesempenho=false`), tipo carga da linha (default `carga_geral`), exibir CCD, CC e resultado. Nota: valor já consta em `variacaoCompleta`, a fórmula é só transparência.

**Mudança D — Label do botão exportar**

```tsx
// antes
'Exportar Excel'
// depois
'Exportar Excel (Tabela + Verificação ANTT)'
```

---

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `lib/antt.ts` | Adicionar `getCoeficientes()` export |
| `lib/excel.ts` | Sheet 1 header enriquecido, Sheet 2 nova |
| `app/(protected)/page.tsx` | Banner, erros, fórmula accordion, label botão |
| `app/api/exportar/route.ts` | Sem mudança (já chama gerarExcel que retorna workbook) |

---

## O que NÃO está no escopo

- Formatação colorida/estilizada no Excel (xlsx básico, sem cores)
- Logo ou cabeçalho institucional no Excel
- Sheet separada por cliente
- Comparação de provedores no Excel (já existe na UI)
- Tipo de carga customizável por rota (usa default `carga_geral`)
- Mudança no formato ModeloIA (mesmo comportamento, só ganha Sheet 2)
