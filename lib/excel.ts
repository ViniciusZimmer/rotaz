import * as XLSX from 'xlsx'
import { LinhaFrete } from '@/types/frete'

const VEICULOS = [
  { nome: 'Truck',             eixos: 3, composicao: false, header: 'TRUCK (3 Eixos — Simples)' },
  { nome: 'Bitruck',           eixos: 4, composicao: false, header: 'BITRUCK (4 Eixos — Simples)' },
  { nome: 'Carreta Simples',   eixos: 5, composicao: true,  header: 'CARRETA SIMPLES (5 Eixos — Composição)' },
  { nome: 'Carreta Truckada',  eixos: 6, composicao: true,  header: 'CARRETA TRUCKADA (6 Eixos — Composição)' },
  { nome: 'Rodotrem',          eixos: 9, composicao: true,  header: 'RODOTREM (9 Eixos — Composição)' },
]

function splitCidadeUF(valor: string): [string, string] {
  const idx = valor.lastIndexOf(', ')
  if (idx === -1) return [valor, '']
  return [valor.slice(0, idx), valor.slice(idx + 2)]
}

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
