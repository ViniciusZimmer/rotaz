# Rotaz — Brand Identity & UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app as "Rotaz" with azul-noite/sky palette, add shared NavBar with settings panel, and redesign calculadora and validacao pages for improved usability.

**Architecture:** Tasks 1–2 lay the brand foundation (globals, metadata, NavBar). Tasks 3–6 progressively redesign `app/(protected)/page.tsx` and MUST run in order since each builds on the previous. Tasks 7–8 are independent (validacao upgrades and query-param pre-fill).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Clerk. No test suite.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/globals.css` | Azul-noite background, remove light-mode, fix body font |
| Modify | `app/layout.tsx` | Metadata: "Rotaz — Calculadora" |
| Create | `components/NavBar.tsx` | Logo Rz, nav links, settings side panel with provider toggles |
| Modify | `app/(protected)/layout.tsx` | Mount NavBar, add pt-14 spacer |
| Create | `app/(protected)/validacao/layout.tsx` | Metadata: "Rotaz — Validação" |
| Modify | `app/(protected)/page.tsx` | Full redesign: upload zone, action bar, table polish, two-col accordion, query-param reader |
| Modify | `app/(protected)/validacao/page.tsx` | Remove own header, add histórico, delta column, "Usar no frete" |

---

### Task 1: Brand Foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

:root {
  --background: #0B1120;
  --foreground: #F1F5F9;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 2: Update metadata in `app/layout.tsx`**

Replace:
```typescript
export const metadata: Metadata = {
  title: "Calculadora de Frete",
  description: "KM · Pedágio · ANTT automático",
};
```
With:
```typescript
export const metadata: Metadata = {
  title: "Rotaz — Calculadora",
  description: "Calcule rotas. Feche fretes.",
};
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: apply Rotaz brand colors and metadata"
```

---

### Task 2: NavBar Component & Protected Layout

**Files:**
- Create: `components/NavBar.tsx`
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Create `components/NavBar.tsx`**

```tsx
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
```

- [ ] **Step 2: Replace `app/(protected)/layout.tsx`**

```tsx
import { NavBar } from '@/components/NavBar'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavBar />
      <div className="pt-14">{children}</div>
    </>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/NavBar.tsx "app/(protected)/layout.tsx"
git commit -m "feat: add NavBar with Rotaz branding and provider settings panel"
```

---

### Task 3: Calculadora — Remove Old Header & Redesign Upload Zone

**Context:** `app/(protected)/page.tsx` is 665 lines. Removes the old header (now in NavBar), the `settingsAberto` state and settings popover, and replaces the "1. Importar tabela" section with a drag-and-drop upload zone.

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 1: Update imports — remove `UserButton`, keep others**

Replace line 1–11 (all imports):

```typescript
'use client'

import React, { useState, useRef } from 'react'
import { LinhaFrete } from '@/types/frete'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { getCoeficientes, TIPOS_CARGA } from '@/lib/antt'
import { salvarCotacao } from '@/lib/actions/cotacao'
import { salvarCorrecaoPedagio } from '@/lib/actions/correcao'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'
```

- [ ] **Step 2: Remove `PROVIDER_OPTIONS` constant**

Remove these lines (currently lines 14–19):
```typescript
// banco-proprio is not included here — it's an internal read-only source, not selectable for comparison
const PROVIDER_OPTIONS: { fonte: ProviderFonte; label: string }[] = [
  { fonte: 'here', label: 'HERE Maps' },
  { fonte: 'tomtom', label: 'TomTom' },
  { fonte: 'rotas-brasil', label: 'Rotas Brasil' },
  { fonte: 'estimativa', label: 'Estimativa (Haversine)' },
]
```

- [ ] **Step 3: Update state declarations inside `Home()`**

Replace:
```typescript
  const [settingsAberto, setSettingsAberto] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [progressoComparacao, setProgressoComparacao] = useState(0)
  const { settings, toggle, activeProviders } = useProviderSettings()
```
With:
```typescript
  const [dragging, setDragging] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [progressoComparacao, setProgressoComparacao] = useState(0)
  const { activeProviders } = useProviderSettings()
