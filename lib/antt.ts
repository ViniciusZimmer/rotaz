// Tabela ANTT - Resolução nº 5.867/2020, atualizada em 20/03/2026 (PORT.SUROC Nº 04/2026)
// Fórmula: Valor = (km × CCD) + CC
// Fonte: https://calculadorafrete.antt.gov.br/
// 4 tabelas: composicao(S/N) × altoDesempenho(S/N)

export type TipoCarga =
  | 'carga_geral'
  | 'frigorificado'
  | 'granel_solido'
  | 'granel_liquido'
  | 'conteinerizada'
  | 'neogranel'
  | 'granel_pressurizado'

interface Coeficientes { ccd: number; cc: number }
type TabelaEixo = Record<TipoCarga, Coeficientes>

// Tabela A — veículo simples, sem alto desempenho
const T_SIMPLES: Record<number, TabelaEixo> = {
  2: {
    carga_geral:         { ccd: 5.2729, cc: 515.17 },
    frigorificado:       { ccd: 6.2111, cc: 564.07 },
    granel_solido:       { ccd: 5.2729, cc: 515.17 },
    granel_liquido:      { ccd: 5.3358, cc: 515.17 },
    conteinerizada:      { ccd: 5.2729, cc: 515.17 },
    neogranel:           { ccd: 5.2729, cc: 515.17 },
    granel_pressurizado: { ccd: 5.9994, cc: 574.29 },
  },
  3: {
    carga_geral:         { ccd: 5.2729, cc: 515.17 },
    frigorificado:       { ccd: 6.2111, cc: 564.07 },
    granel_solido:       { ccd: 5.2729, cc: 515.17 },
    granel_liquido:      { ccd: 5.3358, cc: 515.17 },
    conteinerizada:      { ccd: 5.2729, cc: 515.17 },
    neogranel:           { ccd: 5.2729, cc: 515.17 },
    granel_pressurizado: { ccd: 5.9994, cc: 574.29 },
  },
  4: {
    carga_geral:         { ccd: 5.2729, cc: 515.17 },
    frigorificado:       { ccd: 6.2111, cc: 564.07 },
    granel_solido:       { ccd: 5.2729, cc: 515.17 },
    granel_liquido:      { ccd: 5.3358, cc: 515.17 },
    conteinerizada:      { ccd: 5.2729, cc: 515.17 },
    neogranel:           { ccd: 5.2729, cc: 515.17 },
    granel_pressurizado: { ccd: 5.9994, cc: 574.29 },
  },
  5: {
    carga_geral:         { ccd: 5.9994, cc: 574.29 },
    frigorificado:       { ccd: 7.0457, cc: 623.20 },
    granel_solido:       { ccd: 5.9994, cc: 574.29 },
    granel_liquido:      { ccd: 6.0623, cc: 574.29 },
    conteinerizada:      { ccd: 5.9994, cc: 574.29 },
    neogranel:           { ccd: 5.9994, cc: 574.29 },
    granel_pressurizado: { ccd: 5.9994, cc: 574.29 },
  },
  6: {
    carga_geral:         { ccd: 6.6896, cc: 588.17 },
    frigorificado:       { ccd: 7.8586, cc: 637.07 },
    granel_solido:       { ccd: 6.6896, cc: 588.17 },
    granel_liquido:      { ccd: 6.7525, cc: 588.17 },
    conteinerizada:      { ccd: 6.6896, cc: 588.17 },
    neogranel:           { ccd: 6.6896, cc: 588.17 },
    granel_pressurizado: { ccd: 6.6896, cc: 588.17 },
  },
  7: {
    carga_geral:         { ccd: 7.1066, cc: 695.68 },
    frigorificado:       { ccd: 8.2933, cc: 749.43 },
    granel_solido:       { ccd: 7.1066, cc: 695.68 },
    granel_liquido:      { ccd: 7.1695, cc: 695.68 },
    conteinerizada:      { ccd: 7.1066, cc: 695.68 },
    neogranel:           { ccd: 7.1066, cc: 695.68 },
    granel_pressurizado: { ccd: 7.1066, cc: 695.68 },
  },
  9: {
    carga_geral:         { ccd: 7.9200, cc: 746.78 },
    frigorificado:       { ccd: 9.2644, cc: 802.65 },
    granel_solido:       { ccd: 7.9200, cc: 746.78 },
    granel_liquido:      { ccd: 7.9829, cc: 746.78 },
    conteinerizada:      { ccd: 7.9200, cc: 746.78 },
    neogranel:           { ccd: 7.9200, cc: 746.78 },
    granel_pressurizado: { ccd: 7.9200, cc: 746.78 },
  },
}

