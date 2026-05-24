# Export por Tipo de Veículo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o export atual por um novo formato com 5 abas fixas (Truck/Bitruck/Carreta Simples/Carreta Truckada/Rodotrem) e simplificar o input para só Origem + UF + Destino + UF.

**Architecture:** `variacaoCompleta` já contém todos os 28 pares ANTT — o export extrai os 5 pares relevantes (eixos fixo + composição correta). Parser novo em `page.tsx` substitui `parsePadrao`/`parseModeloIA`. API `/api/calcular` e `/api/exportar` mudam minimamente.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, SheetJS (xlsx), Tailwind CSS

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `lib/excel.ts` | Adicionar `gerarExcelPorVeiculo`; atualizar `gerarExcelModelo`; remover `gerarExcel` e `gerarExcelModeloIA` |
| Modify | `app/api/exportar/route.ts` | Sempre chamar `gerarExcelPorVeiculo`, sem branching de formato |
| Modify | `scripts/gerar-modelo.mjs` | Gerar template de 4 colunas (Origem, Origem UF, Destino, Destino UF) |
| Modify | `app/(protected)/page.tsx` | Substituir parsers por `parsePorVeiculo`; remover `formato` state; remover toggle composição; atualizar `exportar()` |

---

### Task 1: gerarExcelPorVeiculo + gerarExcelModelo em lib/excel.ts

**Files:**
- Modify: `lib/excel.ts`

- [ ] **Step 1: Adicionar constante VEICULOS antes de gerarExcel**

Abrir `lib/excel.ts`. Adicionar após as constantes `VARIANTES` existentes (linha ~12):

```typescript
const VEICULOS = [
  { nome: 'Truck',             eixos: 3, composicao: false, header: 'TRUCK (3 Eixos — Simples)' },
  { nome: 'Bitruck',           eixos: 4, composicao: false, header: 'BITRUCK (4 Eixos — Simples)' },
  { nome: 'Carreta Simples',   eixos: 5, composicao: true,  header: 'CARRETA SIMPLES (5 Eixos — Composição)' },
  { nome: 'Carreta Truckada',  eixos: 6, composicao: true,  header: 'CARRETA TRUCKADA (6 Eixos — Composição)' },
  { nome: 'Rodotrem',          eixos: 9, composicao: true,  header: 'RODOTREM (9 Eixos — Composição)' },
]
```

- [ ] **Step 2: Adicionar helper splitCidadeUF**

Adicionar no final de `lib/excel.ts` (antes de `gerarExcelModelo`):

```typescript
function splitCidadeUF(valor: string): [string, string] {
  const idx = valor.lastIndexOf(', ')
  if (idx === -1) return [valor, '']
  return [valor.slice(0, idx), valor.slice(idx + 2)]
}
```

- [ ] **Step 3: Adicionar gerarExcelPorVeiculo**

Adicionar logo após `splitCidadeUF` (antes de `gerarExcelModelo`):

