import type { LiveOffice } from '@/lib/directory/live-directory'
import { mapRoster, mapState } from './directory-map'
import { getOfficeCoordinates } from '@/lib/utils/directory-visibility'
import { tierToBucket, type HeadlineBucket } from '@/lib/census/ownership-truth'

export type Area = GeoJSON.Polygon | GeoJSON.MultiPolygon
export type Contour = GeoJSON.Feature<Area, { contour: number }>
export type CatchmentNode = { name: string; lon: number; lat: number }
export type CatchmentGeometry = { type: 'FeatureCollection'; features: Contour[]; generatedAt: string }
export type Anchor = [lon: number, lat: number, tract: number, population: number, housing: number, tracked: number]
export interface DemandTract {
  id: string; name: string; county: string
  population: number | null; populationMoe: number | null; under18: number | null; over65: number | null
  households: number | null; incomeBins: (number | null)[]
  adults25: number | null; bachelorsPct: number | null
  housingUnits: number | null; built2020: number | null; occupied: number | null; owners: number | null
  blockPopulation: number; blockHousing: number
}
export interface DemandDataset { version: number; vintage: string; retrievedAt: string; tracts: DemandTract[]; anchors: Anchor[] }

/** Boundary-inclusive winding test; holes and disconnected polygons are respected. */
function inRing(x: number, y: number, ring: GeoJSON.Position[]): boolean | 'boundary' {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i]
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
    if (Math.abs(cross) < 1e-12 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return 'boundary'
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}
export function containsPoint(area: Area, lon: number, lat: number): boolean {
  const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates
  return polygons.some(rings => {
    const outer = inRing(lon, lat, rings[0])
    if (outer === 'boundary') return true
    if (!outer) return false
    return !rings.slice(1).some(ring => inRing(lon, lat, ring) === true)
  })
}
export function areaBounds(area: Area): [number, number, number, number] {
  const points = area.type === 'Polygon' ? area.coordinates.flat() : area.coordinates.flat(2)
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const [x, y] of points) { west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y) }
  return [west, south, east, north]
}
export function pointTest(area: Area) {
  const [w, s, e, n] = areaBounds(area)
  return (x: number, y: number) => x >= w && x <= e && y >= s && y <= n && containsPoint(area, x, y)
}
export function validNode(node: Pick<CatchmentNode, 'lat' | 'lon'>): boolean {
  return Number.isFinite(node.lon) && Number.isFinite(node.lat) && node.lon >= -88.8 && node.lon <= -87.5 && node.lat >= 41.15 && node.lat <= 42.5
}
export function validContours(value: unknown): value is Pick<CatchmentGeometry, 'type' | 'features'> {
  if (!value || typeof value !== 'object') return false
  const v = value as CatchmentGeometry
  return v.type === 'FeatureCollection' && Array.isArray(v.features) && [10, 15].every(minutes =>
    v.features.some(f => f.type === 'Feature' && f.properties?.contour === minutes &&
      ['Polygon', 'MultiPolygon'].includes(f.geometry?.type) && (() => {
        try { return areaBounds(f.geometry).every(Number.isFinite) } catch { return false }
      })()))
}

const INCOME_EDGES = [0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000, Infinity]
/** Estimate a pooled median from income counts. No averaging medians. */
export function incomeMedian(bins: number[]): { value: number; topCoded: boolean } | null {
  const total = bins.reduce((a, b) => a + b, 0)
  if (total <= 0 || bins.length !== 16) return null
  let before = 0
  for (let i = 0; i < bins.length; i++) {
    if (before + bins[i] >= total / 2 && bins[i] > 0) {
      if (!Number.isFinite(INCOME_EDGES[i + 1])) return { value: 200000, topCoded: true }
      return { value: INCOME_EDGES[i] + (total / 2 - before) / bins[i] * (INCOME_EDGES[i + 1] - INCOME_EDGES[i]), topCoded: false }
    }
    before += bins[i]
  }
  return null
}

