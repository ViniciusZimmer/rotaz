import { RoutingProvider, RotaResult, PracaResult } from '@/types/routing'
import { geocodeCidade } from './geocode'

const HERE_API_KEY = process.env.HERE_API_KEY ?? ''

export class HereProvider implements RoutingProvider {
  nome = 'here' as const

  isActive(): boolean {
    return !!HERE_API_KEY
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    if (!HERE_API_KEY) throw new Error('HERE_API_KEY não configurada')

    const [orig, dest] = await Promise.all([
      geocodeCidade(origem),
      geocodeCidade(destino),
    ])
    if (!orig || !dest) throw new Error(`Cidade não encontrada: ${!orig ? origem : destino}`)

    const params = new URLSearchParams({
      transportMode: 'truck',
      origin: `${orig.lat},${orig.lng}`,
      destination: `${dest.lat},${dest.lng}`,
      'return': 'summary,tolls',
      'vehicle[axleCount]': String(eixos),
      apikey: HERE_API_KEY,
    })

    const res = await fetch(`https://router.hereapi.com/v8/routes?${params}`)
    if (!res.ok) throw new Error(`HERE API HTTP ${res.status}`)

    const data = await res.json()
    const sections: HereSection[] = data.routes?.[0]?.sections ?? []

    let totalMeters = 0
    const pracas: PracaResult[] = []

    for (const section of sections) {
      totalMeters += section.summary?.length ?? 0
      for (const toll of section.tolls ?? []) {
        const valor = toll.tollFare?.price ?? toll.fare?.summary?.totalAmount ?? 0
        if (valor > 0) {
          pracas.push({
            nome: toll.tollPlaza?.name ?? 'Praça sem nome',
            valor,
            rodovia: toll.tollPlaza?.id,
          })
        }
      }
    }

    const km = Math.round(totalMeters / 1000)
    const pedagio = Math.round(pracas.reduce((sum, p) => sum + p.valor, 0) * 100) / 100

    return {
      km,
      pedagio,
      pracas: pracas.length > 0 ? pracas : undefined,
      fonte: 'here',
      confianca: 'media',
    }
  }
}

interface HereSection {
  summary?: { length: number }
  tolls?: Array<{
    tollPlaza?: { id?: string; name?: string }
    tollFare?: { price?: number; currency?: string }
    fare?: { summary?: { totalAmount?: number } }
  }>
}