```typescript
export function gerarExcelPorVeiculo(linhas: LinhaFrete[]): Buffer {
  const wb = XLSX.utils.book_new()

  for (const veiculo of VEICULOS) {
    const rows: (string | number)[][] = []
    const merges: XLSX.Range[] = []

    rows.push([veiculo.header, '', '', '', '', '', '', '', '', ''])
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } })

    rows.push(['Origem', '', 'Destino', '', '', '', '', '', '', ''])
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } })
    merges.push({ s: { r: 1, c: 2 }, e: { r: 1, c: 3 } })

    rows.push([
      'Cidade', 'UF', 'Cidade', 'UF', 'Eixos',
      'ANTT Sem AD', 'ANTT Com AD', 'Pedágio (ref. 6 eixos)', 'Total Sem AD', 'Total Com AD',
    ])

    for (const linha of linhas) {
      const origemParts = splitCidadeUF(linha.origem)
      const destinoParts = splitCidadeUF(linha.destino)

      if (linha.erro) {
        rows.push([
          origemParts[0], origemParts[1],
          destinoParts[0], destinoParts[1],
          veiculo.eixos,
          `ERRO: ${linha.erro}`, `ERRO: ${linha.erro}`,
          `ERRO: ${linha.erro}`, `ERRO: ${linha.erro}`, `ERRO: ${linha.erro}`,
        ])
        continue
      }

      const semAD = linha.variacaoCompleta?.find(
        v => v.eixos === veiculo.eixos && v.composicaoVeicular === veiculo.composicao && !v.altoDesempenho
      )
      const comAD = linha.variacaoCompleta?.find(
        v => v.eixos === veiculo.eixos && v.composicaoVeicular === veiculo.composicao && v.altoDesempenho
      )

      const pedagio = linha.pedagio ?? 0
      const anttSem = semAD?.antt ?? 0
      const anttCom = comAD?.antt ?? 0

      rows.push([
        origemParts[0], origemParts[1],
        destinoParts[0], destinoParts[1],
        veiculo.eixos,
        anttSem || '-',
        anttCom || '-',
        pedagio || '-',
        anttSem && pedagio ? Math.round((anttSem + pedagio) * 100) / 100 : '-',
        anttCom && pedagio ? Math.round((anttCom + pedagio) * 100) / 100 : '-',
      ])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!merges'] = merges
    ws['!cols'] = [
      { wch: 28 }, { wch: 5  }, { wch: 28 }, { wch: 5  }, { wch: 6  },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, veiculo.nome)
  }

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
```

- [ ] **Step 4: Atualizar gerarExcelModelo**

Substituir a função `gerarExcelModelo` existente por:

```typescript
export function gerarExcelModelo(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Origem', 'Origem UF', 'Destino', 'Destino UF'],
    ['São Paulo', 'SP', 'Curitiba', 'PR'],
    ['São Paulo', 'SP', 'Porto Alegre', 'RS'],
    ['São Paulo', 'SP', 'Florianópolis', 'SC'],
    ['São Paulo', 'SP', 'Belo Horizonte', 'MG'],
    ['São Paulo', 'SP', 'Rio de Janeiro', 'RJ'],
  ])
  ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 24 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rotas')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
```

- [ ] **Step 5: Remover gerarExcel e gerarExcelModeloIA**

Apagar as funções `gerarExcel` (linhas ~115–135) e `gerarExcelModeloIA` (linhas ~138–158). Manter `buildGrade`, `buildVerificacao`, `brl` também podem ser removidos se não usados mais.

Verificar: `buildGrade` e `buildVerificacao` só são usados por `gerarExcel`/`gerarExcelModeloIA`. Com esses removidos, remover também `buildGrade`, `buildVerificacao`, `brl`, `VER_COLS`, `VARIANTES`, `FONTE_LABELS`, `CONFIANCA_LABELS`, `EIXOS`.

- [ ] **Step 6: Checar compilação**

```bash
npx tsc --noEmit
```

Esperado: 0 erros (exceto erros em outros arquivos que importam `gerarExcel`/`gerarExcelModeloIA` — esses serão corrigidos na Task 2).

- [ ] **Step 7: Commit**

```bash
git add lib/excel.ts
git commit -m "feat: add gerarExcelPorVeiculo with 5 vehicle-type sheets"
```

---

### Task 2: Atualizar /api/exportar/route.ts

**Files:**
- Modify: `app/api/exportar/route.ts`

- [ ] **Step 1: Substituir conteúdo do arquivo**

Substituir todo o conteúdo de `app/api/exportar/route.ts` por:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { gerarExcelPorVeiculo } from '@/lib/excel'
import { LinhaFrete } from '@/types/frete'