```

- [ ] **Step 4: Add drag-and-drop handlers after `limpar()`**

After the closing `}` of `limpar()`, add:

```typescript
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
```

- [ ] **Step 5: Replace the old `<main>` opening + header + upload section**

Find and replace from `return (` through the closing `</div>` of the upload card (ends at the line `        </div>`  before `{linhas.length > 0 && (`):

Old:
```tsx
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
```

New:
```tsx
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
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/page.tsx"
git commit -m "feat: drag-and-drop upload zone, remove old header"
```

---

### Task 4: Calculadora — Unified Action Bar

**Context:** Replaces the conditional "2. Calcular" section with an always-visible action bar containing Calcular + Comparar + Exportar with disabled tooltips.

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 1: Replace the "2. Calcular" section**

Find this block:
```tsx
        {linhas.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-300 mb-4">2. Calcular</h2>
```

Replace the entire section through its closing `)}` (which ends after `{erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}` and two closing div tags and the `)}`) with:

```tsx
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
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/page.tsx"
git commit -m "feat: unified action bar with disabled tooltips"
```

---

### Task 5: Calculadora — Table Visual Polish

**Context:** Adds `fonteCorClass` and `divergeRow` helpers, updates table cells with sky-colored fonte badge, ⚠ for `pedagio === 0`, integer KM, amber row highlight for divergence, and `font-mono tabular-nums` on all numeric cells.

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 1: Add helper functions after `calcularResumo`**

After the closing `}` of `calcularResumo`, add:

```typescript
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
```

- [ ] **Step 2: Add amber row highlight on divergence**

Find:
```tsx
                        <tr
                          className={`transition hover:bg-gray-800/50 ${linha.variacaoCompleta ? 'cursor-pointer' : ''}`}
```

Replace with:
```tsx
                        <tr
                          className={`transition hover:bg-gray-800/50 ${linha.variacaoCompleta ? 'cursor-pointer' : ''} ${divergeRow(linha) ? 'bg-amber-900/10' : ''}`}
```

- [ ] **Step 3: Update KM cell**

Find:
```tsx
                          <td className="px-4 py-3 text-right text-gray-300">
                            {linha.km ? `${linha.km} km` : '-'}
                          </td>
```

Replace with:
```tsx
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                            {linha.km ? `${Math.round(linha.km)} km` : '-'}
                          </td>
```

- [ ] **Step 4: Update Pedágio cell**

Find:
```tsx
                          <td className="px-4 py-3 text-right text-gray-300">{formatBRL(linha.pedagio)}</td>
```

Replace with:
```tsx
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                            {linha.pedagio === 0
                              ? <span className="text-amber-400 text-xs">⚠ sem dados</span>
                              : formatBRL(linha.pedagio)
                            }
                          </td>
```

- [ ] **Step 5: Update Fonte cell**

Find:
```tsx
                          <td className="px-4 py-3">
                            {linha.fonte && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-500">{labelFonte(linha.fonte)}</span>
                                {badgeConfianca(linha.confianca as Confianca)}
                              </div>
                            )}
                          </td>
