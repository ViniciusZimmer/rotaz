'use server'

import { auth } from '@clerk/nextjs/server'

export async function salvarCorrecaoPedagio(params: {
  origem: string
  destino: string
  eixos: number
  pracaId?: string
  valorOriginal: number
  valorCorrigido: number
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  // TODO Phase 2: persist to CorrecaoPedagio table once Prisma migration runs
  console.log('[correcao]', { userId, ...params })
}
