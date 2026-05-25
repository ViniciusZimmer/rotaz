import { COORDS, normalizarChave } from '../google-maps'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

async function geocodeNominatim(cidade: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(cidade + ', Brasil')
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`
    const res = await fetch(url, { headers: { 'User-Agent': 'rotaz-frete/1.0' } })
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
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
