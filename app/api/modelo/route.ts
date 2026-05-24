import { NextResponse } from 'next/server'
import { gerarExcelModelo } from '@/lib/excel'

export async function GET() {
  const buffer = gerarExcelModelo()

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo_tabela_frete.xlsx"',
    },
  })
}
