import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { acsNumber, formatSocioeconomicValue, socioeconomicColor, socioeconomicValue, SOCIOECONOMIC_DATA, SOCIOECONOMIC_METRICS } from '@/lib/maps/socioeconomic'

const snapshot = JSON.parse(readFileSync(`public${SOCIOECONOMIC_DATA}`, 'utf8')) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>>
const metadata = JSON.parse(readFileSync('public/data/chicagoland-acs-2024.metadata.json', 'utf8'))

describe('Census socioeconomic map layers', () => {
  it('does not turn absent, sentinel, string or non-finite data into a zero estimate', () => {
    for (const value of [null, undefined, '', '50000', -666666666, NaN, Infinity]) expect(acsNumber(value)).toBeNull()
    expect(acsNumber(0)).toBe(0)
    expect(acsNumber(50000)).toBe(50000)
  })
  it('uses the household median and adults 25+ percent, not total income or population density', () => {
    const p = { B19049_001E: 85000, B15002_001E: 200, B15002_calc_pctGEBAE: 37.5 }
    expect(socioeconomicValue(p, 'income')).toBe(85000)
    expect(socioeconomicValue(p, 'education')).toBe(37.5)
    for (const population of [null, 0, -1]) expect(socioeconomicValue({ ...p, B15002_001E: population }, 'education')).toBeNull()
    expect(socioeconomicValue({ ...p, B15002_calc_pctGEBAE: 101 }, 'education')).toBeNull()
    expect(socioeconomicValue({ ...p, B15002_calc_pctGEBAE: 0 }, 'education')).toBe(0)
  })
  it('formats units and top-coded income honestly', () => {
    expect(formatSocioeconomicValue(85000, 'income')).toBe('$85,000')
    expect(formatSocioeconomicValue(250001, 'income')).toBe('$250,000+')
    expect(formatSocioeconomicValue(2499, 'income')).toBe('Below $2,500')
    expect(formatSocioeconomicValue(37.51, 'education')).toBe('37.5%')
    expect(formatSocioeconomicValue(null, 'income')).toBe('No estimate available')
  })
  it('makes missing tracts gray, with separate fixed legend scales for each metric', () => {
    for (const metric of ['income', 'education'] as const) {
      const expression = socioeconomicColor(metric)
      expect(expression[0]).toBe('case')
      expect(expression.at(-1)).toBe('#b8bec5')
      expect(JSON.stringify(expression)).toContain(SOCIOECONOMIC_METRICS[metric].field)
      expect(SOCIOECONOMIC_METRICS[metric].stops).toHaveLength(5)
    }
  })
  it('ships every joined regional tract, not a first-page 1000-record truncation', () => {
    expect(snapshot.features).toHaveLength(2339)
    expect(metadata.tractCount).toBe(snapshot.features.length)
    expect(metadata.vintage).toBe('2020-2024')
    expect(metadata.sources.every((s: { count: number }) => s.count === snapshot.features.length)).toBe(true)
    expect(new Set(snapshot.features.map(f => f.properties.GEOID)).size).toBe(snapshot.features.length)
    for (const f of snapshot.features) {
      expect(f.properties.GEOID).toMatch(/^17\d{9}$/)
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type)
      expect(f.geometry.coordinates.length).toBeGreaterThan(0)
      for (const field of ['B19049_001E', 'B19049_001M', 'B15002_001E', 'B15002_calc_pctGEBAE', 'B15002_calc_pctGEBAM']) {
        expect(Object.hasOwn(f.properties, field)).toBe(true)
        expect(f.properties[field] === null || acsNumber(f.properties[field]) !== null).toBe(true)
      }
    }
  })
  it('retains missing estimates, raw source values and uncertainty without fabricated filling', () => {
    expect(snapshot.features.filter(f => socioeconomicValue(f.properties, 'income') !== null)).toHaveLength(2312)
    expect(snapshot.features.filter(f => socioeconomicValue(f.properties, 'education') !== null)).toHaveLength(2334)
    const p = snapshot.features.find(f => f.properties.GEOID === '17007010101')!.properties
    expect(p).toMatchObject({ B19049_001E: 79750, B19049_001M: 12887, B15002_001E: 3028, B15002_calc_pctGEBAE: 21.2 })
    expect(p.B15002_calc_pctGEBAM).toBeCloseTo(6.070372368)
  })
})
