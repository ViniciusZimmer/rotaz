'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { useState } from 'react'
import { useProviderSettings } from '@/hooks/useProviderSettings'
import { ProviderFonte } from '@/types/routing'

const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here',         label: 'HERE Maps' },
  { fonte: 'tomtom',       label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa',   label: 'Estimativa (Haversine)' },
]

export function NavBar() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const { settings, toggle, activeProviders } = useProviderSettings()

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-7 h-7 rounded-md bg-sky-500 flex items-center justify-center text-xs font-bold text-white">Rz</span>
          <span className="font-semibold text-slate-100 tracking-tight">Rotaz</span>
        </Link>

        <div className="flex items-center gap-1 flex-1">
          <Link
            href="/"
            className={`text-sm px-3 py-1.5 rounded transition-colors ${pathname === '/' ? 'bg-gray-800 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-gray-800/50'}`}
          >
            Calculadora
          </Link>
          <Link
            href="/validacao"
            className={`text-sm px-3 py-1.5 rounded transition-colors ${pathname === '/validacao' ? 'bg-gray-800 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-gray-800/50'}`}
          >
            Validação
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAberto(true)}
            className="text-sm text-slate-400 hover:text-slate-200 border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Provedores
            {activeProviders.length > 0 && (
              <span className="text-xs text-sky-400">({activeProviders.length})</span>
            )}
          </button>
          <UserButton />
        </div>
      </nav>

      {aberto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setAberto(false)} />
          <div className="w-80 bg-gray-900 border-l border-gray-800 h-full p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-slate-100">Provedores ativos</h2>
              <button onClick={() => setAberto(false)} className="text-slate-500 hover:text-slate-300 text-xl leading-none transition-colors">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Selecionados ao comparar na calculadora ou validar em /validacao.
            </p>
            <div className="space-y-4 flex-1">
              {PROVIDER_OPTIONS.map(({ fonte, label }) => (
                <label key={fonte} className="flex items-center gap-3 cursor-pointer">
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
            <div className="mt-6 pt-4 border-t border-gray-800">
              <p className="text-xs text-slate-500">
                {activeProviders.length === 0
                  ? 'Nenhum provedor ativo — comparação desabilitada.'
                  : `${activeProviders.length} provedor${activeProviders.length > 1 ? 'es' : ''} ativo${activeProviders.length > 1 ? 's' : ''}.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
