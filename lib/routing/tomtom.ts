import { RoutingProvider, RotaResult } from '@/types/routing'
import { geocodeCidade } from './geocode'

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY ?? ''

export class TomTomProvider implements RoutingProvider {
  nome = 'tomtom' as const

  isActive(): boolean {
    return !!TOMTOM_API_KEY
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    if (!TOMTOM_API_KEY) throw new Error('TOMTOM_API_KEY não configurada')

    const [orig, dest] = await Promise.all([
      geocodeCidade(origem),
      geocodeCidade(destino),
    ])
    if (!orig || !dest) throw new Error(`Cidade não encontrada: ${!orig ? origem : destino}`)

    const url =
      `https://api.tomtom.com/routing/1/calculateRoute/` +
      `${orig.lat},${orig.lng}:${dest.lat},${dest.lng}/json` +
      `?vehicleCommercial=true` +
      `&vehicleAxles=${eixos}` +
      `&routeType=fastest` +
      `&traffic=false` +
      `&key=${TOMTOM_API_KEY}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`TomTom API HTTP ${res.status}`)

    const data = await res.json()
    const summary = data.routes?.[0]?.summary

    const km = Math.round((summary?.lengthInMeters ?? 0) / 1000)
    // TomTom pode retornar toll cost em summary.tollCost ou summary.totalCost.toll
    // Verificar o campo correto na resposta real: console.log(summary)
    const pedagio = Math.round(
      (summary?.tollCost?.amount ?? summary?.totalCost?.toll ?? 0) * 100
    ) / 100

    return {
      km,
      pedagio,
      fonte: 'tomtom',
      confianca: 'media',
    }
  }
}
