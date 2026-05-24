import * as XLSX from 'xlsx'
import { LinhaFrete } from '@/types/frete'
import { getCoeficientes, TIPOS_CARGA } from './antt'

const EIXOS = [2, 3, 4, 5, 6, 7, 9]

const VARIANTES = [
  { label: 'Simples',        composicao: false, alto: false },
  { label: 'Simples + AD',   composicao: false, alto: true  },
  { label: 'Composição',     composicao: true,  alto: false },
  { label: 'Comp. + AD',     composicao: true,  alto: true  },
]

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

function brl(valor: number | undefined): string {
  if (valor == null) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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

const VER_COLS = [
  { wch: 22 }, { wch: 22 }, { wch: 6  }, { wch: 6  }, { wch: 12 }, { wch: 16 },
  { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 32 }, { wch: 16 },
]

// Formato padrão
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
  wsVer['!cols'] = VER_COLS

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Frete')
  XLSX.utils.book_append_sheet(wb, wsVer, 'Verificação ANTT')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// Formato Modelo IA
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
  wsVer['!cols'] = VER_COLS

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Frete')
  XLSX.utils.book_append_sheet(wb, wsVer, 'Verificação ANTT')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

export function gerarExcelModelo(): Buffer {
  const modelo = [
    { Cliente: 'Empresa A', Origem: 'São Paulo/SP', Destino: 'Curitiba/PR',       UF: 'PR', Eixos: 6 },
    { Cliente: 'Empresa A', Origem: 'São Paulo/SP', Destino: 'Porto Alegre/RS',   UF: 'RS', Eixos: 6 },
    { Cliente: 'Empresa B', Origem: 'São Paulo/SP', Destino: 'Rio de Janeiro/RJ', UF: 'RJ', Eixos: 6 },
    { Cliente: 'Empresa B', Origem: 'São Paulo/SP', Destino: 'Belo Horizonte/MG', UF: 'MG', Eixos: 6 },
  ]

  const ws = XLSX.utils.json_to_sheet(modelo)
  const wb = XLSX.utils.book_new()
  ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 6 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Frete')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
