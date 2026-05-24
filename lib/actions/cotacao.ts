'use server'

import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { LinhaFrete } from '@/types/frete'

export async function salvarCotacao(linhas: LinhaFrete[], formato: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  const existingUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!existingUser) {
    const clerkUser = await currentUser()
    await prisma.user.create({
      data: {
        id: userId,
        email: clerkUser?.emailAddresses[0]?.emailAddress ?? '',
        name: clerkUser?.fullName ?? null,
      },
    })
  }

  await prisma.cotacao.create({
    data: {
      userId,
      formato,
      totalLinhas: linhas.length,
      linhas: {
        create: linhas.map((l) => ({
          cliente: l.cliente ?? '',
          origem: l.origem,
          destino: l.destino,
          uf: l.uf ?? '',
          eixos: l.eixos,
          km: l.km ?? null,
          pedagio: l.pedagio ?? null,
          antt: l.antt ?? null,
          freteTotal: l.freteTotal ?? null,
          status: l.status ?? 'ok',
          erro: l.erro ?? null,
        })),
      },
    },
  })
}