export async function POST(req: NextRequest) {
  const linhas: LinhaFrete[] = await req.json()

  const buffer = gerarExcelPorVeiculo(linhas)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tabela_frete.xlsx"',
    },
  })
}
```

- [ ] **Step 2: Checar compilação**

```bash
npx tsc --noEmit
```

Esperado: 0 erros neste arquivo.

- [ ] **Step 3: Commit**

```bash
git add app/api/exportar/route.ts
git commit -m "feat: exportar route always calls gerarExcelPorVeiculo"
```

---

### Task 3: Atualizar scripts/gerar-modelo.mjs + regenerar public/modelo.xlsx

**Files:**
- Modify: `scripts/gerar-modelo.mjs`

- [ ] **Step 1: Substituir conteúdo do script**

Substituir todo o conteúdo de `scripts/gerar-modelo.mjs` por:

```javascript
import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const rows = [
  ['Origem', 'Origem UF', 'Destino', 'Destino UF'],
  ['São Paulo', 'SP', 'Curitiba', 'PR'],
  ['São Paulo', 'SP', 'Porto Alegre', 'RS'],
  ['São Paulo', 'SP', 'Florianópolis', 'SC'],
  ['São Paulo', 'SP', 'Belo Horizonte', 'MG'],
  ['São Paulo', 'SP', 'Rio de Janeiro', 'RJ'],
]

