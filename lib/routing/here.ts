import { RoutingProvider, RotaResult, PracaResult } from '@/types/routing'
import { geocodeCidade } from './geocode'

export class HereProvider implements RoutingProvider {
  nome = 'here' as const

  private get apiKey() { return process.env.HERE_API_KEY ?? '' }

  isActive(): boolean {
    return !!this.apiKey
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    if (!this.apiKey) throw new Error('HERE_API_KEY não configurada')

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
      apikey: this.apiKey,
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
        const valor = toll.fares?.reduce(
          (sum: number, f: HereFare) => sum + (f.price?.value ?? 0), 0
        ) ?? 0
        if (valor > 0) {
          pracas.push({
            nome: toll.tollCollectionLocations?.[0]?.name ?? toll.tollSystem ?? 'Praça sem nome',
            valor,
            rodovia: toll.tollSystem,
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

interface HereFare {
  name?: string
  price?: { type?: string; currency?: string; value?: number }
  reason?: string
}

interface HereSection {
  summary?: { length: number; duration?: number }
  tolls?: Array<{
    countryCode?: string
    tollSystem?: string
    fares?: HereFare[]
    tollCollectionLocations?: Array<{ name?: string; location?: { lat: number; lng: number } }>
  }>
}
