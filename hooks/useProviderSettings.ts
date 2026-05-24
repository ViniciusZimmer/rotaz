import { useState, useEffect } from 'react'
import { ProviderFonte } from '@/types/routing'

type ProviderSettings = Partial<Record<ProviderFonte, boolean>>

const STORAGE_KEY = 'frete_provider_settings'

const DEFAULTS: ProviderSettings = {
  here: true,
  tomtom: false,
  'rotas-brasil': true,
  estimativa: false,
}

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch {}
  }, [])

  function toggle(fonte: ProviderFonte) {
    setSettings(prev => {
      const next = { ...prev, [fonte]: !prev[fonte] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const activeProviders = (Object.keys(settings) as ProviderFonte[]).filter(
    k => settings[k] === true
  )

  return { settings, toggle, activeProviders }
}