const ws = XLSX.utils.aoa_to_sheet(rows)
ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 24 }, { wch: 10 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Rotas')

const out = resolve(__dirname, '../public/modelo.xlsx')
mkdirSync(resolve(__dirname, '../public'), { recursive: true })
writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

console.log(`Arquivo gerado: ${out}`)
```

- [ ] **Step 2: Regenerar public/modelo.xlsx**

```bash
node scripts/gerar-modelo.mjs
```

Esperado: `Arquivo gerado: .../public/modelo.xlsx`

- [ ] **Step 3: Commit**

```bash
git add scripts/gerar-modelo.mjs public/modelo.xlsx
git commit -m "feat: update modelo.xlsx to 4-column format (Origem, Origem UF, Destino, Destino UF)"
```

---

### Task 4: Atualizar app/(protected)/page.tsx

**Files:**
- Modify: `app/(protected)/page.tsx`

Esta task tem mais partes porque envolve remover estado, parsers e UI.

- [ ] **Step 1: Remover tipo FormatoExcel e imports não usados**

Remover a linha:

```typescript
type FormatoExcel = 'padrao' | 'modeloIA'
```

- [ ] **Step 2: Remover parsePadrao e parseModeloIA; adicionar parsePorVeiculo**

Remover as funções `parsePadrao` (linhas ~101–110) e `parseModeloIA` (linhas ~78–99).

Adicionar no lugar delas:

```typescript
function parsePorVeiculo(rows: Record<string, string | number>[]): LinhaFrete[] {
  return rows
    .filter(row => String(row['Origem'] ?? '').trim() !== '')
    .map((row): LinhaFrete => {
      const origemCidade = String(row['Origem'] ?? '').trim()
      const origemUF = String(row['Origem UF'] ?? '').trim()
      const destCidade = String(row['Destino'] ?? '').trim()
      const destUF = String(row['Destino UF'] ?? '').trim()

      return {
        cliente: '',
        origem: origemUF ? `${origemCidade}, ${origemUF}` : origemCidade,
        destino: destUF ? `${destCidade}, ${destUF}` : destCidade,
        uf: destUF,
        eixos: 6,
        status: 'pendente',
      }
    })
}
```

- [ ] **Step 3: Remover estado formato e composicaoVeicular**

No componente `Home`, remover:

```typescript
const [formato, setFormato] = useState<FormatoExcel>('padrao')
const [composicaoVeicular, setComposicaoVeicular] = useState(false)
```

- [ ] **Step 4: Atualizar onUpload**

Substituir a função `onUpload` por:

```typescript
async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setErro('')

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })
  const parsed = parsePorVeiculo(rows)
  setLinhas(parsed)
  setStatus('idle')
}
```

- [ ] **Step 5: Atualizar calcular**

Substituir a função `calcular` por:

```typescript
async function calcular() {
  if (!linhas.length) return
  setStatus('calculando')
  setErro('')

  try {
    const res = await fetch('/api/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linhas),
    })
    const resultado: LinhaFrete[] = await res.json()
    setLinhas(resultado)
    setStatus('pronto')
    salvarCotacao(resultado, 'padrao').catch(console.error)
  } catch {
    setErro('Falha ao calcular. Tente novamente.')
    setStatus('idle')
  }
}
```

- [ ] **Step 6: Atualizar exportar**

Substituir a função `exportar` por:

```typescript
async function exportar() {
  const res = await fetch('/api/exportar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(linhas),
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tabela_frete.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 7: Atualizar limpar**

Substituir a função `limpar` por:

```typescript
function limpar() {
  setLinhas([])
  setStatus('idle')
  setErro('')
  if (fileRef.current) fileRef.current.value = ''
}
```

- [ ] **Step 8: Remover botões de formato e toggle composição do JSX**

Na zona de upload, remover o bloco com os dois botões de formato:

```tsx
<div className="flex items-center gap-3 mt-2">
  <button
    onClick={() => setFormato('padrao')}
    ...
  >
    Formato padrão
  </button>
  <button
    onClick={() => setFormato('modeloIA')}
    ...
  >
    Formato IA
  </button>
</div>
```

Na action bar, remover o toggle de composição veicular e o separador que vem depois:

```tsx
<label className="flex items-center gap-2 cursor-pointer select-none mr-2">
  <div
    onClick={() => setComposicaoVeicular(v => !v)}
    ...
  >
    ...
  </div>
  <span className="text-sm text-slate-400">Composição Veicular</span>
  {composicaoVeicular && <span className="text-xs text-sky-400">Tabela B</span>}
</label>

<div className="w-px h-5 bg-gray-700 hidden sm:block" />
```

- [ ] **Step 9: Remover badge "formato IA" na barra de arquivo carregado**

Na barra que mostra o arquivo carregado (quando `linhas.length > 0`), remover:

```tsx
{formato === 'modeloIA' && <span className="ml-2 text-sky-400 text-xs">formato IA</span>}
```

- [ ] **Step 10: Remover variável temCliente e colunas do cliente na tabela**

`temCliente` ficou definido mas sem uso agora que o novo parser nunca define `cliente`. Remover:

```typescript
const temCliente = linhas.some((l) => l.cliente)
```

E remover no JSX da tabela:
- `{temCliente && <th className="px-4 py-3 font-medium">Cliente</th>}`
- `{temCliente && <td ...>{linha.cliente}</td>}` (na linha de dados)

Substituir `const cols = temCliente ? 10 : 9` por:

```typescript
const cols = 9
```

(9 colunas: Origem, Destino, Eixos, KM, Pedágio, Fonte, ANTT, Frete Total, Status)

- [ ] **Step 11: Checar compilação**

```bash
npx tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Step 12: Subir servidor dev e testar manualmente**

```bash
npm run dev
```

Teste manual:
1. Acessar `http://localhost:3000`
2. Baixar modelo pelo link "Baixar modelo Excel →" — deve ter 4 colunas: Origem, Origem UF, Destino, Destino UF
3. Fazer upload do modelo baixado — deve aparecer as rotas na lista
4. Clicar "Calcular KM · Pedágio · ANTT" — deve calcular normalmente
5. Clicar "Exportar Excel ↓" — deve baixar `tabela_frete.xlsx` com 5 abas: Truck, Bitruck, Carreta Simples, Carreta Truckada, Rodotrem
6. Verificar em cada aba: colunas ANTT Sem AD, ANTT Com AD, Pedágio (ref. 6 eixos), Total Sem AD, Total Com AD com valores preenchidos

- [ ] **Step 13: Commit**

```bash
git add app/(protected)/page.tsx
git commit -m "feat: replace parsers with parsePorVeiculo, remove formato/composicao state and UI"
```
