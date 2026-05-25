import { NextRequest } from 'next/server'
import cidades from '@/lib/cidades-brasil.json'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return Response.json([])

  const qNorm = norm(q)

  const starts: string[] = []
  const contains: string[] = []
  for (const c of cidades as string[]) {
    const n = norm(c)
    if (n.startsWith(qNorm)) starts.push(c)
    else if (n.includes(qNorm)) contains.push(c)
  }

  return Response.json([...starts, ...contains].slice(0, 10))
}
