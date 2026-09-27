import { describe, expect, it, vi, afterEach } from 'vitest'
import { containsPoint, summarizeDemand, summarizeSupply, incomeMedian, competitionRange, validContours, validNode,
  type Area, type DemandDataset, type DemandTract } from '@/lib/maps/catchment'
import type { LiveOffice } from '@/lib/directory/live-directory'
import type { DirectoryWebCheck } from '@/lib/supabase/queries/directory-web-checks'
import { GET } from '@/app/api/catchment/route'

const rect = (w: number, s: number, e: number, n: number): Area => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] })
const region = rect(-88.1, 41.5, -87.9, 41.7)
const tract: DemandTract = { id: 't', name: 'test', county: 'test', population: 1000, populationMoe: 100,
  under18: 200, over65: 100, households: 400, incomeBins: Array(16).fill(25), adults25: 600, bachelorsPct: 50,
  housingUnits: 500, built2020: 50, occupied: 400, owners: 300, blockPopulation: 100, blockHousing: 100 }
const data: DemandDataset = { version: 1, vintage: '2020–2024', retrievedAt: '2026-09-27', tracts: [tract],
  anchors: [[-88, 41.6, 0, 20, 70, 1], [-88.3, 41.6, 0, 80, 30, 0]] }
const row = (id: string, effect?: DirectoryWebCheck['effect']) => ({ location_id: id, address: '1 Main', latitude: 41.6, longitude: -88,
  web_check: effect ? { effect, observed: {}, as_seen: { address: '1 Main' } } : undefined }) as LiveOffice

describe('travel polygon membership', () => {
  it('handles boundaries, holes and disjoint islands', () => {
    expect(containsPoint(region, -88, 41.6)).toBe(true)
    expect(containsPoint(region, -88.1, 41.6)).toBe(true)
    expect(containsPoint(region, -88.2, 41.6)).toBe(false)
    const holes: Area = { type: 'Polygon', coordinates: [(region as GeoJSON.Polygon).coordinates[0], [[-88.01, 41.59], [-87.99, 41.59], [-87.99, 41.61], [-88.01, 41.61], [-88.01, 41.59]]] }
    expect(containsPoint(holes, -88, 41.6)).toBe(false)
    const multi: Area = { type: 'MultiPolygon', coordinates: [(region as GeoJSON.Polygon).coordinates, (rect(-89, 42, -88.9, 42.1) as GeoJSON.Polygon).coordinates] }
    expect(containsPoint(multi, -88.95, 42.05)).toBe(true)
    expect(containsPoint(multi, -88.5, 41.9)).toBe(false)
  })
  it('rejects missing contours, invalid coordinates and out-of-region requests', () => {
    expect(validNode({ lon: NaN, lat: 41.6 })).toBe(false)
    expect(validNode({ lon: -71, lat: 42 })).toBe(false)
    expect(validContours({ type: 'FeatureCollection', features: [] })).toBe(false)
    expect(validContours({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: region, properties: { contour: 10 } }] })).toBe(false)
  })
})
describe('Census allocation and uncertainty', () => {
  it('weights residents by block population, households by housing; never by empty acreage', () => {
    const s = summarizeDemand(region, data)
    expect(s.population).toBe(200)
    expect(s.households).toBe(280)
    expect(s.under18Pct).toBe(20)
    expect(s.ownerOccupiedPct).toBe(75)
    expect(s.recentHousingPct).toBe(10)
    expect(s.trackedPopulationPct).toBe(100)
    expect(summarizeDemand(rect(-89, 41, -87, 42), data).population).toBe(1000)
    expect(summarizeDemand(rect(-89, 41, -87, 42), data).trackedPopulationPct).toBe(20)
  })
  it('does not turn missing populations or absent block anchors into zero demand', () => {
    expect(summarizeDemand(region, { ...data, tracts: [{ ...tract, population: null }] }).population).toBeNull()
    expect(summarizeDemand(rect(-89, 40, -88.9, 40.1), data).population).toBeNull()
    expect(summarizeDemand(region, { ...data, tracts: [{ ...tract, incomeBins: Array(16).fill(null) }] }).medianIncome).toBeNull()
  })
  it('pools income distributions, interpolates the median, and marks open-ended brackets', () => {
    const bins = Array(16).fill(0); bins[12] = 100
    expect(incomeMedian(bins)).toEqual({ value: 112500, topCoded: false })
    bins[15] = 200
    expect(incomeMedian(bins)).toEqual({ value: 200000, topCoded: true })
    expect(incomeMedian(Array(16).fill(0))).toBeNull()
  })
  it('withholds ratios at a coverage edge and avoids infinity with no confirmed offices', () => {
    expect(competitionRange(30000, { confirmed: 5, possible: 10 }, 100)).toEqual({ low: 3000, high: 6000 })
    expect(competitionRange(30000, { confirmed: 5, possible: 10 }, 80)).toBeNull()
    expect(competitionRange(30000, { confirmed: 0, possible: 10 }, 100)).toEqual({ low: 3000, high: null })
    expect(competitionRange(30000, { confirmed: 0, possible: 0 }, 100)).toBeNull()
  })
})
describe('complete directory competition', () => {
  it('deduplicates location IDs, excludes removed/unlocated/moved records, includes unchecked competitors', () => {
    const moved = row('moved', 'open_corrected'); moved.web_check!.observed.address = '200 Other St'
    const rows = [row('a', 'open_verified'), row('a', 'open_verified'), row('b', 'needs_review'), row('c'), row('d', 'removed'), { ...row('e'), latitude: null }, moved, { ...row('f'), longitude: -89 }]
    expect(summarizeSupply(region, rows)).toMatchObject({ confirmed: 1, unresolved: 1, unchecked: 1, possible: 3, unmappedRegion: 2 })
  })
  it('uses only reviewed ownership and counts each individual NPI once, without FTE guesses', () => {
    const a = { ...row('a', 'open_verified'), ownership_tier: 'true_independent', year_established: 1990, provider_npis: ['1234567890'] }
    const b = { ...row('b', 'open_verified'), ownership_tier: null, provider_npis: ['1234567890', '9876543210'] }
    const s = summarizeSupply(region, [a, b], 2026)
    expect(s).toMatchObject({ linkedProviders: 2, linkedOffices: 2, multiProvider: 1, established: 1, ageKnown: 1 })
    expect(s.ownership).toMatchObject({ true_solo_owner_operated: 1, unresolved: 1, dso_pe_corporate: 0 })
  })
  it('updates when the live validator confirms or removes an office', () => {
    expect(summarizeSupply(region, [row('a')])).toMatchObject({ confirmed: 0, possible: 1 })
    expect(summarizeSupply(region, [row('a', 'open_corrected')])).toMatchObject({ confirmed: 1, possible: 1 })
    expect(summarizeSupply(region, [row('a', 'removed')])).toMatchObject({ confirmed: 0, possible: 0 })
  })
})
describe('routing API fails explicitly, never substitutes circles', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it('rejects malformed origins before routing', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect((await GET(new Request('http://localhost/api/catchment'))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('reports a provider outage without leaking credentials', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'secret-test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 })))
    const r = await GET(new Request('http://localhost/api/catchment?lon=-88&lat=41.6'))
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('secret-test-token')
  })
})
