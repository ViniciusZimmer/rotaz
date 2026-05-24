export type ProviderFonte =
  | 'here'
  | 'tomtom'
  | 'rotas-brasil'
  | 'banco-proprio'
  | 'estimativa'

export interface PracaResult {
  nome: string
  valor: number
  rodovia?: string
}

export interface RotaResult {
  km: number
  pedagio: number
  pracas?: PracaResult[]
  fonte: ProviderFonte
  confianca: 'alta' | 'media' | 'baixa'
}

export interface RoutingProvider {
  nome: ProviderFonte
  calcularRota(origem: string, destino: string, eixos: number): Promise<RotaResult>
}

export type ComparacaoItem = RotaResult | { error: string }
export type ComparacaoResult = Partial<Record<ProviderFonte, ComparacaoItem>>
