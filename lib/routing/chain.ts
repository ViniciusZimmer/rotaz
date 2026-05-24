import { RotaResult } from '@/types/routing'
import { HereProvider } from './here'
import { TomTomProvider } from './tomtom'
import { RotasBrasilProvider } from './rotas-brasil'
import { HaversineProvider } from './haversine'
import { getCached, setCached } from '../route-cache'

const HERE = new HereProvider()
const TOMTOM = new TomTomProvider()
const ROTAS_BRASIL = new RotasBrasilProvider()
const HAVERSINE = new HaversineProvider()

export const ALL_PROVIDERS = {
  here: HERE,
  tomtom: TOMTOM,
  'rotas-brasil': ROTAS_BRASIL,
  estimativa: HAVERSINE,
} as const

const DEFAULT_ORDER = ['here', 'tomtom', 'rotas-brasil', 'estimativa']

function getOrder(): string[] {
  const env = process.env.ROUTING_PROVIDER_ORDER
  if (!env) return DEFAULT_ORDER
  return env.split(',').map(s => s.trim()).filter(s => s in ALL_PROVIDERS)
}

export async function calcularRotaComChain(
  origem: string,
  destino: string,
  eixos: number
): Promise<RotaResult> {
  const cached = getCached(origem, destino, eixos)
  if (cached && cached.pedagio > 0) {
    return {
      km: cached.km,
      pedagio: cached.pedagio,
      pracas: cached.pracas,
      fonte: (cached.fonte as RotaResult['fonte']) ?? 'estimativa',
      confianca: (cached.confianca as RotaResult['confianca']) ?? 'media',
    }
  }

  const order = getOrder()

  for (const name of order) {
    const provider = ALL_PROVIDERS[name as keyof typeof ALL_PROVIDERS]
    if (!provider) continue

    if ('isActive' in provider && !(provider as { isActive(): boolean }).isActive()) {
      continue
    }

    try {
      const result = await provider.calcularRota(origem, destino, eixos)

      if (result.km <= 0) {
        console.warn(`[chain] ${name} retornou km=0, tentando próximo`)
        continue
      }

      if (result.pedagio <= 0 && name !== 'estimativa') {
        console.warn(`[chain] ${name} retornou pedagio=0, tentando próximo`)
        continue
      }

      setCached(origem, destino, eixos, {
        km: result.km,
        pedagio: result.pedagio,
        pracas: result.pracas,
        fonte: result.fonte,
        confianca: result.confianca,
      })

      return result
    } catch (err) {
      console.warn(`[chain] ${name} falhou:`, err instanceof Error ? err.message : err)
    }
  }

  return { km: 500, pedagio: 0, fonte: 'estimativa', confianca: 'baixa' }
}
