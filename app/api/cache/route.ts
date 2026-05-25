import { NextResponse } from 'next/server'
import { clearCache } from '@/lib/route-cache'

export async function DELETE() {
  clearCache()
  return NextResponse.json({ ok: true })
}
