'use client'

import React, { useState, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import { LinhaFrete } from '@/types/frete'
import { salvarCotacao } from '@/lib/actions/cotacao'

type StatusGlobal = 'idle' | 'calculando' | 'pronto'
type FormatoExcel = 'padrao' | 'modeloIA'

function formatBRL(valor?: number) {
  if (valor == null) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseModeloIA(rows: Record<string, string | number>[]): LinhaFrete[] {
  const dados = String(rows[0]?.['Origem'] ?? '').toLowerCase() === 'cidade' ? rows.slice(1) : rows

  return dados
    .filter((row) => String(row['Origem'] ?? '').trim() !== '')
    .map((row): LinhaFrete => {
      const origemCidade = String(row['Origem'] ?? '').trim()
      const origemUF = String(row['__EMPTY'] ?? '').trim()
      const destRaw = String(row['Destino'] ?? '').trim()
      const destUF = String(row['__EMPTY_1'] ?? '').trim()
      const destCidade = destRaw.replace(/\s*-\s*[A-Z]{2}$/, '').trim()

      return {
        cliente: '',
        origem: origemUF ? `${origemCidade}, ${origemUF}` : origemCidade,
        destino: destUF ? `${destCidade}, ${destUF}` : destCidade,
        uf: destUF,
        eixos: Number(row['__EMPTY_2'] ?? 6),
        status: 'pendente',
      }
    })
}

function parsePadrao(rows: Record<string, string | number>[]): LinhaFrete[] {
  return rows.map((row): LinhaFrete => ({
    cliente: String(row['Cliente'] ?? row['cliente'] ?? ''),
    origem: String(row['Origem'] ?? row['origem'] ?? ''),
    destino: String(row['Destino'] ?? row['destino'] ?? ''),
    uf: String(row['UF'] ?? row['uf'] ?? ''),
    eixos: Number(row['Eixos'] ?? row['eixos'] ?? 2),
    status: 'pendente',
  }))
}

export default function Home() {
  const [linhas, setLinhas] = useState<LinhaFrete[]>([])
  const [status, setStatus] = useState<StatusGlobal>('idle')
  const [erro, setErro] = useState('')
  const [formato, setFormato] = useState<FormatoExcel>('padrao')
  const [composicaoVeicular, setComposicaoVeicular] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro('')

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })

    const isModeloIA = rows.length > 0 && !('Cliente' in rows[0]) && !('cliente' in rows[0]) && 'Origem' in rows[0]

    const parsed = isModeloIA ? parseModeloIA(rows) : parsePadrao(rows)
    setFormato(isModeloIA ? 'modeloIA' : 'padrao')
    setLinhas(parsed)
    setStatus('idle')
  }

  async function calcular() {
    if (!linhas.length) return
    setStatus('calculando')
    setErro('')

    try {
      const res = await fetch('/api/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linhas.map(l => ({ ...l, composicaoVeicular }))),
      })
      const resultado: LinhaFrete[] = await res.json()
      setLinhas(resultado)
      setStatus('pronto')
      salvarCotacao(resultado, formato).catch(console.error)
    } catch {
      setErro('Falha ao calcular. Tente novamente.')
      setStatus('idle')
    }
  }

  async function exportar() {
    const res = await fetch('/api/exportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linhas, formato }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = formato === 'modeloIA' ? 'tabela_frete_preenchida.xlsx' : 'tabela_frete_calculada.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  function limpar() {
    setLinhas([])
    setStatus('idle')
    setErro('')
    setFormato('padrao')
    if (fileRef.current) fileRef.current.value = ''
  }

  const clientes = [...new Set(linhas.map((l) => l.cliente))].filter(Boolean)
  const totalOk = linhas.filter((l) => l.status === 'ok').length
  const totalErro = linhas.filter((l) => l.status === 'erro').length
  const temCliente = linhas.some((l) => l.cliente)

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calculadora de Frete</h1>
          <p className="text-sm text-gray-400 mt-0.5">KM · Pedágio · ANTT automático</p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/api/modelo"
            className="text-sm text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-1.5 rounded transition"
          >
            Baixar modelo Excel
          </a>
          <UserButton />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-300 mb-4">1. Importar tabela</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded transition">
              Selecionar Excel
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={onUpload}
              />
            </label>
            {linhas.length > 0 && (
              <span className="text-sm text-gray-400">
                {linhas.length} linhas
                {clientes.length > 0 && ` · ${clientes.length} clientes`}
                {formato === 'modeloIA' && (
                  <span className="ml-2 text-blue-400 text-xs">formato IA</span>
                )}
              </span>
            )}
            {linhas.length > 0 && (
              <button onClick={limpar} className="text-sm text-gray-500 hover:text-gray-300 transition">
                Limpar
              </button>
            )}
          </div>
        </div>

        {linhas.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-300 mb-4">2. Calcular</h2>
            <div className="flex items-center gap-4 flex-wrap mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setComposicaoVeicular(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${composicaoVeicular ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${composicaoVeicular ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-gray-300">Composição Veicular</span>
                {composicaoVeicular && <span className="text-xs text-blue-400">Tabela B</span>}
              </label>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={calcular}
                disabled={status === 'calculando'}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition flex items-center gap-2"
              >
                {status === 'calculando' ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Calculando...
                  </>
                ) : (
                  'Calcular KM · Pedágio · ANTT'
                )}
              </button>

              {status === 'pronto' && (
                <button
                  onClick={exportar}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded transition"
                >
                  Exportar Excel
                </button>
              )}

              {status === 'pronto' && (
                <span className="text-sm text-gray-400">
                  <span className="text-green-400">{totalOk} ok</span>
                  {totalErro > 0 && (
                    <span className="text-red-400 ml-2">{totalErro} com erro</span>
                  )}
                </span>
              )}
            </div>
            {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
          </div>
        )}

        {linhas.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-400 text-left">
                    {temCliente && <th className="px-4 py-3 font-medium">Cliente</th>}
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-4 py-3 font-medium">Destino</th>
                    <th className="px-4 py-3 font-medium">Eixos</th>
                    <th className="px-4 py-3 font-medium text-right">KM</th>
                    <th className="px-4 py-3 font-medium text-right">Pedágio</th>
                    <th className="px-4 py-3 font-medium text-right">ANTT</th>
                    <th className="px-4 py-3 font-medium text-right">Frete Total</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {linhas.map((linha, i) => {
                    const aberto = expandido === i
                    const cols = temCliente ? 9 : 8
                    const eixosList = [2, 3, 4, 5, 6, 7, 9]
                    const colunas = [
                      { label: 'Simples',       composicao: false, alto: false },
                      { label: 'Simples + AD',  composicao: false, alto: true  },
                      { label: 'Composição',    composicao: true,  alto: false },
                      { label: 'Comp. + AD',    composicao: true,  alto: true  },
                    ]
                    return (
                      <React.Fragment key={i}>
                        <tr
                          className={`transition hover:bg-gray-800/50 ${linha.variacaoCompleta ? 'cursor-pointer' : ''}`}
                          onClick={() => linha.variacaoCompleta && setExpandido(aberto ? null : i)}
                        >
                          {temCliente && (
                            <td className="px-4 py-3 text-gray-200 font-medium">{linha.cliente}</td>
                          )}
                          <td className="px-4 py-3 text-gray-400">{linha.origem}</td>
                          <td className="px-4 py-3 text-gray-400">{linha.destino}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {linha.eixos}
                            {linha.variacaoCompleta && (
                              <span className="ml-1 text-gray-600 text-xs">{aberto ? '▲' : '▼'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {linha.km ? `${linha.km} km` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatBRL(linha.pedagio)}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatBRL(linha.antt)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white">{formatBRL(linha.freteTotal)}</td>
                          <td className="px-4 py-3 text-center">
                            {linha.status === 'ok' && <span className="inline-block w-2 h-2 rounded-full bg-green-500" />}
                            {linha.status === 'erro' && <span className="text-red-400 text-xs" title={linha.erro}>erro</span>}
                            {linha.status === 'pendente' && <span className="inline-block w-2 h-2 rounded-full bg-gray-600" />}
                            {linha.status === 'calculando' && <span className="animate-spin inline-block w-3 h-3 border border-blue-400 border-t-transparent rounded-full" />}
                          </td>
                        </tr>

                        {aberto && linha.variacaoCompleta && (
                          <tr key={`${i}-detail`} className="bg-gray-800/20">
                            <td colSpan={cols} className="px-6 py-4 overflow-x-auto">
                              <p className="text-xs text-gray-500 mb-3">
                                {linha.km} km · Pedágio ref. 6 eixos: {formatBRL(linha.pedagio)}
                              </p>
                              <table className="text-xs border-collapse">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="pr-3 pb-2 text-left font-medium">Eixos (ANTT)</th>
                                    <th className="px-3 pb-2 text-right font-medium">Simples</th>
                                    <th className="px-3 pb-2 text-right font-medium">Simples + AD</th>
                                    <th className="px-3 pb-2 text-right font-medium">Composição</th>
                                    <th className="px-3 pb-2 text-right font-medium">Comp. + AD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {eixosList.map(e => {
                                    const itens = colunas.map(c =>
                                      linha.variacaoCompleta!.find(x => x.eixos === e && x.composicaoVeicular === c.composicao && x.altoDesempenho === c.alto)
                                    )
                                    return (
                                      <tr key={e} className="border-t border-gray-800">
                                        <td className="pr-3 py-1.5 text-gray-400">{e} eixos</td>
                                        {itens.map((v, ci) => (
                                          <td key={ci} className="px-3 py-1.5 text-right text-gray-300">
                                            {formatBRL(v?.antt)}
                                          </td>
                                        ))}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {linhas.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-2">Nenhuma tabela carregada</p>
            <p className="text-sm">Baixe o modelo Excel, preencha e importe acima</p>
          </div>
        )}
      </div>
    </main>
  )
}
