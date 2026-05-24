import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PracaResult } from '@/types/routing'

const CACHE_FILE = join(process.cwd(), '.route-cache.json')
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias

interface CacheEntry {
  km: number
  pedagio: number
  pracas?: PracaResult[]
  fonte: string
  confianca: string
  cachedAt: number
}

// Map em memória — populado do arquivo na primeira chamada
let mem: Map<string, CacheEntry> | null = null

function getMap(): Map<string, CacheEntry> {
  if (mem) return mem
  try {
    const raw = existsSync(CACHE_FILE)
      ? JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
      : {}
    mem = new Map(Object.entries(raw))
  } catch {
    mem = new Map()
  }
  return mem
}

function persist() {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(getMap())))
  } catch {}
}

function chave(origem: string, destino: string, eixos: number): string {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  return `${norm(origem)}|${norm(destino)}|${eixos}`
}

export function getCached(
  origem: string,
  destino: string,
  eixos: number
): CacheEntry | null {
  const entry = getMap().get(chave(origem, destino, eixos))
  if (!entry) return null
  if (Date.now() - entry.cachedAt > TTL_MS) {
    getMap().delete(chave(origem, destino, eixos))
    return null
  }
  return entry
}

export function setCached(
  origem: string,
  destino: string,
  eixos: number,
  data: Omit<CacheEntry, 'cachedAt'>
) {
  getMap().set(chave(origem, destino, eixos), { ...data, cachedAt: Date.now() })
  persist()
}
