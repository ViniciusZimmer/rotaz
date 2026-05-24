'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'
import { CIDADES_BRASIL } from '@/lib/cidades'

type Confianca = 'alta' | 'media' | 'baixa'

interface HistoricoItem {
  origem: string
  destino: string
  eixos: number
  resultado: ComparacaoResult
}

const HISTORICO_KEY = 'rotaz_validacao_historico'

function formatBRL(valor?: number) {
  if (valor == null) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function badgeConfianca(confianca?: Confianca) {
  if (!confianca) return null
  const cfg = {
    alta:  { cor: 'bg-green-600', label: '● Alta' },
    media: { cor: 'bg-amber-500', label: '● Média' },
    baixa: { cor: 'bg-red-700',   label: '● Baixa' },
  }[confianca]
  return (
    <span className={`inline-flex items-center text-xs text-white px-1.5 py-0.5 rounded ${cfg.cor}`}>
      {cfg.label}
    </span>
  )
}

function labelFonte(fonte: ProviderFonte): string {
  const labels: Record<ProviderFonte, string> = {
    here: 'HERE Maps', tomtom: 'TomTom', 'rotas-brasil': 'Rotas Brasil',
    'banco-proprio': 'Banco Próprio', estimativa: 'Estimativa',
  }
  return labels[fonte]
}

const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here',         label: 'HERE Maps' },
  { fonte: 'tomtom',       label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa',   label: 'Estimativa (Haversine)' },
]

function calcularDelta(pedagio: number, minPedagio: number): string | null {
  if (pedagio <= 0 || minPedagio <= 0 || pedagio === minPedagio) return null
  const diff = pedagio - minPedagio
  const pct = ((diff / minPedagio) * 100).toFixed(0)
  return `+${formatBRL(diff)} (+${pct}%)`
}

export default function ValidacaoPage() {
  const router = useRouter()
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [eixos, setEixos] = useState(6)
  const [resultado, setResultado] = useState<ComparacaoResult | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [pracasExpandidas, setPracasExpandidas] = useState<Set<string>>(new Set())
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const { settings, toggle, activeProviders } = useProviderSettings()

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(HISTORICO_KEY)
      if (stored) setHistorico(JSON.parse(stored))
    } catch {}
  }, [])

  function salvarHistorico(item: HistoricoItem) {
    setHistorico(prev => {
      const next = [item, ...prev.filter(h => !(h.origem === item.origem && h.destino === item.destino && h.eixos === item.eixos))].slice(0, 5)
      try { sessionStorage.setItem(HISTORICO_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function comparar(e: React.FormEvent) {
    e.preventDefault()
    if (!origem.trim() || !destino.trim() || !activeProviders.length) return
    setCarregando(true)
    setErro('')
    setResultado(null)
    try {
      const res = await compararProvedores(origem.trim(), destino.trim(), eixos, activeProviders)
      setResultado(res)
      salvarHistorico({ origem: origem.trim(), destino: destino.trim(), eixos, resultado: res })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  function togglePracas(key: string) {
    setPracasExpandidas(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function renderTabela(comp: ComparacaoResult, rota: { origem: string; destino: string; eixos: number }) {
    const entries = Object.entries(comp) as [ProviderFonte, ComparacaoResult[keyof ComparacaoResult]][]
    const pedagogios = entries
      .flatMap(([, res]) => (!res || 'error' in res) ? [] : [(res as RotaResult).pedagio])
      .filter(v => v > 0)
    const minPedagio = pedagogios.length > 0 ? Math.min(...pedagogios) : 0

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-sm text-slate-300 font-medium">
            {rota.origem} → {rota.destino} · {rota.eixos} eixos
          </p>
          <button
            onClick={() => router.push(`/?origem=${encodeURIComponent(rota.origem)}&destino=${encodeURIComponent(rota.destino)}&eixos=${rota.eixos}`)}
            className="text-xs text-sky-400 hover:text-sky-300 border border-sky-800 hover:border-sky-600 px-2 py-1 rounded transition-colors"
          >
            Usar no frete →
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-slate-500 text-left">
              <th className="px-5 py-2.5 text-xs font-medium uppercase tracking-wide">Provedor</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-right">KM</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-right">Pedágio</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-right">vs. melhor</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide">Confiança</th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide">Praças</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {entries.map(([nome, res]) => {
              if (!res) return null
              const isError = 'error' in res
              const r = isError ? null : res as RotaResult
              const delta = r && r.pedagio > 0 ? calcularDelta(r.pedagio, minPedagio) : null
              const rowKey = `${rota.origem}-${rota.destino}-${nome}`
              return (
                <React.Fragment key={nome}>
                  <tr className={`hover:bg-gray-800/30 transition-colors ${delta ? 'bg-amber-900/5' : ''}`}>
                    <td className="px-5 py-3 text-slate-300 font-medium">{labelFonte(nome)}</td>
                    {isError ? (
                      <td colSpan={5} className="px-4 py-3 text-red-400 text-xs">{(res as { error: string }).error}</td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">{Math.round(r!.km)} km</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                          {r!.pedagio > 0 ? formatBRL(r!.pedagio) : <span className="text-amber-400 text-xs">⚠ sem dados</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                          {delta
                            ? <span className="text-amber-400">{delta}</span>
                            : r!.pedagio > 0 ? <span className="text-green-400">melhor</span> : <span className="text-slate-600">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">{badgeConfianca(r!.confianca as Confianca)}</td>
                        <td className="px-4 py-3">
                          {r!.pracas && r!.pracas.length > 0 ? (
                            <button onClick={() => togglePracas(rowKey)} className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                              {pracasExpandidas.has(rowKey) ? 'Ocultar' : `${r!.pracas.length} praças`}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                  {!isError && r!.pracas && r!.pracas.length > 0 && pracasExpandidas.has(rowKey) && (
                    <tr>
                      <td colSpan={6} className="px-8 py-3 bg-gray-800/20">
                        <table className="text-xs border-collapse">
                          <tbody>
                            {r!.pracas!.map((p, pi) => (
                              <tr key={pi}>
                                <td className="pr-6 py-0.5 text-slate-400">
                                  {p.nome}{p.rodovia && <span className="ml-1 text-slate-600">({p.rodovia})</span>}
                                </td>
                                <td className="text-right font-mono tabular-nums text-slate-300">{formatBRL(p.valor)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-700">
                              <td className="pr-6 py-0.5 text-slate-500 font-medium">Total</td>
                              <td className="text-right font-mono tabular-nums text-slate-300 font-medium">{formatBRL(r!.pedagio)}</td>
                            </tr>
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
    )
  }

  return (
    <main className="min-h-screen text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-4">Provedores ativos</p>
          <div className="flex flex-wrap gap-6">
            {PROVIDER_OPTIONS.map(({ fonte, label }) => (
              <label key={fonte} className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => toggle(fonte)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${settings[fonte] ? 'bg-sky-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[fonte] ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
          {activeProviders.length === 0 && (
            <p className="mt-3 text-sm text-amber-400">Nenhum provedor selecionado.</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-4">Rota para comparar</p>
          <datalist id="cidades-br">
            {CIDADES_BRASIL.map(c => <option key={c} value={c} />)}
          </datalist>
          <form onSubmit={comparar} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Origem</label>
              <input type="text" value={origem} onChange={e => setOrigem(e.target.value)} placeholder="São Paulo, SP" required list="cidades-br"
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 w-52 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Destino</label>
              <input type="text" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Curitiba, PR" required list="cidades-br"
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 w-52 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Eixos</label>
              <select value={eixos} onChange={e => setEixos(Number(e.target.value))}
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-slate-100 focus:outline-none focus:border-sky-500 transition-colors">
                {[2, 3, 4, 5, 6, 7, 9].map(n => <option key={n} value={n}>{n} eixos</option>)}
              </select>
            </div>
            <button type="submit" disabled={carregando || !activeProviders.length}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition-colors flex items-center gap-2">
              {carregando ? (
                <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />Comparando…</>
              ) : 'Comparar'}
            </button>
          </form>
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
        </div>

        {resultado && renderTabela(resultado, { origem, destino, eixos })}

        {historico.length > 1 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Histórico da sessão</p>
            {historico.slice(1).map((item, idx) => (
              <div key={idx}>{renderTabela(item.resultado, { origem: item.origem, destino: item.destino, eixos: item.eixos })}</div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
