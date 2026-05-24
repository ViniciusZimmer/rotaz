import { NextRequest, NextResponse } from 'next/server'
import { calcularRotaComChain } from '@/lib/routing/chain'
import { calcularANTT, EIXOS_LISTA } from '@/lib/antt'
import { LinhaFrete, LinhaVariacao } from '@/types/frete'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function processarLinha(linha: LinhaFrete): Promise<LinhaFrete> {
  try {
    const { km, pedagio, fonte, confianca, pracas } = await calcularRotaComChain(
      linha.origem,
      linha.destino,
      6  // referência eixo=6 — mesmo comportamento anterior
    )

    const antt = calcularANTT(km, {
      eixos: linha.eixos,
      tipoCarga: linha.tipoCarga,
      retornoVazio: linha.retornoVazio,
      composicaoVeicular: linha.composicaoVeicular,
    })
    const freteTotal = Math.round((pedagio + antt) * 100) / 100

    const variacaoCompleta: LinhaVariacao[] = []
    for (const e of EIXOS_LISTA) {
      for (const composicaoVeicular of [false, true]) {
        for (const altoDesempenho of [false, true]) {
          const anttVar = calcularANTT(km, {
            eixos: e,
            tipoCarga: linha.tipoCarga,
            retornoVazio: linha.retornoVazio,
            composicaoVeicular,
            altoDesempenho,
          })
          variacaoCompleta.push({
            eixos: e,
            composicaoVeicular,
            altoDesempenho,
            km,
            pedagio,
            antt: anttVar,
            freteTotal: Math.round((pedagio + anttVar) * 100) / 100,
          })
        }
      }
    }

    return {
      ...linha,
      km,
      pedagio,
      antt,
      freteTotal,
      variacaoCompleta,
      fonte,
      confianca,
      pracas,
      status: 'ok',
    }
  } catch (err) {
    return {
      ...linha,
      status: 'erro',
      erro: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

export async function POST(req: NextRequest) {
  const linhas: LinhaFrete[] = await req.json()
  const resultados: LinhaFrete[] = []

  for (let i = 0; i < linhas.length; i++) {
    resultados.push(await processarLinha(linhas[i]))
    if (i < linhas.length - 1) await delay(1000)
  }

  return NextResponse.json(resultados)
}
