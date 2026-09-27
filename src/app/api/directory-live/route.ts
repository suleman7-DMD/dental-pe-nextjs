import { gzipSync } from 'node:zlib'
import { createServerClient } from '@/lib/supabase/server'
import { fetchPracticeLocations, practiceLocationToLaunchpadRecord } from '@/lib/supabase/queries/practice-locations'
import { fetchDirectoryWebCheckMap } from '@/lib/supabase/queries/directory-web-checks'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
import { makeDirectorySnapshot, type LiveOffice, type OfficeGeocodes } from '@/lib/directory/live-directory'
import officeGeocodes from '@/data/office-geocodes.json'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export async function GET() {
  try {
    const db = createServerClient()
    const watched = await getWatchedZips(db)
    if (!watched.length) throw new Error('Directory coverage unavailable')
    const [locations, checks] = await Promise.all([
      fetchPracticeLocations(db, { zips: watched.map(z => z.zip_code), gpOnly: true }),
      fetchDirectoryWebCheckMap(db),
    ])
    const snapshot = makeDirectorySnapshot(
      locations.map(p => {
        const r = practiceLocationToLaunchpadRecord(p)
        // The live feed contains only displayed directory fields. Large ownership
        // narratives and provider source bundles stay on their detail endpoints.
        return { location_id: r.location_id, npi: r.npi, practice_name: r.practice_name,
          doing_business_as: r.doing_business_as, provider_last_name: r.provider_last_name,
          address: r.address, city: r.city, state: r.state, zip: r.zip, phone: r.phone,
          website: r.website, latitude: r.latitude, longitude: r.longitude, network_id: r.network_id,
          ownership_tier: r.ownership_tier, provider_npis: r.provider_npis, year_established: r.year_established } as LiveOffice
      }), checks,
      watched.map(z => ({ zip: z.zip_code, city: z.city ?? '' })), new Date().toISOString(),
      officeGeocodes.offices as OfficeGeocodes,
    )
    return new Response(gzipSync(JSON.stringify(snapshot)), { headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('[directory-live] Complete snapshot unavailable', error)
    // Never fail open to raw rows: doing so would resurrect removed offices.
    return Response.json({ error: 'The directory could not refresh. Your last successful view is preserved.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
