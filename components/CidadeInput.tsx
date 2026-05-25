'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function CidadeInput({ value, onChange, placeholder, required, className }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (value.length < 2) {
      timerRef.current = setTimeout(() => { setSuggestions([]); setOpen(false) }, 0)
      return () => clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cidades?q=${encodeURIComponent(value)}`)
        const data: string[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
        setFocused(-1)
      } catch {}
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [value])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function select(city: string) {
    onChange(city)
    setOpen(false)
    setSuggestions([])
  }

  async function onBlur() {
    setOpen(false)
    if (!value.trim() || /^.+,\s*[A-Z]{2}$/.test(value)) return
    try {
      const res = await fetch(`/api/cidades?q=${encodeURIComponent(value)}`)
      const data: string[] = await res.json()
      if (data.length > 0) onChange(data[0])
    } catch {}
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocused(f => Math.min(f + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocused(f => Math.max(f - 1, 0))
    } else if (e.key === 'Enter' && focused >= 0) {
      e.preventDefault()
      select(suggestions[focused])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {open && (
        <ul className="absolute z-50 top-full left-0 mt-1 w-full min-w-[13rem] bg-gray-800 border border-gray-700 rounded shadow-xl max-h-56 overflow-y-auto">
          {suggestions.map((c, i) => (
            <li
              key={c}
              onMouseDown={() => select(c)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                i === focused ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-gray-700'
              }`}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
