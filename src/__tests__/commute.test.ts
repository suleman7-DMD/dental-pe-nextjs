import { describe, expect, it, vi, afterEach } from 'vitest'
import { commuteArrival, nextWeekday, travelTime } from '@/lib/maps/commute'
import { GET } from '@/app/api/commute/route'

describe('Chicago weekday planning', () => {
  it('chooses a future weekday in Chicago even when UTC is already tomorrow', () => {
    expect(nextWeekday(1, new Date('2026-09-28T01:00:00Z'))).toBe('2026-09-28')
    expect(nextWeekday(2, new Date('2026-09-27T21:00:00Z'))).toBe('2026-09-29')
    expect(nextWeekday(2, new Date('2026-09-29T15:00:00Z'))).toBe('2026-10-06')
  })
  it('handles DST weeks without shifting the departure wall-clock time', () => {
    expect(nextWeekday(1, new Date('2026-11-01T12:00:00Z'))).toBe('2026-11-02')
    expect(commuteArrival(6, 45, 2100)).toBe('7:20 AM')
    expect(commuteArrival(16, 0, 3900)).toBe('5:05 PM')
    expect(travelTime(3900)).toBe('1 hr 5 min')
  })
})
describe('traffic routing contract', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  const request = 'http://localhost/api/commute?homeLon=-87.65&homeLat=41.88&workLon=-88.01111&workLat=41.59807&weekday=2'
  it('requests different directions and departure times; never doubles one route estimate', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'test-token')
    const fetcher = vi.fn().mockImplementation(async url => new Response(JSON.stringify({ code: 'Ok', routes: [{
      duration: String(url).includes('06%3A45') ? 1800 : 2700, distance: 40000,
      geometry: { type: 'LineString', coordinates: [[-87.65, 41.88], [-88.01, 41.6]] }, legs: [{ summary: 'I-55' }],
    }], waypoints: [{ distance: 2 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const r = await GET(new Request(request + '&avoidTolls=true'))
    const data = await r.json()
    expect(r.status).toBe(200)
    expect(data.morning.seconds).toBe(1800); expect(data.evening.seconds).toBe(2700)
    const urls = fetcher.mock.calls.map(c => String(c[0]))
    expect(urls[0]).toContain('-87.65000,41.88000;-88.01111,41.59807')
    expect(urls[1]).toContain('-88.01111,41.59807;-87.65000,41.88000')
    expect(urls[0]).toContain('T06%3A45'); expect(urls[1]).toContain('T16%3A00')
    expect(urls.every(u => u.includes('mapbox/driving-traffic') && u.includes('exclude=toll'))).toBe(true)
  })
  it('rejects weekends, missing coordinates, and pins outside tracked geography', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'test-token')
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect((await GET(new Request(request.replace('weekday=2', 'weekday=6')))).status).toBe(400)
    expect((await GET(new Request('http://localhost/api/commute'))).status).toBe(400)
    expect((await GET(new Request(request.replace('homeLat=41.88', 'homeLat=41.17')))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
