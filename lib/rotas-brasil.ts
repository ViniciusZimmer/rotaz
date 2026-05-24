// Rotas Brasil API — pedágio real por praça + distância rodoviária brasileira
// https://rotasbrasil.com.br
// Formato: "cidade,uf" separados por ";" | 1 crédito por consulta única
// Fallback para Haversine + estimativa se sem token

import { calcularKM } from './google-maps'
import { getCached, setCached } from './route-cache'

const TOKEN = process.env.ROTAS_BRASIL_TOKEN ?? ''
const BASE  = 'https://rotasbrasil.com.br/apiRotas/enderecos'

export interface RotaResult {
  km: number
  pedagio: number
  fonte: 'rotas-brasil' | 'fallback'
}

function formatarCidade(cidade: string): string {
  // "São Paulo, SP" → "sao paulo,sp"
  // "AURORA, SC"    → "aurora,sc"
  return cidade
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*,\s*/, ',')
    .trim()
}

export async function calcularRota(
  origem: string,
  destino: string,
  eixos: number
): Promise<RotaResult> {
  const cached = getCached(origem, destino, eixos)
  if (cached && cached.pedagio > 0) {
    return { km: cached.km, pedagio: cached.pedagio, fonte: cached.fonte as RotaResult['fonte'] }
  }

  if (!TOKEN) return fallback(origem, destino, eixos)

  try {
    const pontos = `${formatarCidade(origem)};${formatarCidade(destino)}`

    const params = new URLSearchParams({
      pontos,
      veiculo:  'caminhao',
      eixo:     String(eixos),
      paradas:  'false',
      tabela:   'a',
      token:    TOKEN,
    })

    let res: Response | null = null
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      res = await fetch(`${BASE}/?${params}`)
      if (res.ok) break
      console.warn(`[Rotas Brasil] HTTP ${res.status} — tentativa ${tentativa}/5`)
      await new Promise(r => setTimeout(r, tentativa * 1000))
    }

    if (!res || !res.ok) {
      console.error('[Rotas Brasil] falhou após 5 tentativas')
      return fallback(origem, destino, eixos)
    }

    const data: {
      erro?: { code: number; mensagem: string }
      rotas?: Array<{
        distancia: number
        valorPedagio: number
        creditoDisponivel: string
      }>
    } = await res.json()

    if (data.erro) {
      console.error('[Rotas Brasil]', data.erro.mensagem)
      return fallback(origem, destino, eixos)
    }

    const rota = data.rotas?.[0]
    if (!rota) return fallback(origem, destino, eixos)

    const result: RotaResult = {
      km:      Math.round(rota.distancia * 10) / 10,
      pedagio: Math.round(rota.valorPedagio * 100) / 100,
      fonte:   'rotas-brasil',
    }

    setCached(origem, destino, eixos, result)
    return result
  } catch (err) {
    console.error('[Rotas Brasil] erro:', err)
    return fallback(origem, destino, eixos)
  }
}

async function fallback(origem: string, destino: string, eixos: number): Promise<RotaResult> {
  const km = await calcularKM(origem, destino)
  const result: RotaResult = { km, pedagio: 0, fonte: 'fallback' }
  setCached(origem, destino, eixos, result)
  return result
}
