import { ProviderFonte, PracaResult, ComparacaoResult } from './routing'

export type TipoCarga =
  | 'carga_geral'
  | 'frigorificado'
  | 'granel_solido'
  | 'granel_liquido'
  | 'conteinerizada'
  | 'neogranel'
  | 'granel_pressurizado'

export interface LinhaFrete {
  cliente: string
  origem: string
  destino: string
  uf: string
  eixos: number
  tipoCarga?: TipoCarga
  retornoVazio?: boolean
  composicaoVeicular?: boolean
  km?: number
  pedagio?: number
  pedagioNaoComposicao?: number
  antt?: number
  freteTotal?: number
  status?: 'pendente' | 'calculando' | 'ok' | 'erro'
  erro?: string
  fonte?: ProviderFonte
  confianca?: 'alta' | 'media' | 'baixa'
  pracas?: PracaResult[]
  comparacao?: ComparacaoResult
  variacaoCompleta?: LinhaVariacao[]
}

export interface LinhaVariacao {
  eixos: number
  composicaoVeicular: boolean
  altoDesempenho: boolean
  km: number
  pedagio: number
  antt: number
  freteTotal: number
}

export interface TabelaCliente {
  cliente: string
  linhas: LinhaFrete[]
}

export interface ResultadoCalculo {
  km: number
  pedagio: number
  antt: number
  freteTotal: number
}
