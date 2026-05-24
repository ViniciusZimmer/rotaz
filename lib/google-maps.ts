const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

export async function calcularKM(origem: string, destino: string): Promise<number> {
  if (!GOOGLE_MAPS_API_KEY) {
    return estimarKMFallback(origem, destino)
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origem + ', Brasil')}&destinations=${encodeURIComponent(destino + ', Brasil')}&mode=driving&language=pt-BR&key=${GOOGLE_MAPS_API_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK') throw new Error(`Google Maps erro: ${data.status}`)

  const elemento = data.rows[0]?.elements[0]
  if (elemento?.status !== 'OK') throw new Error(`Rota não encontrada: ${elemento?.status}`)

  return Math.round(elemento.distance.value / 1000)
}

// Coordenadas [lat, lon] de cidades brasileiras — chave normalizada "cidade, uf"
export const COORDS: Record<string, [number, number]> = {
  // SP
  'sao paulo, sp': [-23.5505, -46.6333],

  // SC
  'aurora, sc': [-27.3019, -49.6408],
  'balneario camboriu, sc': [-26.9906, -48.6347],
  'biguacu, sc': [-27.4945, -48.6558],
  'blumenau, sc': [-26.9194, -49.0661],
  'braco do norte, sc': [-28.2778, -49.1681],
  'chapeco, sc': [-27.1004, -52.6156],
  'cocal do sul, sc': [-28.6050, -49.3289],
  'criciuma, sc': [-28.6780, -49.3697],
  'florianopolis, sc': [-27.5954, -48.5480],
  'gaspar, sc': [-26.9311, -48.9586],
  'guaramirim, sc': [-26.4719, -48.9939],
  'icara, sc': [-28.7139, -49.3047],
  'indaial, sc': [-26.8986, -49.2328],
  'itajai, sc': [-26.9078, -48.6619],
  'jaragua do sul, sc': [-26.4858, -49.0694],
  'joacaba, sc': [-27.1728, -51.5056],
  'joinville, sc': [-26.3044, -48.8438],
  'massaranduba, sc': [-26.6083, -48.9972],
  'morro da fumaca, sc': [-28.6558, -49.2192],
  'orleans, sc': [-28.3611, -49.2958],
  'palhoca, sc': [-27.6456, -48.6694],
  'paulo lopes, sc': [-27.9642, -48.6839],
  'pomerode, sc': [-26.7425, -49.1769],
  'santa helena, sc': [-26.9408, -53.1000],
  'sao bento do sul, sc': [-26.2500, -49.3797],
  'timbo, sc': [-26.8228, -49.2756],
  'urussanga, sc': [-28.5197, -49.3181],
  'videira, sc': [-27.0058, -51.1500],

  // RS
  'bento goncalves, rs': [-29.1717, -51.5181],
  'bom retiro do sul, rs': [-29.6072, -51.9239],
  'campo bom, rs': [-29.6786, -51.0581],
  'canoas, rs': [-29.9183, -51.1839],
  'caxias do sul, rs': [-29.1678, -51.1794],
  'esteio, rs': [-29.8575, -51.1850],
  'farroupilha, rs': [-29.2228, -51.3472],
  'flores da cunha, rs': [-29.0253, -51.1878],
  'garibaldi, rs': [-29.2556, -51.5356],
  'gravatai, rs': [-29.9439, -51.0000],
  'guaiba, rs': [-30.1128, -51.3236],
  'ivoti, rs': [-29.6136, -51.1586],
  'lajeado, rs': [-29.4658, -51.9625],
  'novo hamburgo, rs': [-29.6783, -51.1308],
  'passo fundo, rs': [-28.2628, -52.4094],
  'porto alegre, rs': [-30.0346, -51.2177],
  'santa maria, rs': [-29.6842, -53.8069],
  'sao jose do sul, rs': [-29.5036, -51.7636],
  'sao leopoldo, rs': [-29.7600, -51.1469],
  'sao sebastiao do cai, rs': [-29.5928, -51.3664],
  'sapiranga, rs': [-29.6397, -51.0011],
  'tres coroas, rs': [-29.5228, -50.7764],
  'tupandi, rs': [-29.5236, -51.4028],
  'vacaria, rs': [-28.5119, -50.9344],

  // PR
  'araucaria, pr': [-25.5939, -49.4125],
  'cambe, pr': [-23.2750, -51.2789],
  'campina grande do sul, pr': [-25.3019, -49.0575],
  'campo largo, pr': [-25.4589, -49.5258],
  'cascavel, pr': [-24.9556, -53.4556],
  'curitiba, pr': [-25.4284, -49.2733],
  'fazenda rio grande, pr': [-25.6694, -49.3061],
  'loanda, pr': [-22.9219, -53.1436],
  'londrina, pr': [-23.3045, -51.1696],
  'paranavai, pr': [-23.0742, -52.4644],
  'rolandia, pr': [-23.3103, -51.3706],
  'toledo, pr': [-24.7253, -53.7408],
  'uniao da vitoria, pr': [-26.2281, -51.0872],

  // Outros estados (formato padrão do app)
  'rio de janeiro, rj': [-22.9068, -43.1729],
  'belo horizonte, mg': [-19.9245, -43.9352],
  'campo grande, ms': [-20.4697, -54.6201],
  'goiania, go': [-16.6869, -49.2648],
  'brasilia, df': [-15.7801, -47.9292],
}

export function normalizarChave(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace('/', ', ')  // "sao paulo/sp" → "sao paulo, sp"
    .trim()
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function estimarKMFallback(origem: string, destino: string): number {
  const orig = normalizarChave(origem)
  const dest = normalizarChave(destino)

  const c1 = COORDS[orig]
  const c2 = COORDS[dest]

  if (c1 && c2) {
    // Distância em linha reta × fator de rodovias brasileiro (~1.35)
    return Math.round(haversineKm(c1[0], c1[1], c2[0], c2[1]) * 1.35)
  }

  return 500
}
