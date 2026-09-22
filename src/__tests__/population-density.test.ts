import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POPULATION_LEGEND, SQUARE_KM_PER_SQUARE_MILE, populationTileInRegion } from '@/lib/maps/population-density'

const { metadata, tile } = vi.hoisted(() => ({ metadata: vi.fn(), tile: vi.fn() }))
vi.mock('pmtiles', () => ({
  FetchSource: class {},
  PMTiles: class { getMetadata = metadata; getZxy = tile },
}))
beforeEach(() => {
  vi.resetModules()
  metadata.mockReset().mockResolvedValue({ description: 'WorldPop 2026 100m constrained, palette #20', format: 'png' })
  tile.mockReset().mockResolvedValue({ data: new Uint8Array([137, 80, 78, 71]).buffer })
})
afterEach(() => vi.restoreAllMocks())

async function get(z = '9', x = '131', y = '190') {
  const { GET } = await import('@/app/api/population-tiles/[z]/[x]/[y]/route')
  return GET(new Request('https://example.org/api/population-tiles'), { params: Promise.resolve({ z, x, y }) })
}

describe('population overlay is actual population, not a practice heatmap', () => {
  it('converts densities to square miles without changing color stop positions', () => {
    expect(SQUARE_KM_PER_SQUARE_MILE).toBeCloseTo(2.589988110336, 10)
    expect(POPULATION_LEGEND.map(s => s.position)).toEqual([0, 23, 38.5, 61.5, 100])
    expect(POPULATION_LEGEND[1].perSquareMile).toBeCloseTo(1553.992866)
    expect(POPULATION_LEGEND[4].perSquareMile).toBeCloseTo(90649.583862)
  })
  it('accepts Chicago tiles and rejects out-of-region/invalid tile coordinates', () => {
    expect(populationTileInRegion(9, 131, 190)).toBe(true)
    for (const [z, x, y] of [[9, 0, 0], [9, -1, 190], [9, 512, 190], [5, 8, 11], [12, 1050, 1520], [9, 131.5, 190], [NaN, 0, 0]]) {
      expect(populationTileInRegion(z, x, y)).toBe(false)
    }
  })
  it('serves cacheable PNG bytes from the source archive, never synthesized practice density', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toContain('s-maxage=604800')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([137, 80, 78, 71])
    expect(tile).toHaveBeenCalledWith(9, 131, 190, expect.any(AbortSignal))
  })
  it('blocks malformed/outside requests before touching the external archive', async () => {
    expect((await get('9', 'https://other.example', '190')).status).toBe(400)
    expect((await get('9', '0', '0')).status).toBe(404)
    expect(metadata).not.toHaveBeenCalled()
    expect(tile).not.toHaveBeenCalled()
  })
  it('returns a transparent image for an absent tile, not a failed image', async () => {
    tile.mockResolvedValue(undefined)
    const response = await get()
    expect(response.status).toBe(200)
    const bytes = Buffer.from(await response.arrayBuffer())
    expect([...bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71])
    // Valid PNG signature alone is insufficient: browsers reject bad chunk CRCs.
    for (let offset = 8; offset < bytes.length;) {
      const length = bytes.readUInt32BE(offset)
      const end = offset + 8 + length
      let crc = 0xffffffff
      for (const value of bytes.subarray(offset + 4, end)) {
        crc ^= value
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
      }
      expect(bytes.readUInt32BE(end)).toBe((crc ^ 0xffffffff) >>> 0)
      offset += length + 12
    }
  })
  it('fails visibly and without caching errors if the source changes or is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    metadata.mockResolvedValue({ description: 'Unknown newer dataset', format: 'png' })
    const changed = await get()
    expect(changed.status).toBe(503)
    expect(changed.headers.get('cache-control')).toBe('no-store')
    expect(tile).not.toHaveBeenCalled()
    metadata.mockResolvedValue({ description: 'WorldPop 2026 100m constrained, palette #20', format: 'png' })
    tile.mockRejectedValue(new Error('Network timeout'))
    expect((await get()).status).toBe(503)
    expect(tile).toHaveBeenCalled()
  })
})