// Tabela B — composição veicular, sem alto desempenho
const T_COMPOSICAO: Record<number, TabelaEixo> = {
  2: {
    carga_geral:         { ccd: 4.0031, cc: 436.39 },
    frigorificado:       { ccd: 4.7442, cc: 502.29 },
    granel_solido:       { ccd: 4.0338, cc: 444.84 },
    granel_liquido:      { ccd: 4.1052, cc: 455.84 },
    conteinerizada:      { ccd: 5.1397, cc: 526.13 },
    neogranel:           { ccd: 3.6028, cc: 436.39 },
    granel_pressurizado: { ccd: 7.0646, cc: 731.90 },
  },
  3: {
    carga_geral:         { ccd: 5.1295, cc: 523.33 },
    frigorificado:       { ccd: 6.0679, cc: 601.96 },
    granel_solido:       { ccd: 5.1660, cc: 533.36 },
    granel_liquido:      { ccd: 5.2583, cc: 550.10 },
    conteinerizada:      { ccd: 5.1397, cc: 526.13 },
    neogranel:           { ccd: 5.1281, cc: 522.93 },
    granel_pressurizado: { ccd: 7.0646, cc: 731.90 },
  },
  4: {
    carga_geral:         { ccd: 5.8178, cc: 568.72 },
    frigorificado:       { ccd: 6.9216, cc: 663.16 },
    granel_solido:       { ccd: 5.8464, cc: 576.59 },
    granel_liquido:      { ccd: 5.9955, cc: 600.27 },
    conteinerizada:      { ccd: 5.7767, cc: 557.42 },
    neogranel:           { ccd: 5.8441, cc: 575.96 },
    granel_pressurizado: { ccd: 7.0646, cc: 731.90 },
  },
  5: {
    carga_geral:         { ccd: 6.7126, cc: 635.08 },
    frigorificado:       { ccd: 7.9337, cc: 732.07 },
    granel_solido:       { ccd: 6.7381, cc: 642.10 },
    granel_liquido:      { ccd: 6.9002, cc: 669.38 },
    conteinerizada:      { ccd: 6.6765, cc: 625.16 },
    neogranel:           { ccd: 6.7126, cc: 635.08 },
    granel_pressurizado: { ccd: 7.0646, cc: 731.90 },
  },
  6: {
    carga_geral:         { ccd: 7.4124, cc: 648.95 },
    frigorificado:       { ccd: 8.7563, cc: 745.94 },
    granel_solido:       { ccd: 7.4408, cc: 656.76 },
    granel_liquido:      { ccd: 7.6080, cc: 685.45 },
    conteinerizada:      { ccd: 7.3776, cc: 639.38 },
    neogranel:           { ccd: 7.4124, cc: 648.95 },
    granel_pressurizado: { ccd: 7.8089, cc: 757.99 },
  },
  7: {
    carga_geral:         { ccd: 8.1252, cc: 803.22 },
    frigorificado:       { ccd: 9.6471, cc: 949.16 },
    granel_solido:       { ccd: 8.0855, cc: 792.30 },
    granel_liquido:      { ccd: 8.2192, cc: 811.76 },
    conteinerizada:      { ccd: 8.0832, cc: 791.67 },
    neogranel:           { ccd: 8.1252, cc: 803.22 },
    granel_pressurizado: { ccd: 7.8089, cc: 757.99 },
  },
  9: {
    carga_geral:         { ccd: 9.2466, cc: 872.44 },
    frigorificado:       { ccd: 10.9629, cc: 1030.58 },
    granel_solido:       { ccd: 9.2662, cc: 877.83 },
    granel_liquido:      { ccd: 9.4199, cc: 902.80 },
    conteinerizada:      { ccd: 9.1859, cc: 855.76 },
    neogranel:           { ccd: 9.2466, cc: 872.44 },
    granel_pressurizado: { ccd: 9.7697, cc: 1016.29 },
  },
}

