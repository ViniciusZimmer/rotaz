import { RoutingProvider, RotaResult } from '@/types/routing'
import { calcularKM } from '../google-maps'
import { geocodeCidade } from './geocode'
import { getPedagio } from '../pedagio'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export class HaversineProvider implements RoutingProvider {
  nome = 'estimativa' as const

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    // If Google Maps API key set, use real road distance
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const km = await calcularKM(origem, destino)
        if (km > 0) {
          const pedagio = getPedagio(origem, destino, km, eixos)
          return { km, pedagio, fonte: 'estimativa', confianca: 'baixa' }
        }
      } catch {}
    }

    // Geocode both cities (COORDS → Google Geocoding → Nominatim) then haversine × 1.35
    const [c1, c2] = await Promise.all([geocodeCidade(origem), geocodeCidade(destino)])
    const km = (c1 && c2)
      ? Math.round(haversineKm(c1.lat, c1.lng, c2.lat, c2.lng) * 1.35)
      : 500
    const pedagio = getPedagio(origem, destino, km, eixos)
    return { km, pedagio, fonte: 'estimativa', confianca: 'baixa' }
  }
}
