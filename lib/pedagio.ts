// Estimativa de pedágio baseada em média nacional por km e número de eixos
// Fonte: média das praças de pedágio brasileiras (~R$ 0,08/km por eixo)
// Para produção: integrar com Repom API ou RoadGo API

const CUSTO_PEDAGIO_POR_KM_POR_EIXO = 0.075

export function estimarPedagio(km: number, eixos: number): number {
  const valor = km * eixos * CUSTO_PEDAGIO_POR_KM_POR_EIXO
  return Math.round(valor * 100) / 100
}

// Para rotas conhecidas com pedágio real cadastrado manualmente
const PEDAGIOS_CONHECIDOS: Record<string, number> = {
  'sao paulo/sp-curitiba/pr': 180.0,
  'sao paulo/sp-rio de janeiro/rj': 120.0,
  'sao paulo/sp-belo horizonte/mg': 95.0,
  'sao paulo/sp-porto alegre/rs': 310.0,
  'curitiba/pr-porto alegre/rs': 180.0,
}

function normalizarRota(origem: string, destino: string): string {
  return `${origem.toLowerCase()}-${destino.toLowerCase()}`
}

export function getPedagio(origem: string, destino: string, km: number, eixos: number): number {
  const chave = normalizarRota(origem, destino)
  if (PEDAGIOS_CONHECIDOS[chave]) {
    const baseDois = PEDAGIOS_CONHECIDOS[chave]
    // Escala o pedágio para o número de eixos a partir da base de 2 eixos
    return Math.round((baseDois * (eixos / 2)) * 100) / 100
  }
  return estimarPedagio(km, eixos)
}
