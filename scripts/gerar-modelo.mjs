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
