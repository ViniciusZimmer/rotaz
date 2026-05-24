import { NextRequest, NextResponse } from 'next/server'
import { gerarExcelPorVeiculo } from '@/lib/excel'
import { LinhaFrete } from '@/types/frete'

export async function POST(req: NextRequest) {
  const linhas: LinhaFrete[] = await req.json()

  const buffer = gerarExcelPorVeiculo(linhas)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tabela_frete.xlsx"',
    },
  })
}
