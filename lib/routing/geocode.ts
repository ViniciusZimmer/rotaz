import { COORDS, normalizarChave } from '../google-maps'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? ''

export async function geocodeCidade(
  cidade: string
): Promise<{ lat: number; lng: number } | null> {
  const key = normalizarChave(cidade)
  const coords = COORDS[key]
  if (coords) return { lat: coords[0], lng: coords[1] }

  if (!GOOGLE_MAPS_API_KEY) return null

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(cidade + ', Brasil')}` +
      `&key=${GOOGLE_MAPS_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[0]) return null
    const loc = data.results[0].geometry.location
    return { lat: loc.lat, lng: loc.lng }
  } catch {
    return null
  }
}
