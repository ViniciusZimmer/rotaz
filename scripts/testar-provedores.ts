// Execução: npx tsx scripts/testar-provedores.ts scripts/rotas-teste.csv
// Formato do CSV (com cabeçalho): origem,destino,eixos
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
