import { createServerClient } from '@/lib/supabase/server'
import { getOfficeCensusCandidatesForZip, getOfficeCensusLatestBuild } from '@/lib/supabase/queries/office-census'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get('zip')
  if (!zip || !/^\d{5}$/.test(zip)) return Response.json({ error: 'Choose a valid ZIP.' }, { status: 400 })
  try {
    const db = createServerClient()
    const [candidates, build] = await Promise.all([getOfficeCensusCandidatesForZip(db, zip), getOfficeCensusLatestBuild(db)])
    return Response.json({ candidates, publishedAt: build?.published_at ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Source evidence unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
