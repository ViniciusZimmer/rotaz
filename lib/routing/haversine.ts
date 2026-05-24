import { RoutingProvider, RotaResult } from '@/types/routing'
import { calcularKM } from '../google-maps'
import { getPedagio } from '../pedagio'

export class HaversineProvider implements RoutingProvider {
  nome = 'estimativa' as const

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    const km = await calcularKM(origem, destino)
    const pedagio = getPedagio(origem, destino, km, eixos)
    return { km, pedagio, fonte: 'estimativa', confianca: 'baixa' }
  }
}
