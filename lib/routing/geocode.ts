import { COORDS, normalizarChave } from '../google-maps'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''
const HERE_API_KEY = process.env.HERE_API_KEY ?? ''

async function geocodeHere(cidade: string): Promise<{ lat: number; lng: number } | null> {
  if (!HERE_API_KEY) return null
  try {
    const q = encodeURIComponent(normalizarChave(cidade).replace(/,\s*[a-z]{2}$/, '').trim() + ' brasil')
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${q}&in=countryCode:BRA&limit=1&apikey=${HERE_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const pos = data.items?.[0]?.position
    if (pos) return { lat: pos.lat, lng: pos.lng }
  } catch {}
  return null
}

async function geocodeNominatim(cidade: string): Promise<{ lat: number; lng: number } | null> {
  const normalized = normalizarChave(cidade)
  const cityOnly = normalized.replace(/,\s*[a-z]{2}$/, '').trim()

  for (const q of [normalized, cityOnly]) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', brasil')}&format=json&limit=1&countrycodes=br`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'rotaz-frete/1.0 (viniciuszimmer92@gmail.com)' },
        signal: AbortSignal.timeout(8000),
      })
      const data = await res.json()
      if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {}
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

  // HERE geocoding (uses same API key as routing, reliable from cloud)
  const fromHere = await geocodeHere(cidade)
  if (fromHere) return fromHere

  return geocodeNominatim(cidade)
}
