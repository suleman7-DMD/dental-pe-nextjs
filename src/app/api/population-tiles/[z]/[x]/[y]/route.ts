import { FetchSource, PMTiles } from 'pmtiles'
import { POPULATION_ARCHIVE, POPULATION_DESCRIPTION, populationTileInRegion } from '@/lib/maps/population-density'

export const runtime = 'nodejs'

class TimedSource extends FetchSource {
  getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string) {
    const timeout = AbortSignal.timeout(10_000)
    return super.getBytes(offset, length, signal ? AbortSignal.any([signal, timeout]) : timeout, etag)
  }
}
// PMTiles range-reads only the required PNGs; never downloads the world archive.
const archive = new PMTiles(new TimedSource(POPULATION_ARCHIVE))
let metadataCheck: Promise<void> | undefined
async function checkMetadata() {
  metadataCheck ??= archive.getMetadata().then(value => {
    const metadata = value as { description?: string; format?: string }
    if (metadata.description !== POPULATION_DESCRIPTION || metadata.format !== 'png') {
      throw new Error('Population source changed; attribution needs review')
    }
  }).catch(error => { metadataCheck = undefined; throw error })
  return metadataCheck
}
const EMPTY_PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg==', 'base64'))

export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const raw = await params
  if (![raw.z, raw.x, raw.y].every(v => /^\d+$/.test(v))) return new Response('Invalid tile', { status: 400 })
  const [z, x, y] = [Number(raw.z), Number(raw.x), Number(raw.y)]
  if (!populationTileInRegion(z, x, y)) return new Response('Outside population layer coverage', { status: 404 })
  try {
    await checkMetadata()
    const tile = await archive.getZxy(z, x, y, AbortSignal.timeout(10_000))
    return new Response(tile?.data ?? EMPTY_PNG, { headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    console.error('Population tile unavailable', error instanceof Error ? error.message : 'Unknown error')
    return new Response('Population overlay temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
