import { NextRequest } from 'next/server'

interface IBGEMunicipio {
  nome: string
  microrregiao: { mesorregiao: { UF: { sigla: string } } }
}

let cache: string[] | null = null

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function getCidades(): Promise<string[]> {
  if (cache) return cache
  const res = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
    { next: { revalidate: 86400 } }
  )
  const data: IBGEMunicipio[] = await res.json()
  cache = data.map(m => `${m.nome}, ${m.microrregiao.mesorregiao.UF.sigla}`)
  return cache
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json([])

  const cidades = await getCidades()
  const qNorm = norm(q)

  const starts: string[] = []
  const contains: string[] = []
  for (const c of cidades) {
    const n = norm(c)
    if (n.startsWith(qNorm)) starts.push(c)
    else if (n.includes(qNorm)) contains.push(c)
  }

  return Response.json([...starts, ...contains].slice(0, 10))
}