// Tabela C — veículo simples, com alto desempenho
const T_SIMPLES_ALTO: Record<number, TabelaEixo> = {
  2: {
    carga_geral:         { ccd: 4.5780, cc: 194.44 },
    frigorificado:       { ccd: 5.5300, cc: 226.06 },
    granel_solido:       { ccd: 4.5780, cc: 194.44 },
    granel_liquido:      { ccd: 4.6409, cc: 194.44 },
    conteinerizada:      { ccd: 4.5780, cc: 194.44 },
    neogranel:           { ccd: 4.5780, cc: 194.44 },
    granel_pressurizado: { ccd: 5.1667, cc: 207.18 },
  },
  3: {
    carga_geral:         { ccd: 4.5780, cc: 194.44 },
    frigorificado:       { ccd: 5.5300, cc: 226.06 },
    granel_solido:       { ccd: 4.5780, cc: 194.44 },
    granel_liquido:      { ccd: 4.6409, cc: 194.44 },
    conteinerizada:      { ccd: 4.5780, cc: 194.44 },
    neogranel:           { ccd: 4.5780, cc: 194.44 },
    granel_pressurizado: { ccd: 5.1667, cc: 207.18 },
  },
  4: {
    carga_geral:         { ccd: 4.5780, cc: 194.44 },
    frigorificado:       { ccd: 5.5300, cc: 226.06 },
    granel_solido:       { ccd: 4.5780, cc: 194.44 },
    granel_liquido:      { ccd: 4.6409, cc: 194.44 },
    conteinerizada:      { ccd: 4.5780, cc: 194.44 },
    neogranel:           { ccd: 4.5780, cc: 194.44 },
    granel_pressurizado: { ccd: 5.1667, cc: 207.18 },
  },
  5: {
    carga_geral:         { ccd: 5.1667, cc: 207.18 },
    frigorificado:       { ccd: 6.2268, cc: 238.80 },
    granel_solido:       { ccd: 5.1667, cc: 207.18 },
    granel_liquido:      { ccd: 5.2296, cc: 207.18 },
    conteinerizada:      { ccd: 5.1667, cc: 207.18 },
    neogranel:           { ccd: 5.1667, cc: 207.18 },
    granel_pressurizado: { ccd: 5.1667, cc: 207.18 },
  },
  6: {
    carga_geral:         { ccd: 5.8246, cc: 210.17 },
    frigorificado:       { ccd: 7.0074, cc: 241.78 },
    granel_solido:       { ccd: 5.8246, cc: 210.17 },
    granel_liquido:      { ccd: 5.8875, cc: 210.17 },
    conteinerizada:      { ccd: 5.8246, cc: 210.17 },
    neogranel:           { ccd: 5.8246, cc: 210.17 },
    granel_pressurizado: { ccd: 5.8246, cc: 210.17 },
  },
  7: {
    carga_geral:         { ccd: 6.0332, cc: 240.30 },
    frigorificado:       { ccd: 7.2350, cc: 275.04 },
    granel_solido:       { ccd: 6.0332, cc: 240.30 },
    granel_liquido:      { ccd: 6.0961, cc: 240.30 },
    conteinerizada:      { ccd: 6.0332, cc: 240.30 },
    neogranel:           { ccd: 6.0332, cc: 240.30 },
    granel_pressurizado: { ccd: 5.8246, cc: 210.17 },
  },
  9: {
    carga_geral:         { ccd: 6.7460, cc: 254.35 },
    frigorificado:       { ccd: 8.1060, cc: 290.47 },
    granel_solido:       { ccd: 6.7460, cc: 254.35 },
    granel_liquido:      { ccd: 6.8089, cc: 254.35 },
    conteinerizada:      { ccd: 6.7460, cc: 254.35 },
    neogranel:           { ccd: 6.7460, cc: 254.35 },
    granel_pressurizado: { ccd: 6.7460, cc: 254.35 },
  },
}

