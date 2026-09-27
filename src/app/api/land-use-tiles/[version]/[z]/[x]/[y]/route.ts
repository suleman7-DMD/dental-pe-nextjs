import { open } from 'node:fs/promises'
import path from 'node:path'
import { PMTiles, type Source } from 'pmtiles'
import { LAND_USE_VERSION, validLandUseTile } from '@/lib/maps/land-use'

export const runtime = 'nodejs'

// Packaged with the function; read only the requested byte ranges, never the full archive.
class LocalArchive implements Source {
  getKey() { return LAND_USE_VERSION }
  async getBytes(offset: number, length: number) {
    const file = await open(path.join(process.cwd(), 'data/land-use/chicagoland-2023.pmtiles'), 'r')
    try {
      const buffer = Buffer.alloc(length)
      let read = 0
      while (read < length) {
        const { bytesRead } = await file.read(buffer, read, length - read, offset + read)
        if (!bytesRead) throw new Error('Incomplete land-use archive')
        read += bytesRead
      }
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + length) as ArrayBuffer }
    } finally { await file.close() }
  }
}
const archive = new PMTiles(new LocalArchive())

export async function GET(_request: Request, { params }: { params: Promise<{ version: string; z: string; x: string; y: string }> }) {
  const raw = await params
  if (raw.version !== LAND_USE_VERSION) return new Response('Unknown land-use version', { status: 404 })
  if (![raw.z, raw.x, raw.y].every(v => /^\d{1,5}$/.test(v))) return new Response('Invalid tile', { status: 400 })
  const [z, x, y] = [Number(raw.z), Number(raw.x), Number(raw.y)]
  if (!validLandUseTile(z, x, y)) return new Response('Invalid tile', { status: 400 })
  try {
    const tile = await archive.getZxy(z, x, y)
    // A valid empty protobuf tile explicitly means outside the archived coverage.
    return new Response(tile?.data ?? new ArrayBuffer(0), { headers: {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    console.error('Land-use tile unavailable', error instanceof Error ? error.message : 'Unknown error')
    return new Response('Land-use layer unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
