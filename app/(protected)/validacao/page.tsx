'use client'

import React, { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'

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

function labelFonte(fonte: ProviderFonte): string {
  const labels: Record<ProviderFonte, string> = {
    here: 'HERE Maps',
    tomtom: 'TomTom',
    'rotas-brasil': 'Rotas Brasil',
    'banco-proprio': 'Banco Próprio',
    estimativa: 'Estimativa',
  }
  return labels[fonte]
}

const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here', label: 'HERE Maps' },
  { fonte: 'tomtom', label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa', label: 'Estimativa (Haversine)' },
]

export default function ValidacaoPage() {
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [eixos, setEixos] = useState(6)
  const [resultado, setResultado] = useState<ComparacaoResult | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [pracasExpandidas, setPracasExpandidas] = useState<Set<string>>(new Set())
  const { settings, toggle, activeProviders } = useProviderSettings()

  async function comparar(e: React.FormEvent) {
    e.preventDefault()
    if (!origem.trim() || !destino.trim() || !activeProviders.length) return
    setCarregando(true)
    setErro('')
    setResultado(null)
    try {
      const res = await compararProvedores(origem.trim(), destino.trim(), eixos, activeProviders)
      setResultado(res)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  function togglePracas(nome: string) {
    setPracasExpandidas(prev => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-200 transition">
            ← Calculadora
          </a>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Validação de Provedores</h1>
            <p className="text-sm text-gray-400 mt-0.5">Compare KM e pedágio entre fontes</p>
          </div>
        </div>
        <UserButton />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Provedores ativos</h2>
          <div className="flex flex-wrap gap-6">
            {PROVIDER_OPTIONS.map(({ fonte, label }) => (
              <label key={fonte} className="flex items-center gap-2 cursor-pointer">
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
          {activeProviders.length === 0 && (
            <p className="mt-3 text-sm text-yellow-400">Nenhum provedor selecionado.</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Rota para comparar</h2>
          <form onSubmit={comparar} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Origem</label>
              <input
                type="text"
                value={origem}
                onChange={e => setOrigem(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                required
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-52"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Destino</label>
              <input
                type="text"
                value={destino}
                onChange={e => setDestino(e.target.value)}
                placeholder="Ex: Curitiba, PR"
                required
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-52"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Eixos</label>
              <select
                value={eixos}
                onChange={e => setEixos(Number(e.target.value))}
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              >
                {[2, 3, 4, 5, 6, 7, 9].map(n => (
                  <option key={n} value={n}>{n} eixos</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={carregando || !activeProviders.length}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition flex items-center gap-2"
            >
              {carregando ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  Comparando…
                </>
              ) : 'Comparar'}
            </button>
          </form>
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-medium text-gray-300">
                {origem} → {destino} · {eixos} eixos
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-left">
                  <th className="px-6 py-3 font-medium">Provedor</th>
                  <th className="px-4 py-3 font-medium text-right">KM</th>
                  <th className="px-4 py-3 font-medium text-right">Pedágio</th>
                  <th className="px-4 py-3 font-medium">Confiança</th>
                  <th className="px-4 py-3 font-medium">Praças</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {(Object.entries(resultado) as [ProviderFonte, ComparacaoResult[keyof ComparacaoResult]][]).map(([nome, res]) => {
                  if (!res) return null
                  const isError = 'error' in res
                  return (
                    <React.Fragment key={nome}>
                      <tr className="hover:bg-gray-800/50 transition">
                        <td className="px-6 py-3 text-gray-300 font-medium">{labelFonte(nome)}</td>
                        {isError ? (
                          <td colSpan={4} className="px-4 py-3 text-red-400 text-xs">
                            {(res as { error: string }).error}
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {(res as RotaResult).km} km
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {formatBRL((res as RotaResult).pedagio)}
                            </td>
                            <td className="px-4 py-3">
                              {badgeConfianca((res as RotaResult).confianca as Confianca)}
                            </td>
                            <td className="px-4 py-3">
                              {(res as RotaResult).pracas && (res as RotaResult).pracas!.length > 0 ? (
                                <button
                                  onClick={() => togglePracas(nome)}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                                >
                                  {pracasExpandidas.has(nome)
                                    ? 'Ocultar'
                                    : `${(res as RotaResult).pracas!.length} praças`}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-600">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      {!isError &&
                        (res as RotaResult).pracas &&
                        (res as RotaResult).pracas!.length > 0 &&
                        pracasExpandidas.has(nome) && (
                          <tr>
                            <td colSpan={5} className="px-8 py-3 bg-gray-800/30">
                              <table className="text-xs border-collapse">
                                <tbody>
                                  {(res as RotaResult).pracas!.map((p, pi) => (
                                    <tr key={pi}>
                                      <td className="pr-6 py-0.5 text-gray-400">
                                        {p.nome}
                                        {p.rodovia && (
                                          <span className="ml-1 text-gray-600">({p.rodovia})</span>
                                        )}
                                      </td>
                                      <td className="text-right text-gray-300">{formatBRL(p.valor)}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t border-gray-700">
                                    <td className="pr-6 py-0.5 text-gray-500 font-medium">Total</td>
                                    <td className="text-right text-gray-300 font-medium">
                                      {formatBRL((res as RotaResult).pedagio)}
                                    </td>
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
        )}
      </div>
    </main>
  )
}