// Tabela D — composição veicular, com alto desempenho
const T_COMPOSICAO_ALTO: Record<number, TabelaEixo> = {
  2: {
    carga_geral:         { ccd: 3.4259, cc: 166.60 },
    frigorificado:       { ccd: 4.1215, cc: 198.62 },
    granel_solido:       { ccd: 3.4369, cc: 168.42 },
    granel_liquido:      { ccd: 3.4827, cc: 170.79 },
    conteinerizada:      { ccd: 4.3763, cc: 189.72 },
    neogranel:           { ccd: 3.0257, cc: 166.60 },
    granel_pressurizado: { ccd: 5.8647, cc: 241.14 },
  },
  3: {
    carga_geral:         { ccd: 4.3727, cc: 189.11 },
    frigorificado:       { ccd: 5.2426, cc: 225.01 },
    granel_solido:       { ccd: 4.3858, cc: 191.28 },
    granel_liquido:      { ccd: 4.4391, cc: 194.88 },
    conteinerizada:      { ccd: 4.3763, cc: 189.72 },
    neogranel:           { ccd: 4.3722, cc: 189.03 },
    granel_pressurizado: { ccd: 5.8647, cc: 241.14 },
  },
  4: {
    carga_geral:         { ccd: 4.9981, cc: 205.98 },
    frigorificado:       { ccd: 6.0096, cc: 247.41 },
    granel_solido:       { ccd: 5.0084, cc: 207.68 },
    granel_liquido:      { ccd: 5.1022, cc: 212.78 },
    conteinerizada:      { ccd: 4.9834, cc: 203.55 },
    neogranel:           { ccd: 5.0076, cc: 207.54 },
    granel_pressurizado: { ccd: 5.8647, cc: 241.14 },
  },
  5: {
    carga_geral:         { ccd: 5.7382, cc: 220.28 },
    frigorificado:       { ccd: 6.8611, cc: 262.25 },
    granel_solido:       { ccd: 5.7474, cc: 221.79 },
    granel_liquido:      { ccd: 5.8459, cc: 227.67 },
    conteinerizada:      { ccd: 5.7253, cc: 218.14 },
    neogranel:           { ccd: 5.7382, cc: 220.28 },
    granel_pressurizado: { ccd: 5.8647, cc: 241.14 },
  },
  6: {
    carga_geral:         { ccd: 6.4057, cc: 223.27 },
    frigorificado:       { ccd: 7.6513, cc: 265.24 },
    granel_solido:       { ccd: 6.4159, cc: 224.95 },
    granel_liquido:      { ccd: 6.5163, cc: 231.13 },
    conteinerizada:      { ccd: 6.3932, cc: 221.21 },
    neogranel:           { ccd: 6.4057, cc: 223.27 },
    granel_pressurizado: { ccd: 6.5481, cc: 246.76 },
  },
  7: {
    carga_geral:         { ccd: 6.8012, cc: 263.47 },
    frigorificado:       { ccd: 8.1234, cc: 318.08 },
    granel_solido:       { ccd: 6.7870, cc: 261.12 },
    granel_liquido:      { ccd: 6.8753, cc: 265.31 },
    conteinerizada:      { ccd: 6.7861, cc: 260.98 },
    neogranel:           { ccd: 6.8012, cc: 263.47 },
    granel_pressurizado: { ccd: 6.5481, cc: 246.76 },
  },
  9: {
    carga_geral:         { ccd: 7.7797, cc: 281.43 },
    frigorificado:       { ccd: 9.2734, cc: 339.58 },
    granel_solido:       { ccd: 7.7868, cc: 282.59 },
    granel_liquido:      { ccd: 7.8823, cc: 287.97 },
    conteinerizada:      { ccd: 7.7579, cc: 277.83 },
    neogranel:           { ccd: 7.7797, cc: 281.43 },
    granel_pressurizado: { ccd: 7.9676, cc: 312.42 },
  },
}

export interface OpcoesANTT {
  eixos: number
  tipoCarga?: TipoCarga
  retornoVazio?: boolean
  composicaoVeicular?: boolean
  altoDesempenho?: boolean
}

const EIXOS_VALIDOS = [2, 3, 4, 5, 6, 7, 9]

function ajustarEixos(eixos: number): number {
  return EIXOS_VALIDOS.reduce((prev, curr) =>
    Math.abs(curr - eixos) < Math.abs(prev - eixos) ? curr : prev
  )
}

function selecionarTabela(composicao: boolean, alto: boolean): Record<number, TabelaEixo> {
  if (composicao && alto)  return T_COMPOSICAO_ALTO
  if (composicao)          return T_COMPOSICAO
  if (alto)                return T_SIMPLES_ALTO
  return T_SIMPLES
}

export function calcularANTT(km: number, opcoes: OpcoesANTT): number {
  const {
    eixos,
    tipoCarga = 'carga_geral',
    retornoVazio = false,
    composicaoVeicular = false,
    altoDesempenho = false,
  } = opcoes

  const tabela = selecionarTabela(composicaoVeicular, altoDesempenho)
  const { ccd, cc } = tabela[ajustarEixos(eixos)][tipoCarga] ?? tabela[ajustarEixos(eixos)].carga_geral

  let total = km * ccd + cc
  if (retornoVazio) total += 0.92 * km * ccd

  return Math.round(total * 100) / 100
}

export function getCoeficientes(
  eixos: number,
  composicao: boolean,
  alto: boolean,
  tipoCarga: TipoCarga = 'carga_geral'
): { ccd: number; cc: number } | null {
  const tabela = selecionarTabela(composicao, alto)
  const eixosAdj = ajustarEixos(eixos)
  return tabela[eixosAdj]?.[tipoCarga] ?? tabela[eixosAdj]?.carga_geral ?? null
}

export const EIXOS_LISTA = EIXOS_VALIDOS

export const TIPOS_CARGA: Record<TipoCarga, string> = {
  carga_geral:         'Carga Geral',
  frigorificado:       'Frigorificado / Aquecido',
  granel_solido:       'Granel Sólido',
  granel_liquido:      'Granel Líquido',
  conteinerizada:      'Conteinerizada',
  neogranel:           'Neogranel',
  granel_pressurizado: 'Granel Pressurizado',
}
