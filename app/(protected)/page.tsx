'use client'

import React, { useState, useRef } from 'react'
import { LinhaFrete } from '@/types/frete'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { getCoeficientes, TIPOS_CARGA } from '@/lib/antt'
import { salvarCotacao } from '@/lib/actions/cotacao'
import { salvarCorrecaoPedagio } from '@/lib/actions/correcao'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'

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

function calcularResumo(linhas: LinhaFrete[]) {
  const total = linhas.filter(l => l.status === 'ok').length
  const porFonte: Record<string, number> = {}
  const porConfianca: Record<string, number> = { alta: 0, media: 0, baixa: 0 }
  for (const l of linhas) {
    if (l.status !== 'ok') continue
    if (l.fonte) porFonte[l.fonte] = (porFonte[l.fonte] ?? 0) + 1
    if (l.confianca) porConfianca[l.confianca] = (porConfianca[l.confianca] ?? 0) + 1
  }
  return { total, porFonte, porConfianca }
}

function fonteCorClass(fonte?: ProviderFonte): string {
  if (!fonte) return 'text-slate-500'
  if (fonte === 'estimativa') return 'text-amber-400'
  if (fonte === 'banco-proprio') return 'text-green-400'
  return 'text-sky-400'
}

function divergeRow(linha: LinhaFrete): boolean {
  if (!linha.comparacao) return false
  const vals = (Object.values(linha.comparacao) as ComparacaoResult[keyof ComparacaoResult][])
    .filter((r): r is RotaResult => !!r && 'km' in r && (r as RotaResult).pedagio > 0)
    .map(r => r.pedagio)
  if (vals.length < 2) return false
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return min > 0 && (max - min) / min > 0.10
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
  const [dragging, setDragging] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [progressoComparacao, setProgressoComparacao] = useState(0)
  const { activeProviders } = useProviderSettings()

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

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>
    await onUpload(fakeEvent)
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
    <main className="min-h-screen text-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-4">

        {/* Upload zone */}
        {linhas.length === 0 ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragging ? 'border-sky-500 bg-sky-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <div>
                <p className="text-slate-300 font-medium">Arraste o Excel aqui</p>
                <p className="text-slate-500 text-sm mt-0.5">ou clique para selecionar</p>
              </div>
              <label className="cursor-pointer mt-1 bg-sky-600 hover:bg-sky-500 text-white text-sm px-4 py-2 rounded transition-colors">
                Selecionar arquivo
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onUpload} />
              </label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setFormato('padrao')}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${formato === 'padrao' ? 'border-sky-600 text-sky-400 bg-sky-600/10' : 'border-gray-700 text-slate-500 hover:border-gray-600'}`}
                >
                  Formato padrão
                </button>
                <button
                  onClick={() => setFormato('modeloIA')}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${formato === 'modeloIA' ? 'border-sky-600 text-sky-400 bg-sky-600/10' : 'border-gray-700 text-slate-500 hover:border-gray-600'}`}
                >
                  Formato IA
                </button>
              </div>
              <a href="/api/modelo" className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-1">
                Baixar modelo Excel →
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <span className="text-sm text-slate-300 flex-1">
              {linhas.length} {linhas.length === 1 ? 'rota' : 'rotas'}
              {clientes.length > 0 && ` · ${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`}
              {formato === 'modeloIA' && <span className="ml-2 text-sky-400 text-xs">formato IA</span>}
            </span>
            <button onClick={limpar} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Limpar
            </button>
          </div>
        )}

        {/* Action bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none mr-2">
              <div
                onClick={() => setComposicaoVeicular(v => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${composicaoVeicular ? 'bg-sky-500' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${composicaoVeicular ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm text-slate-400">Composição Veicular</span>
              {composicaoVeicular && <span className="text-xs text-sky-400">Tabela B</span>}
            </label>

            <div className="w-px h-5 bg-gray-700 hidden sm:block" />

            <button
              onClick={calcular}
              disabled={!linhas.length || status === 'calculando'}
              title={!linhas.length ? 'Faça upload de um Excel primeiro' : undefined}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition-colors flex items-center gap-2"
            >
              {status === 'calculando' ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  Calculando…
                </>
              ) : (
                'Calcular KM · Pedágio · ANTT'
              )}
            </button>

            <button
              onClick={comparar}
              disabled={!linhas.length || comparando || !activeProviders.length}
              title={
                !linhas.length ? 'Faça upload de um Excel primeiro'
                : !activeProviders.length ? 'Ative provedores em Configurações'
                : undefined
              }
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm px-5 py-2 rounded transition-colors flex items-center gap-2"
            >
              {comparando ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full" />
                  Comparando {progressoComparacao}/{linhas.length}…
                </>
              ) : (
                `Comparar provedores${activeProviders.length > 0 ? ` (${activeProviders.length})` : ''}`
              )}
            </button>

            {status === 'pronto' && (
              <button
                onClick={exportar}
                className="bg-gray-800 hover:bg-gray-700 text-slate-300 text-sm px-5 py-2 rounded transition-colors border border-gray-700 hover:border-gray-600"
              >
                Exportar Excel ↓
              </button>
            )}

            {status === 'pronto' && (
              <span className="text-sm text-slate-500 ml-auto">
                <span className="text-green-400">{totalOk} ok</span>
                {totalErro > 0 && <span className="text-red-400 ml-2">{totalErro} erro{totalErro > 1 ? 's' : ''}</span>}
              </span>
            )}
          </div>
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
        </div>

        {status === 'pronto' && (() => {
          const resumo = calcularResumo(linhas)
          const FONTE_LABELS_UI: Record<string, string> = {
            here: 'HERE', tomtom: 'TomTom', 'rotas-brasil': 'Rotas Brasil',
            'banco-proprio': 'Banco Próprio', estimativa: 'Estimativa',
          }
          return (
            <div className="bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-green-400 font-medium">✓ {resumo.total} {resumo.total === 1 ? 'rota calculada' : 'rotas calculadas'}</span>
              {Object.entries(resumo.porFonte).map(([fonte, n]) => (
                <span key={fonte} className="text-gray-400">
                  {FONTE_LABELS_UI[fonte] ?? fonte}: <span className="text-gray-200">{n}</span>
                </span>
              ))}
              <span className="text-gray-600">·</span>
              {resumo.porConfianca.alta > 0 && <span className="text-green-500 text-xs">Alta: {resumo.porConfianca.alta}</span>}
              {resumo.porConfianca.media > 0 && <span className="text-yellow-500 text-xs">Média: {resumo.porConfianca.media}</span>}
              {resumo.porConfianca.baixa > 0 && <span className="text-red-500 text-xs">Baixa: {resumo.porConfianca.baixa}</span>}
            </div>
          )
        })()}

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
                          className={`transition hover:bg-gray-800/50 ${linha.variacaoCompleta ? 'cursor-pointer' : ''} ${divergeRow(linha) ? 'bg-amber-900/10' : ''}`}
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
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                            {linha.km ? `${Math.round(linha.km)} km` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                            {linha.pedagio === 0
                              ? <span className="text-amber-400 text-xs">⚠ sem dados</span>
                              : formatBRL(linha.pedagio)
                            }
                          </td>
                          <td className="px-4 py-3">
                            {linha.fonte && (
                              <div className="flex flex-col gap-1">
                                <span className={`text-xs font-medium ${fonteCorClass(linha.fonte)}`}>
                                  ● {labelFonte(linha.fonte)}
                                </span>
                                {badgeConfianca(linha.confianca as Confianca)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">{formatBRL(linha.antt)}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-100">{formatBRL(linha.freteTotal)}</td>
                          <td className="px-4 py-3 text-center">
                            {linha.status === 'ok' && <span className="inline-block w-2 h-2 rounded-full bg-green-500" />}
                            {linha.status === 'erro' && (
                              <span className="text-red-400 text-xs" title={linha.erro}>
                                {linha.erro ? `erro: ${linha.erro.slice(0, 35)}` : 'erro'}
                              </span>
                            )}
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

                              {/* Fórmula ANTT */}
                              {linha.km && (() => {
                                const tipoCarga = linha.tipoCarga ?? 'carga_geral'
                                const coef = getCoeficientes(linha.eixos, false, false, tipoCarga)
                                if (!coef) return null
                                const anttVal = Math.round((linha.km * coef.ccd + coef.cc) * 100) / 100
                                return (
                                  <div className="mt-4 pt-3 border-t border-gray-800">
                                    <p className="text-xs text-gray-500 font-medium mb-1">
                                      Fórmula ANTT — {linha.eixos} eixos · Simples · {TIPOS_CARGA[tipoCarga] ?? tipoCarga}
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono">
                                      {coef.ccd.toFixed(4)} × {linha.km} km + {coef.cc.toFixed(2)} = {formatBRL(anttVal)}
                                    </p>
                                  </div>
                                )
                              })()}
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
