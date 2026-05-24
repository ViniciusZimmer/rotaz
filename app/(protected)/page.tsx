'use client'

import React, { useState, useRef } from 'react'
import { UserButton } from '@clerk/nextjs'
import { LinhaFrete } from '@/types/frete'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { salvarCotacao } from '@/lib/actions/cotacao'
import { salvarCorrecaoPedagio } from '@/lib/actions/correcao'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'

// banco-proprio is not included here — it's an internal read-only source, not selectable for comparison
const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here', label: 'HERE Maps' },
  { fonte: 'tomtom', label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa', label: 'Estimativa (Haversine)' },
]

type StatusGlobal = 'idle' | 'calculando' | 'pronto'
type FormatoExcel = 'padrao' | 'modeloIA'
type Confianca = 'alta' | 'media' | 'baixa'

function formatBRL(valor?: number) {
  if (valor == null) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function badgeConfianca(confianca?: Confianca) {
  if (!confianca) return null
  const cfg = {
    alta:  { cor: 'bg-green-600',  label: '● Alta' },
    media: { cor: 'bg-yellow-600', label: '● Média' },
    baixa: { cor: 'bg-red-700',    label: '● Baixa' },
  }[confianca]
  return (
    <span className={`inline-flex items-center text-xs text-white px-1.5 py-0.5 rounded ${cfg.cor}`}>
      {cfg.label}
    </span>
  )
}

function labelFonte(fonte?: ProviderFonte): string {
  if (!fonte) return ''
  const labels: Record<ProviderFonte, string> = {
    here: 'HERE',
    tomtom: 'TomTom',
    'rotas-brasil': 'Rotas Brasil',
    'banco-proprio': 'Banco Próprio',
    estimativa: 'Estimativa',
  }
  return labels[fonte]
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
  const [corrigindo, setCorrigindo] = useState<number | null>(null)
  const [valorCorrigido, setValorCorrigido] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [settingsAberto, setSettingsAberto] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [progressoComparacao, setProgressoComparacao] = useState(0)
  const { settings, toggle, activeProviders } = useProviderSettings()

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

  async function comparar() {
    if (!linhas.length || !activeProviders.length) return
    setComparando(true)
    setProgressoComparacao(0)
    const atualizadas = [...linhas]
    try {
      for (let i = 0; i < atualizadas.length; i++) {
        setProgressoComparacao(i + 1)
        const l = atualizadas[i]
        if (!l.origem || !l.destino) continue
        try {
          const resultado = await compararProvedores(l.origem, l.destino, l.eixos, activeProviders)
          atualizadas[i] = { ...l, comparacao: resultado }
        } catch (err) {
          console.warn(`[comparar] linha ${i} falhou:`, err)
        }
        if (i < atualizadas.length - 1) {
          await new Promise(r => setTimeout(r, 1000))
        }
      }
      setLinhas(atualizadas)
    } finally {
      setComparando(false)
    }
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
            href="/validacao"
            className="text-sm text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 px-3 py-1.5 rounded transition"
          >
            Validar provedores
          </a>
          <a
            href="/api/modelo"
            className="text-sm text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-1.5 rounded transition"
          >
            Baixar modelo Excel
          </a>
          <div className="relative">
            <button
              onClick={() => setSettingsAberto(v => !v)}
              className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded transition"
              title="Configurar provedores"
            >
              ⚙ Provedores
            </button>
            {settingsAberto && (
              <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-4 z-10 min-w-[220px]">
                <p className="text-xs text-gray-500 font-medium mb-3">Provedores ativos</p>
                {PROVIDER_OPTIONS.map(({ fonte, label }) => (
                  <label key={fonte} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!settings[fonte]}
                      onChange={() => toggle(fonte)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
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

              <button
                onClick={comparar}
                disabled={comparando || !linhas.length || !activeProviders.length}
                className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition flex items-center gap-2"
              >
                {comparando ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Comparando rota {progressoComparacao}/{linhas.length}…
                  </>
                ) : (
                  `Comparar provedores${activeProviders.length > 0 ? ` (${activeProviders.length})` : ''}`
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
                    <th className="px-4 py-3 font-medium">Fonte</th>
                    <th className="px-4 py-3 font-medium text-right">ANTT</th>
                    <th className="px-4 py-3 font-medium text-right">Frete Total</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {linhas.map((linha, i) => {
                    const aberto = expandido === i
                    const cols = temCliente ? 10 : 9
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
                          <td className="px-4 py-3">
                            {linha.fonte && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-500">{labelFonte(linha.fonte)}</span>
                                {badgeConfianca(linha.confianca as Confianca)}
                              </div>
                            )}
                          </td>
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

                              {/* Breakdown de praças */}
                              {linha.pracas && linha.pracas.length > 0 && (
                                <div className="mb-4">
                                  <p className="text-xs text-gray-500 font-medium mb-2">
                                    Praças cruzadas ({labelFonte(linha.fonte)})
                                  </p>
                                  <table className="text-xs border-collapse mb-2">
                                    <tbody>
                                      {linha.pracas.map((praca, pi) => (
                                        <tr key={pi}>
                                          <td className="pr-6 py-0.5 text-gray-400">
                                            {praca.nome}
                                            {praca.rodovia && (
                                              <span className="ml-1 text-gray-600">({praca.rodovia})</span>
                                            )}
                                          </td>
                                          <td className="text-right text-gray-300">{formatBRL(praca.valor)}</td>
                                        </tr>
                                      ))}
                                      <tr className="border-t border-gray-700">
                                        <td className="pr-6 py-0.5 text-gray-500 font-medium">Total</td>
                                        <td className="text-right text-gray-300 font-medium">{formatBRL(linha.pedagio)}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Comparação de provedores */}
                              {linha.comparacao && (
                                <div className="mb-4">
                                  <p className="text-xs text-gray-500 font-medium mb-2">
                                    Comparação de provedores
                                  </p>
                                  {(() => {
                                    const comp = linha.comparacao!
                                    const valores = (Object.values(comp) as Array<ComparacaoResult[keyof ComparacaoResult]>)
                                      .filter((r): r is RotaResult => !!r && 'km' in r && (r as RotaResult).pedagio > 0)
                                      .map(r => r.pedagio)
                                    const minP = valores.length > 0 ? Math.min(...valores) : 0
                                    const maxP = valores.length > 0 ? Math.max(...valores) : 0
                                    const diverge = valores.length > 1 && minP > 0 && (maxP - minP) / minP > 0.10
                                    return (
                                      <table className="text-xs border-collapse w-full max-w-sm">
                                        <thead>
                                          <tr className="text-gray-600">
                                            <th className="text-left pb-1 font-medium">Provedor</th>
                                            <th className="text-right pb-1 font-medium px-3">KM</th>
                                            <th className="text-right pb-1 font-medium px-3">Pedágio</th>
                                            <th className="text-right pb-1 font-medium">Confiança</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(Object.entries(comp) as [ProviderFonte, ComparacaoResult[keyof ComparacaoResult]][]).map(([nome, res]) => {
                                            if (!res) return null
                                            const isError = 'error' in res
                                            const isDivergente = !isError && diverge && (res as RotaResult).pedagio > 0
                                            return (
                                              <tr
                                                key={nome}
                                                className={`border-t border-gray-800 ${isDivergente ? 'bg-yellow-900/20' : ''}`}
                                              >
                                                <td className="py-1 pr-3 text-gray-400">{labelFonte(nome)}</td>
                                                {isError ? (
                                                  <td colSpan={3} className="py-1 px-3 text-red-400">{(res as { error: string }).error}</td>
                                                ) : (
                                                  <>
                                                    <td className="py-1 px-3 text-right text-gray-300">{(res as RotaResult).km} km</td>
                                                    <td className="py-1 px-3 text-right text-gray-300">{formatBRL((res as RotaResult).pedagio)}</td>
                                                    <td className="py-1 text-right">{badgeConfianca((res as RotaResult).confianca as Confianca)}</td>
                                                  </>
                                                )}
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    )
                                  })()}
                                </div>
                              )}

                              <p className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                                {linha.km} km · Pedágio ref. 6 eixos: {formatBRL(linha.pedagio)}
                                {linha.confianca && badgeConfianca(linha.confianca as Confianca)}
                              </p>

                              {/* Correção de pedágio */}
                              {linha.pedagio != null && (
                                <div className="mb-4">
                                  {corrigindo === i ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">Valor real (R$):</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={valorCorrigido}
                                        onChange={e => setValorCorrigido(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        className="w-28 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder={String(linha.pedagio)}
                                      />
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          const v = parseFloat(valorCorrigido)
                                          if (!isNaN(v) && v >= 0) {
                                            await salvarCorrecaoPedagio({
                                              origem: linha.origem,
                                              destino: linha.destino,
                                              eixos: linha.eixos,
                                              valorOriginal: linha.pedagio!,
                                              valorCorrigido: v,
                                            })
                                          }
                                          setCorrigindo(null)
                                          setValorCorrigido('')
                                        }}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition"
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setCorrigindo(null); setValorCorrigido('') }}
                                        className="text-xs text-gray-500 hover:text-gray-300 transition"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCorrigindo(i); setValorCorrigido(String(linha.pedagio)) }}
                                      className="text-xs text-gray-600 hover:text-blue-400 transition"
                                    >
                                      ✎ Corrigir pedágio
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Tabela de variações ANTT */}
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
