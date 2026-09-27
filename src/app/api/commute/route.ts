import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { containsPoint, validNode, type Area } from '@/lib/maps/catchment'
import { nextWeekday, type CommuteLeg } from '@/lib/maps/commute'

export const maxDuration = 30
let scope: Promise<Area> | undefined
function getScope() {
  scope ??= readFile(join(process.cwd(), 'public/data/land-use/scope.geojson'), 'utf8')
    .then(raw => JSON.parse(raw).features[0].geometry as Area).catch(e => { scope = undefined; throw e })
  return scope
}
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  const point = (prefix: string) => ({ lon: p.has(`${prefix}Lon`) ? Number(p.get(`${prefix}Lon`)) : NaN, lat: p.has(`${prefix}Lat`) ? Number(p.get(`${prefix}Lat`)) : NaN })
  const home = point('home'), work = point('work'), weekday = Number(p.get('weekday') ?? 2)
  if (!validNode(home) || !validNode(work) || !Number.isInteger(weekday) || weekday < 1 || weekday > 5)
    return Response.json({ error: 'Choose two Chicagoland pins and a weekday.' }, { status: 400 })
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return Response.json({ error: 'Commute routing is not configured.' }, { status: 503 })
  try {
    const boundary = await getScope()
    if (!containsPoint(boundary, home.lon, home.lat) || !containsPoint(boundary, work.lon, work.lat))
      return Response.json({ error: 'Both pins must be inside the tracked ZIP boundary shown on the map.' }, { status: 400 })
    const date = nextWeekday(weekday), avoidTolls = p.get('avoidTolls') === 'true'
    async function route(from: typeof home, to: typeof home, time: string): Promise<CommuteLeg> {
      const query = new URLSearchParams({ access_token: token!, geometries: 'geojson', overview: 'full', steps: 'false',
        depart_at: `${date}T${time}`, alternatives: 'false', radiuses: '500;500' })
      if (avoidTolls) query.set('exclude', 'toll')
      const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error('Traffic-aware routing is temporarily unavailable. Please retry.')
      const data = await response.json(), r = data.routes?.[0]
      if (data.code !== 'Ok' || !r || !Number.isFinite(r.duration) || !Number.isFinite(r.distance) || r.geometry?.type !== 'LineString')
        throw new Error('No drivable route at these pins. Move them closer to a public road.')
      return { seconds: r.duration, meters: r.distance, geometry: r.geometry,
        roads: (r.legs ?? []).map((l: { summary?: string }) => l.summary).filter(Boolean).join(' · '),
        snapMeters: Math.max(0, ...(data.waypoints ?? []).map((w: { distance?: number }) => w.distance ?? 0)) }
    }
    const [morning, evening] = await Promise.all([route(home, work, '06:45'), route(work, home, '16:00')])
    return Response.json({ date, timezone: 'America/Chicago', morning, evening, avoidTolls, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    const message = e instanceof Error && !e.message.includes('http') && (e.message.startsWith('No drivable') || e.message.startsWith('Traffic-aware'))
      ? e.message : 'Commute estimates are unavailable right now. Please retry.'
    return Response.json({ error: message }, { status: 503 })
  }
}
