'use server'

import { ProviderFonte, ComparacaoResult } from '@/types/routing'
import { ALL_PROVIDERS } from '@/lib/routing/chain'

export async function compararProvedores(
  origem: string,
  destino: string,
  eixos: number,
  providers: ProviderFonte[]
): Promise<ComparacaoResult> {
  const entries = providers
    .filter(nome => nome in ALL_PROVIDERS)
    .map(nome => ({
      nome,
      provider: ALL_PROVIDERS[nome as keyof typeof ALL_PROVIDERS],
    }))

  const results = await Promise.allSettled(
    entries.map(({ provider }) => {
      if ('isActive' in provider && !(provider as { isActive(): boolean }).isActive()) {
        return Promise.reject(new Error('API key não configurada'))
      }
      return provider.calcularRota(origem, destino, eixos)
    })
  )

  const out: ComparacaoResult = {}
  for (let i = 0; i < entries.length; i++) {
    const { nome } = entries[i]
    const result = results[i]
    if (result.status === 'fulfilled') {
      out[nome] = result.value
    } else {
      out[nome] = { error: result.reason?.message ?? String(result.reason) }
    }
  }
  return out
}
