import { validContours, validNode } from '@/lib/maps/catchment'

export const maxDuration = 30
// Fixed routing profile and two contours: no client-controlled upstream URL or token.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const lat = params.has('lat') ? Number(params.get('lat')) : NaN
  const lon = params.has('lon') ? Number(params.get('lon')) : NaN
  if (!validNode({ lat, lon })) return Response.json({ error: 'Choose a node within the Chicagoland research region.' }, { status: 400 })
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return Response.json({ error: 'Drive-time routing is not configured.' }, { status: 503 })
  const query = new URLSearchParams({ contours_minutes: '10,15', polygons: 'true', denoise: '1', generalize: '30', access_token: token })
  try {
    const response = await fetch(`https://api.mapbox.com/isochrone/v1/mapbox/driving/${lon.toFixed(5)},${lat.toFixed(5)}?${query}`, {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) return Response.json({ error: response.status === 429 ? 'Routing is busy. Please try again shortly.' : 'Drive-time routing is temporarily unavailable. Please retry.' }, { status: 503 })
    const data: unknown = await response.json()
    if (!validContours(data)) return Response.json({ error: 'No usable driving area here. Move the node onto a nearby road.' }, { status: 422 })
    return Response.json({ type: 'FeatureCollection', features: data.features.filter(f => [10, 15].includes(f.properties.contour)), generatedAt: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    })
  } catch {
    return Response.json({ error: 'Drive-time routing timed out. Please retry.' }, { status: 503 })
  }
}