```

Replace with:
```tsx
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
```

- [ ] **Step 6: Update ANTT and Frete Total cells**

Find:
```tsx
                          <td className="px-4 py-3 text-right text-gray-300">{formatBRL(linha.antt)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white">{formatBRL(linha.freteTotal)}</td>
```

Replace with:
```tsx
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">{formatBRL(linha.antt)}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-100">{formatBRL(linha.freteTotal)}</td>
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(protected)/page.tsx"
git commit -m "feat: table polish — fonte badge, KM rounding, pedagio warning, divergence highlight"
```

---

### Task 6: Calculadora — Accordion Two-Column Layout

**Context:** Reorganizes accordion into two columns when `linha.comparacao` exists. Left: summary + correcao + grade ANTT + fórmula + praças (collapsible). Right: comparação de provedores.

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 1: Add `pracasExpandidas` state**

After `const [valorCorrigido, setValorCorrigido] = useState('')`, add:

```typescript
  const [pracasExpandidas, setPracasExpandidas] = useState<Set<number>>(new Set())
```

- [ ] **Step 2: Replace the entire accordion detail row**

Find:
```tsx
                        {aberto && linha.variacaoCompleta && (
                          <tr key={`${i}-detail`} className="bg-gray-800/20">
                            <td colSpan={cols} className="px-6 py-4 overflow-x-auto">
```

Replace everything from that line through the matching closing `</td></tr>)}` with:

```tsx
                        {aberto && linha.variacaoCompleta && (
                          <tr key={`${i}-detail`} className="bg-gray-800/20">
                            <td colSpan={cols} className="px-6 py-5">
                              <div className={`flex gap-8 ${linha.comparacao ? 'flex-col lg:flex-row' : ''}`}>

                                {/* Left column: summary + correcao + grade ANTT + formula + pracas */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-2">
                                    {Math.round(linha.km ?? 0)} km · Pedágio ref. 6 eixos: {formatBRL(linha.pedagio)}
                                    {linha.confianca && badgeConfianca(linha.confianca as Confianca)}
                                  </p>

                                  {linha.pedagio != null && (
                                    <div className="mb-4">
                                      {corrigindo === i ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-slate-400">Valor real (R$):</span>
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
                                            className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded transition-colors"
                                          >
                                            Salvar
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setCorrigindo(null); setValorCorrigido('') }}
                                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setCorrigindo(i); setValorCorrigido(String(linha.pedagio)) }}
                                          className="text-xs text-slate-600 hover:text-sky-400 transition-colors"
                                        >
                                          ✎ Corrigir pedágio
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  <table className="text-xs border-collapse mb-4">
                                    <thead>
                                      <tr className="text-slate-500">
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
                                            <td className="pr-3 py-1.5 text-slate-400">{e} eixos</td>
                                            {itens.map((v, ci) => (
                                              <td key={ci} className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-300">
                                                {formatBRL(v?.antt)}
                                              </td>
                                            ))}
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>

                                  {linha.km && (() => {
                                    const tipoCarga = linha.tipoCarga ?? 'carga_geral'
                                    const coef = getCoeficientes(linha.eixos, false, false, tipoCarga)
                                    if (!coef) return null
                                    const anttVal = Math.round((linha.km * coef.ccd + coef.cc) * 100) / 100
                                    return (
                                      <div className="pt-3 border-t border-gray-800 mb-4">
                                        <p className="text-xs text-slate-500 font-medium mb-1">
                                          Fórmula ANTT — {linha.eixos} eixos · Simples · {TIPOS_CARGA[tipoCarga] ?? tipoCarga}
                                        </p>
                                        <p className="text-xs text-slate-400 font-mono">
                                          {coef.ccd.toFixed(4)} × {Math.round(linha.km)} km + {coef.cc.toFixed(2)} = {formatBRL(anttVal)}
                                        </p>
                                      </div>
                                    )
                                  })()}

                                  {linha.pracas && linha.pracas.length > 0 && (
                                    <div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setPracasExpandidas(prev => {
                                            const next = new Set(prev)
                                            next.has(i) ? next.delete(i) : next.add(i)
                                            return next
                                          })
                                        }}
                                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
                                      >
                                        {pracasExpandidas.has(i) ? '▲ Ocultar praças' : `▼ ${linha.pracas.length} praças cruzadas`}
                                      </button>
                                      {pracasExpandidas.has(i) && (
                                        <table className="text-xs border-collapse">
                                          <tbody>
                                            {linha.pracas.map((praca, pi) => (
                                              <tr key={pi}>
                                                <td className="pr-6 py-0.5 text-slate-400">
                                                  {praca.nome}
                                                  {praca.rodovia && <span className="ml-1 text-slate-600">({praca.rodovia})</span>}
                                                </td>
                                                <td className="text-right font-mono tabular-nums text-slate-300">{formatBRL(praca.valor)}</td>
                                              </tr>
                                            ))}
                                            <tr className="border-t border-gray-700">
                                              <td className="pr-6 py-0.5 text-slate-500 font-medium">Total</td>
                                              <td className="text-right font-mono tabular-nums text-slate-300 font-medium">{formatBRL(linha.pedagio)}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Right column: provider comparison (only when available) */}
                                {linha.comparacao && (() => {
                                  const comp = linha.comparacao!
                                  const valores = (Object.values(comp) as Array<ComparacaoResult[keyof ComparacaoResult]>)
                                    .filter((r): r is RotaResult => !!r && 'km' in r && (r as RotaResult).pedagio > 0)
                                    .map(r => r.pedagio)
                                  const minP = valores.length > 0 ? Math.min(...valores) : 0
                                  const maxP = valores.length > 0 ? Math.max(...valores) : 0
                                  const diverge = valores.length > 1 && minP > 0 && (maxP - minP) / minP > 0.10
                                  return (
                                    <div className="lg:w-72 shrink-0">
                                      <p className="text-xs text-slate-500 font-medium mb-2">Comparação de provedores</p>
                                      <table className="text-xs border-collapse w-full">
                                        <thead>
                                          <tr className="text-slate-600">
                                            <th className="text-left pb-1 font-medium">Provedor</th>
                                            <th className="text-right pb-1 font-medium px-2">KM</th>
                                            <th className="text-right pb-1 font-medium px-2">Pedágio</th>
                                            <th className="text-right pb-1 font-medium">Conf.</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(Object.entries(comp) as [ProviderFonte, ComparacaoResult[keyof ComparacaoResult]][]).map(([nome, res]) => {
                                            if (!res) return null
                                            const isError = 'error' in res
                                            const isDivergente = !isError && diverge && (res as RotaResult).pedagio > 0
                                            return (
                                              <tr key={nome} className={`border-t border-gray-800 ${isDivergente ? 'bg-amber-900/20' : ''}`}>
                                                <td className="py-1 pr-2 text-slate-400">{labelFonte(nome)}</td>
                                                {isError ? (
                                                  <td colSpan={3} className="py-1 px-2 text-red-400">{(res as { error: string }).error}</td>
                                                ) : (
                                                  <>
                                                    <td className="py-1 px-2 text-right font-mono tabular-nums text-slate-300">{Math.round((res as RotaResult).km)} km</td>
                                                    <td className="py-1 px-2 text-right font-mono tabular-nums text-slate-300">{formatBRL((res as RotaResult).pedagio)}</td>
                                                    <td className="py-1 text-right">{badgeConfianca((res as RotaResult).confianca as Confianca)}</td>
                                                  </>
                                                )}
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                      {diverge && (
                                        <p className="mt-2 text-xs text-amber-400">⚠ Divergência &gt;10% entre provedores</p>
                                      )}
                                    </div>
                                  )
                                })()}

                              </div>
                            </td>
                          </tr>
                        )}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/page.tsx"
git commit -m "feat: accordion two-column layout with collapsible pracas"
```

---

### Task 7: Validacao Metadata + Page Upgrades

**Files:**
- Create: `app/(protected)/validacao/layout.tsx`
- Modify: `app/(protected)/validacao/page.tsx`

- [ ] **Step 1: Create `app/(protected)/validacao/layout.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rotaz — Validação',
}

export default function ValidacaoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 2: Replace `app/(protected)/validacao/page.tsx`**

```tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProviderFonte, ComparacaoResult, RotaResult } from '@/types/routing'
import { compararProvedores } from '@/lib/actions/comparar'
import { useProviderSettings } from '@/hooks/useProviderSettings'

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
          <form onSubmit={comparar} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Origem</label>
              <input type="text" value={origem} onChange={e => setOrigem(e.target.value)} placeholder="São Paulo, SP" required
                className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 w-52 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Destino</label>
              <input type="text" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Curitiba, PR" required
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
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/validacao/layout.tsx" "app/(protected)/validacao/page.tsx"
git commit -m "feat: validacao upgrades — metadata, delta column, historico, usar no frete"
```

---

### Task 8: Calculadora — Query Param Pre-fill

**Context:** Reads `?origem=X&destino=Y&eixos=N` set by /validacao's "Usar no frete" button. Uses a Suspense-wrapped sub-component required by Next.js App Router for `useSearchParams` in client components.

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 1: Update React import and add Next.js navigation import**

Replace:
```typescript
import React, { useState, useRef } from 'react'
```
With:
```typescript
import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
```

- [ ] **Step 2: Add `SearchParamsReader` component before `Home()`**

After all imports and before `type StatusGlobal`, add:

```typescript
function SearchParamsReader({ onParams }: { onParams: (o: string, d: string, e: number) => void }) {
  const params = useSearchParams()
  useEffect(() => {
    const o = params.get('origem')
    const d = params.get('destino')
    const e = Number(params.get('eixos') ?? 6)
    if (o && d) onParams(o, d, e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
```

- [ ] **Step 3: Add `handleQueryParams` inside `Home()` after `onDrop`**

```typescript
  function handleQueryParams(o: string, d: string, e: number) {
    const nova: LinhaFrete = { cliente: '', origem: o, destino: d, uf: '', eixos: e, status: 'pendente' }
    setLinhas([nova])
    window.history.replaceState({}, '', '/')
  }
```

- [ ] **Step 4: Mount `SearchParamsReader` as first child inside the outer `<div>`**

Inside the `<main>` element, as the very first child inside `<div className="max-w-7xl mx-auto px-6 py-8 space-y-4">`, add:

```tsx
        <Suspense fallback={null}>
          <SearchParamsReader onParams={handleQueryParams} />
        </Suspense>
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/page.tsx"
git commit -m "feat: read query params on mount to pre-fill route from /validacao"
```

---

## Self-Review

**Spec coverage:**
- [x] Brand colors (azul-noite bg, sky accent, slate text) → Task 1
- [x] Tagline + metadata → Task 1
- [x] Logo Rz wordmark, NavBar, nav links → Task 2
- [x] Provider settings side panel (replaces popover) → Task 2
- [x] `<title>` per page → Tasks 1, 7
- [x] Drag-and-drop upload, format toggle in zone, model download link → Task 3
- [x] File info bar after upload + Limpar → Task 3
- [x] Unified action bar, disabled tooltips → Task 4
- [x] Composição Veicular toggle moved into action bar → Task 4
- [x] Fonte badge with color (sky/amber/green) → Task 5
- [x] ⚠ for `pedagio === 0` → Task 5
- [x] KM integer (`Math.round`) → Tasks 5, 6
- [x] Amber row highlight for divergence >10% → Task 5
- [x] `font-mono tabular-nums` on all numbers → Tasks 5, 6, 7
- [x] Accordion two-column (grade left, comparação right) → Task 6
- [x] Praças collapsible in accordion → Task 6
- [x] Validacao no own header → Task 7
- [x] Validacao histórico sessionStorage (last 5) → Task 7
- [x] Validacao delta column vs. best → Task 7
- [x] "Usar no frete" button → Task 7
- [x] Query params reader + route pre-fill → Task 8
- [x] `transition-colors` on all interactive elements → all tasks

**Placeholder scan:** Clean — no TBD, TODO, or vague requirements.

**Type consistency:**
- `fonteCorClass(fonte?: ProviderFonte)` defined Task 5, used Task 5 ✓
- `divergeRow(linha: LinhaFrete): boolean` defined Task 5, used Task 5 ✓
- `pracasExpandidas: Set<number>` (page.tsx) defined Task 6, used Task 6 ✓
- `pracasExpandidas: Set<string>` (validacao) defined Task 7, different file ✓
- `SearchParamsReader` defined Task 8, used Task 8 ✓
- `handleQueryParams(o, d, e)` defined Task 8, passed to `SearchParamsReader.onParams` Task 8 ✓
- `HistoricoItem` defined Task 7, used in `historico: HistoricoItem[]` Task 7 ✓
- `calcularDelta(pedagio, minPedagio)` defined Task 7, called in `renderTabela` Task 7 ✓
