import { COORDS, normalizarChave } from '../google-maps'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

async function geocodeNominatim(cidade: string): Promise<{ lat: number; lng: number } | null> {
  // Try normalized form first (removes accents, converts slash, lowercases)
  // Then fallback to city-only (no UF) for better Nominatim matching
  const normalized = normalizarChave(cidade)  // e.g. "blumenau, sc"
  const cityOnly = normalized.replace(/,\s*[a-z]{2}$/, '').trim()  // strip UF → "blumenau"

  const queries = [normalized, cityOnly].filter(Boolean)

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', brasil')}&format=json&limit=1&countrycodes=br`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'rotaz-frete/1.0 (viniciuszimmer92@gmail.com)' },
        signal: AbortSignal.timeout(8000),
      })
      const data = await res.json()
      if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {
      // try next query
    }
  }
  return null
}

export async function geocodeCidade(
  cidade: string
): Promise<{ lat: number; lng: number } | null> {
  const key = normalizarChave(cidade)
  const coords = COORDS[key]
  if (coords) return { lat: coords[0], lng: coords[1] }

  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?address=${encodeURIComponent(cidade + ', Brasil')}` +
        `&key=${GOOGLE_MAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.status === 'OK' && data.results?.[0]) {
        const loc = data.results[0].geometry.location
        return { lat: loc.lat, lng: loc.lng }
      }
    } catch {}
  }

  return geocodeNominatim(cidade)
}
