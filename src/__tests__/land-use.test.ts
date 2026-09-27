import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { LAND_USE_DETAILS, LAND_USE_GROUPS, LAND_USE_VERSION, landUseFilter, landUseGroup, validLandUseTile } from '@/lib/maps/land-use'
import { GET } from '@/app/api/land-use-tiles/[version]/[z]/[x]/[y]/route'

describe('Land-use meaning and coverage', () => {
  it('never calls vacant, under-construction, common open space, hotels or unknown land housing', () => {
    for (const code of ['4110', '4210', '1151', '1250', null, 'new-source-code']) {
      expect(landUseGroup(code).id).not.toBe('residential')
    }
    expect(landUseGroup('1216').id).toBe('mixed')
    expect(landUseGroup('1530').id).toBe('airport')
    expect(landUseGroup('1380').id).toBe('institutional')
    expect(landUseGroup('3300').id).toBe('open')
    expect(landUseGroup('new-source-code').id).toBe('unknown')
  })
  it('restricts housing and business views to the appropriate source codes', () => {
    expect(landUseFilter('homes')).toEqual(['in', ['get', 'code'], ['literal', ['1111', '1112', '1130', '1140', '1216']]])
    const business = JSON.stringify(landUseFilter('sites'))
    for (const code of ['1310', '1220', '1216']) expect(business).toContain(code)
    for (const code of ['4110', '4120', '1530', '1432', '1111']) expect(business).not.toContain(code)
  })
  it('accounts for every source-domain class exactly once', () => {
    const schema = JSON.parse(readFileSync('data/land-use/source-schema.json', 'utf8'))
    const domain: string[] = schema.fields.find((f: { name: string }) => f.name === 'LANDUSE').domain.codedValues.map((c: { code: string }) => c.code)
    const codes = LAND_USE_GROUPS.flatMap(g => [...g.codes])
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.toSorted()).toEqual(domain.toSorted())
    expect(Object.keys(LAND_USE_DETAILS).toSorted()).toEqual(domain.toSorted())
  })
  it('ships the archive matching the coverage manifest and discloses unmatched ZIPs', () => {
    const manifest = JSON.parse(readFileSync('public/data/land-use/manifest.json', 'utf8'))
    const zips = JSON.parse(readFileSync('data/land-use/watched-zips.json', 'utf8'))
    const archive = readFileSync('data/land-use/chicagoland-2023.pmtiles')
    expect(manifest.watchedZipCount).toBe(zips.length)
    expect(manifest.matchedZctaCount + manifest.missingZctas.length).toBe(zips.length)
    expect(manifest.missingZctas.every((z: string) => zips.includes(z))).toBe(true)
    expect(manifest.clippedFeatures).toBeGreaterThan(100000)
    expect(Object.values(manifest.countsByCode).reduce((a: number, n) => a + Number(n), 0)).toBe(manifest.clippedFeatures)
    expect(createHash('sha256').update(archive).digest('hex')).toBe(manifest.archiveSha256)
  })
})

describe('Packaged vector tile route', () => {
  const request = async (z: string, x: string, y: string, version = LAND_USE_VERSION) => GET(new Request('http://localhost/'), { params: Promise.resolve({ z, x, y, version }) })
  it('rejects invalid coordinates and unknown versions before opening an archive', async () => {
    for (const xyz of [['14', '-1', '1'], ['30', '1', '1'], ['14', '16384', '1'], ['NaN', '1', '1']]) {
      expect((await request(...xyz as [string, string, string])).status).toBe(400)
    }
    expect((await request('9', '131', '190', 'unrecognized')).status).toBe(404)
    expect(validLandUseTile(14, Infinity, 2)).toBe(false)
  })
  it('reads real Chicago data and returns a valid empty tile outside coverage', async () => {
    const result = await request('9', '131', '190')
    expect(result.status).toBe(200)
    expect(result.headers.get('Content-Type')).toBe('application/vnd.mapbox-vector-tile')
    expect((await result.arrayBuffer()).byteLength).toBeGreaterThan(1000)
    const empty = await request('9', '0', '0')
    expect(empty.status).toBe(200)
    expect((await empty.arrayBuffer()).byteLength).toBe(0)
  })
})