export function summarizeDemand(area: Area, data: DemandDataset) {
  const inside = pointTest(area)
  const weights = new Map<number, [number, number, number]>()
  let blockCount = 0
  for (const [x, y, i, pop, housing, tracked] of data.anchors) {
    if (!inside(x, y)) continue
    blockCount++
    const w = weights.get(i) ?? [0, 0, 0]
    w[0] += pop; w[1] += housing; w[2] += tracked ? pop : 0; weights.set(i, w)
  }
  let population = 0, households = 0, under18 = 0, agePop = 0, over65 = 0, seniorPop = 0
  let adults = 0, graduates = 0, houses = 0, newHouses = 0, occupied = 0, owners = 0
  let trackedPop = 0, popVariance = 0, popMissing = 0, hhMissing = 0, incomeHouseholds = 0
  const bins = Array<number>(16).fill(0)
  for (const [i, [pop, hu, covered]] of weights) {
    const t = data.tracts[i]
    const pw = t.blockPopulation > 0 ? pop / t.blockPopulation : 0
    const hw = t.blockHousing > 0 ? hu / t.blockHousing : 0
    if (t.population === null && pop > 0) popMissing++
    else { population += (t.population ?? 0) * pw; trackedPop += t.blockPopulation ? (t.population ?? 0) * covered / t.blockPopulation : 0 }
    if (t.populationMoe !== null) popVariance += (t.populationMoe * pw) ** 2
    if (t.households === null && hu > 0) hhMissing++
    else households += (t.households ?? 0) * hw
    if (t.under18 !== null && t.population !== null) { under18 += t.under18 * pw; agePop += t.population * pw }
    if (t.over65 !== null && t.population !== null) { over65 += t.over65 * pw; seniorPop += t.population * pw }
    if (t.adults25 !== null && t.bachelorsPct !== null) { adults += t.adults25 * pw; graduates += t.adults25 * t.bachelorsPct / 100 * pw }
    if (t.housingUnits !== null && t.built2020 !== null) { houses += t.housingUnits * hw; newHouses += t.built2020 * hw }
    if (t.occupied !== null && t.owners !== null) { occupied += t.occupied * hw; owners += t.owners * hw }
    if (t.incomeBins.length === 16 && t.incomeBins.every(v => v !== null)) {
      t.incomeBins.forEach((v, n) => { bins[n] += v! * hw }); incomeHouseholds += (t.households ?? 0) * hw
    }
  }
  const ratio = (n: number, d: number) => d > 0 ? 100 * n / d : null
  const incomeCoverage = ratio(incomeHouseholds, households)
  return {
    population: popMissing || !blockCount ? null : population,
    households: hhMissing || !blockCount ? null : households,
    populationMoe: Math.sqrt(popVariance),
    medianIncome: (incomeCoverage ?? 0) >= 95 ? incomeMedian(bins) : null,
    highIncomePct: (incomeCoverage ?? 0) >= 95 ? ratio(bins.slice(12).reduce((a, b) => a + b, 0), bins.reduce((a, b) => a + b, 0)) : null,
    under18Pct: population > 0 && agePop / population >= 0.95 ? ratio(under18, agePop) : null,
    over65Pct: population > 0 && seniorPop / population >= 0.95 ? ratio(over65, seniorPop) : null,
    bachelorsPct: ratio(graduates, adults), ownerOccupiedPct: ratio(owners, occupied),
    recentHousingPct: ratio(newHouses, houses), recentHousingUnits: houses > 0 ? newHouses : null,
    trackedPopulationPct: ratio(trackedPop, population), incomeCoverage,
    blockCount, tractCount: weights.size, missingTracts: popMissing,
  }
}
export type DemandSummary = ReturnType<typeof summarizeDemand>

export function summarizeSupply(area: Area, rows: LiveOffice[], year = new Date().getFullYear()) {
  const inside = pointTest(area), roster = mapRoster(rows)
  const unique = [...new Map(roster.mapped.map(p => [p.location_id, p])).values()]
  const offices = unique.filter(p => { const c = getOfficeCoordinates(p)!; return inside(c.lon, c.lat) })
  const confirmed = offices.filter(p => mapState(p) === 'confirmed')
  const unresolved = offices.filter(p => mapState(p) === 'unresolved').length
  const unchecked = offices.length - confirmed.length - unresolved
  const ids = new Set<string>()
  let linkedOffices = 0, established = 0, ageKnown = 0, multiProvider = 0
  const ownership: Record<HeadlineBucket, number> = { true_solo_owner_operated: 0, dentist_owned_not_solo: 0, dso_pe_corporate: 0, institutional: 0, unresolved: 0 }
  for (const p of confirmed) {
    const npis = p.provider_npis?.filter(npi => /^\d{10}$/.test(npi)) ?? []
    if (npis.length) { linkedOffices++; npis.forEach(npi => ids.add(npi)); if (new Set(npis).size > 1) multiProvider++ }
    const bucket = tierToBucket(p.ownership_tier)
    ownership[bucket]++
    if (bucket === 'true_solo_owner_operated' || bucket === 'dentist_owned_not_solo') {
      if (p.year_established && p.year_established > 1800 && p.year_established <= year) {
        ageKnown++; if (p.year_established <= year - 30) established++
      }
    }
  }
  return { confirmed: confirmed.length, unresolved, unchecked, possible: offices.length,
    offices, ownership, linkedProviders: ids.size, linkedOffices, multiProvider, established, ageKnown,
    unmappedRegion: roster.missing + roster.moved }
}
export type SupplySummary = ReturnType<typeof summarizeSupply>

/** Robustness to unfinished checks, not a completeness claim or a capacity score. */
export function competitionRange(population: number | null, supply: Pick<SupplySummary, 'confirmed' | 'possible'>, coveredPct: number | null) {
  if (population === null || population <= 0 || (coveredPct ?? 0) < 95 || supply.possible === 0) return null
  return { low: population / supply.possible, high: supply.confirmed > 0 ? population / supply.confirmed : null }
}
