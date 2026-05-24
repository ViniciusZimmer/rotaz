# MVP Excel + Validação ANTT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Sheet 2 "Verificação ANTT" ao Excel exportado (fórmula CCD×KM+CC por rota/variante), melhorar header da Sheet 1, e adicionar 4 melhorias de UI: banner de resumo pós-cálculo, erros reais, fórmula ANTT no accordion, label do botão exportar.

**Architecture:** `lib/antt.ts` expõe `getCoeficientes()` para reutilização; `lib/excel.ts` constrói workbook com 2 abas usando SheetJS (xlsx); `app/(protected)/page.tsx` adiciona resumo e formula inline, importando `getCoeficientes` e `TIPOS_CARGA` de `lib/antt.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, xlsx (SheetJS), Tailwind CSS

---

## File Map

| Ação | Arquivo | O que muda |
|------|---------|-----------|
| Modify | `lib/antt.ts` | Exportar `getCoeficientes()` |
| Modify | `lib/excel.ts` | Header Sheet 1 enriquecido + Sheet 2 nova |
| Modify | `app/(protected)/page.tsx` | Banner resumo, erros reais, fórmula accordion, label botão |

---

### Task 1: getCoeficientes em lib/antt.ts

**Files:**
- Modify: `lib/antt.ts`

- [ ] **Step 1: Adicionar `getCoeficientes` após `calcularANTT`**

Inserir após a função `calcularANTT` (linha 325), antes de `export const EIXOS_LISTA`:

```typescript
export function getCoeficientes(
  eixos: number,
  composicao: boolean,
  alto: boolean,
  tipoCarga: TipoCarga = 'carga_geral'
): { ccd: number; cc: number } | null {
  const tabela = selecionarTabela(composicao, alto)
  const eixosAdj = ajustarEixos(eixos)
  return tabela[eixosAdj]?.[tipoCarga] ?? tabela[eixosAdj]?.carga_geral ?? null
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/antt.ts
git commit -m "feat: export getCoeficientes from lib/antt"
```

---

### Task 2: lib/excel.ts — Sheet 1 melhorada + Sheet 2 nova

**Files:**
- Modify: `lib/excel.ts`

Contexto: arquivo atual tem ~109 linhas. `buildGrade` recebe `header` como array externo; `gerarExcel` e `gerarExcelModeloIA` montam o header fora. As mudanças: (a) enriquecer header com fonte/confiança/data, (b) adicionar `buildVerificacao` que gera Sheet 2, (c) ambas as funções de export retornam workbook com 2 sheets.

- [ ] **Step 1: Atualizar imports em `lib/excel.ts`**

Adicionar import de antt no topo do arquivo, após o import de `LinhaFrete`:

```typescript
import { getCoeficientes, TIPOS_CARGA } from './antt'
```

- [ ] **Step 2: Adicionar constantes de label no topo (após os imports)**

Adicionar após os imports, antes de `const EIXOS`:

```typescript
const FONTE_LABELS: Record<string, string> = {
  here: 'HERE',
  tomtom: 'TomTom',
  'rotas-brasil': 'Rotas Brasil',
  'banco-proprio': 'Banco Próprio',
  estimativa: 'Estimativa',
}

const CONFIANCA_LABELS: Record<string, string> = {
  alta: '● Alta',
  media: '● Média',
  baixa: '● Baixa',
}
```

- [ ] **Step 3: Substituir `buildGrade` para receber `LinhaFrete` completo**

Substituir a função `buildGrade` inteira (linhas 18-49) por:

```typescript
function buildGrade(
  rows: (string | number)[][],
  merges: XLSX.Range[],
  linha: LinhaFrete
) {
  const r = rows.length

  const fonteStr = linha.fonte
    ? ` | ${FONTE_LABELS[linha.fonte] ?? linha.fonte}${linha.confianca ? ' ' + (CONFIANCA_LABELS[linha.confianca] ?? '') : ''}`
    : ''
  const data = new Date().toLocaleDateString('pt-BR')
  const header = `${linha.origem}  →  ${linha.destino}${linha.cliente ? `  |  ${linha.cliente}` : ''}  ·  ${linha.km ?? '?'} km  ·  Pedágio ref. 6 eixos: ${brl(linha.pedagio)}${fonteStr}  ·  ${data}`

  rows.push([header, '', '', '', ''])
  rows.push(['Eixos (ANTT)', 'Simples', 'Simples + AD', 'Composição', 'Comp. + AD'])

  if (linha.variacaoCompleta?.length) {
    for (const e of EIXOS) {
      const itens = VARIANTES.map(v =>
        linha.variacaoCompleta!.find(x => x.eixos === e && x.composicaoVeicular === v.composicao && x.altoDesempenho === v.alto)
      )
      rows.push([`${e} eixos`, ...itens.map(x => x?.antt ?? '-')])
    }
  } else {
    rows.push([linha.erro ? `ERRO: ${linha.erro}` : 'Sem dados'])
  }

  rows.push([])
  merges.push({ s: { r, c: 0 }, e: { r, c: 4 } })
}
```

- [ ] **Step 4: Adicionar função `buildVerificacao` após `buildGrade`**

```typescript
function buildVerificacao(linhas: LinhaFrete[]): (string | number)[][] {
  const headers = [
    'Origem', 'Destino', 'KM', 'Eixos', 'Composição', 'Alto Desempenho',
    'Tipo Carga', 'CCD', 'CC', 'Fórmula', 'ANTT Calculado',
  ]
  const rows: (string | number)[][] = [headers]

  const VARIANTES_VER = [
    { label: 'Simples',      composicao: false, alto: false },
    { label: 'Simples + AD', composicao: false, alto: true  },
    { label: 'Composição',   composicao: true,  alto: false },
    { label: 'Comp. + AD',   composicao: true,  alto: true  },
  ]

  for (const l of linhas) {
    if (!l.variacaoCompleta?.length || !l.km) continue
    const tipoCarga = l.tipoCarga ?? 'carga_geral'
    const tipoCargaLabel = TIPOS_CARGA[tipoCarga]

    for (const e of EIXOS) {
      for (const v of VARIANTES_VER) {
        const coef = getCoeficientes(e, v.composicao, v.alto, tipoCarga)
        if (!coef) continue
        const antt = Math.round((l.km * coef.ccd + coef.cc) * 100) / 100
        const formula = `${coef.ccd.toFixed(4)} × ${l.km} + ${coef.cc.toFixed(2)}`
        rows.push([
          l.origem,
          l.destino,
          l.km,
          e,
          v.composicao ? 'Sim' : 'Não',
          v.alto ? 'Sim' : 'Não',
          tipoCargaLabel,
          coef.ccd,
          coef.cc,
          formula,
          antt,
        ])
      }
    }
  }

  return rows
}
```

- [ ] **Step 5: Atualizar `gerarExcel` para usar nova assinatura e 2 sheets**

Substituir a função `gerarExcel` inteira (linhas 52-68) por:

```typescript
export function gerarExcel(linhas: LinhaFrete[]): Buffer {
  const rows: (string | number)[][] = []
  const merges: XLSX.Range[] = []

  for (const l of linhas) {
    buildGrade(rows, merges, l)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 55 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }]

  const verRows = buildVerificacao(linhas)
  const wsVer = XLSX.utils.aoa_to_sheet(verRows)
  wsVer['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 6  }, { wch: 6  }, { wch: 12 }, { wch: 16 },
    { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 32 }, { wch: 16 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Frete')
  XLSX.utils.book_append_sheet(wb, wsVer, 'Verificação ANTT')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
```

- [ ] **Step 6: Atualizar `gerarExcelModeloIA` para usar nova assinatura e 2 sheets**

Substituir a função `gerarExcelModeloIA` inteira (linhas 71-93) por:

```typescript
export function gerarExcelModeloIA(linhas: LinhaFrete[]): Buffer {
  const rows: (string | number)[][] = []
  const merges: XLSX.Range[] = []

  for (const l of linhas) {
    buildGrade(rows, merges, l)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 55 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }]

  const verRows = buildVerificacao(linhas)
  const wsVer = XLSX.utils.aoa_to_sheet(verRows)
  wsVer['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 6  }, { wch: 6  }, { wch: 12 }, { wch: 16 },
    { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 32 }, { wch: 16 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Frete')
  XLSX.utils.book_append_sheet(wb, wsVer, 'Verificação ANTT')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
```

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add lib/excel.ts
git commit -m "feat: add Sheet 2 Verificação ANTT and enrich Sheet 1 header"
```

---

### Task 3: app/(protected)/page.tsx — 4 melhorias de UI

**Files:**
- Modify: `app/(protected)/page.tsx`

Contexto: arquivo cliente com ~490 linhas após edições anteriores. Fazer as mudanças em sequência.

- [ ] **Step 1: Adicionar imports de lib/antt**

Na linha dos imports existentes de `@/types/routing`, adicionar nova linha de import após os imports de actions:

```typescript
import { getCoeficientes, TIPOS_CARGA } from '@/lib/antt'
```

- [ ] **Step 2: Adicionar função `calcularResumo` fora do componente**

Adicionar após as funções `badgeConfianca` e `labelFonte` (antes de `parseModeloIA`):

```typescript
function calcularResumo(linhas: LinhaFrete[]) {
  const ok = linhas.filter(l => l.status === 'ok')
  const porFonte: Partial<Record<ProviderFonte, number>> = {}
  const porConfianca = { alta: 0, media: 0, baixa: 0 }
  for (const l of ok) {
    if (l.fonte) porFonte[l.fonte] = (porFonte[l.fonte] ?? 0) + 1
    if (l.confianca) porConfianca[l.confianca]++
  }
  return { total: ok.length, porFonte, porConfianca }
}
```

- [ ] **Step 3: Adicionar banner de resumo pós-cálculo**

Adicionar um novo `<div>` entre o bloco de `{linhas.length > 0 && ( <div ... "2. Calcular"> )}` e o bloco da tabela `{linhas.length > 0 && ( <div ... overflow-hidden> )}`.

O novo bloco (inserir entre os dois `{linhas.length > 0 && (...)}` existentes):

```tsx
        {status === 'pronto' && linhas.length > 0 && (() => {
          const resumo = calcularResumo(linhas)
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-green-400 font-medium">
                ✓ {resumo.total} rota{resumo.total !== 1 ? 's' : ''} calculada{resumo.total !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-600">|</span>
              {(Object.entries(resumo.porFonte) as [ProviderFonte, number][]).map(([fonte, count]) => (
                <span key={fonte} className="text-gray-400">{labelFonte(fonte)}: {count}</span>
              ))}
              <span className="text-gray-600">|</span>
              {resumo.porConfianca.alta > 0 && (
                <span className="text-green-500 text-xs">● Alta: {resumo.porConfianca.alta}</span>
              )}
              {resumo.porConfianca.media > 0 && (
                <span className="text-yellow-500 text-xs">● Média: {resumo.porConfianca.media}</span>
              )}
              {resumo.porConfianca.baixa > 0 && (
                <span className="text-red-500 text-xs">● Baixa: {resumo.porConfianca.baixa}</span>
              )}
            </div>
          )
        })()}
```

- [ ] **Step 4: Melhorar exibição de erros na tabela**

Encontrar a linha:
```tsx
{linha.status === 'erro' && <span className="text-red-400 text-xs" title={linha.erro}>erro</span>}
```

Substituir por:
```tsx
{linha.status === 'erro' && (
  <span className="text-red-400 text-xs" title={linha.erro ?? 'erro'}>
    {linha.erro ? `${linha.erro.slice(0, 35)}${linha.erro.length > 35 ? '…' : ''}` : 'erro'}
  </span>
)}
```

- [ ] **Step 5: Adicionar fórmula ANTT no accordion**

No accordion detail row, após a `</table>` da tabela de variações ANTT (última tabela no accordion, com `<th>Simples</th><th>Simples + AD</th>...`), adicionar antes da `</td>` de fechamento:

```tsx
                              {/* Fórmula ANTT */}
                              {linha.km && (() => {
                                const tipoCarga = linha.tipoCarga ?? 'carga_geral'
                                const simplesCoef = getCoeficientes(linha.eixos, false, false, tipoCarga)
                                const compoCoef = getCoeficientes(linha.eixos, true, false, tipoCarga)
                                if (!simplesCoef) return null
                                return (
                                  <div className="mt-4 pt-3 border-t border-gray-800">
                                    <p className="text-xs text-gray-500 font-medium mb-1">
                                      Fórmula ANTT — {linha.km} km · {TIPOS_CARGA[tipoCarga]}
                                    </p>
                                    <p className="text-xs text-gray-600 font-mono">
                                      Simples ({linha.eixos} eixos): {simplesCoef.ccd.toFixed(4)} × {linha.km} + {simplesCoef.cc.toFixed(2)} = {formatBRL(Math.round((simplesCoef.ccd * linha.km + simplesCoef.cc) * 100) / 100)}
                                    </p>
                                    {compoCoef && (
                                      <p className="text-xs text-gray-600 font-mono mt-0.5">
                                        Composição ({linha.eixos} eixos): {compoCoef.ccd.toFixed(4)} × {linha.km} + {compoCoef.cc.toFixed(2)} = {formatBRL(Math.round((compoCoef.ccd * linha.km + compoCoef.cc) * 100) / 100)}
                                      </p>
                                    )}
                                  </div>
                                )
                              })()}
```

- [ ] **Step 6: Atualizar label do botão exportar**

Encontrar:
```tsx
                  Exportar Excel
```
(dentro do botão `onClick={exportar}`)

Substituir por:
```tsx
                  Exportar Excel (Tabela + Verificação ANTT)
```

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add "app/(protected)/page.tsx"
git commit -m "feat: add calc summary banner, ANTT formula in accordion, better errors"
```

---

## Self-Review

**Spec coverage:**
- [x] `getCoeficientes()` export → Task 1
- [x] Sheet 1 header com fonte/confiança/data → Task 2 Step 3
- [x] Sheet 2 Verificação ANTT com CCD/CC/Fórmula → Task 2 Steps 4-6
- [x] Banner resumo pós-cálculo → Task 3 Steps 2-3
- [x] Erros reais na tabela → Task 3 Step 4
- [x] Fórmula ANTT no accordion → Task 3 Step 5
- [x] Label botão exportar → Task 3 Step 6

**Placeholder scan:** Limpo.

**Type consistency:**
- `getCoeficientes(eixos, composicao, alto, tipoCarga)` definido em Task 1, usado em Task 2 Step 4 (`buildVerificacao`) e Task 3 Step 5 (accordion) — assinatura idêntica ✓
- `TIPOS_CARGA: Record<TipoCarga, string>` importado de `lib/antt` em Task 2 Step 1 e Task 3 Step 1 — mesmo import path ✓
- `buildGrade(rows, merges, linha: LinhaFrete)` nova assinatura em Task 2 Step 3, usada em Steps 5 e 6 — consistente ✓
- `calcularResumo` retorna `{ total, porFonte, porConfianca }` — usado diretamente em Step 3 ✓
