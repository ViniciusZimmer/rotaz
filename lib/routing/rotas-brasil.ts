import { RoutingProvider, RotaResult } from '@/types/routing'
import { calcularRota as calcularRotaRB } from '../rotas-brasil'

export class RotasBrasilProvider implements RoutingProvider {
  nome = 'rotas-brasil' as const

  isActive(): boolean {
    return !!process.env.ROTAS_BRASIL_TOKEN
  }

  async calcularRota(
    origem: string,
    destino: string,
    eixos: number
  ): Promise<RotaResult> {
    const result = await calcularRotaRB(origem, destino, eixos)
    return {
      km: result.km,
      pedagio: result.pedagio,
      fonte: 'rotas-brasil',
      confianca: 'media',
    }
  }
}
