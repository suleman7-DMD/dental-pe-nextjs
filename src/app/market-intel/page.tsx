import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips, getDistinctMetroAreas } from '@/lib/supabase/queries/watched-zips'
import { fetchPracticeLocations } from '@/lib/supabase/queries/practice-locations'
import { buildZipCensusTallies } from '@/lib/census/zip-census'
import { MarketIntelShell } from './_components/market-intel-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: 'Ownership & Coverage | Chicagoland Census',
  description:
    'Reviewed ownership tiers, explicit unresolved coverage, and ZIP-level census ownership patterns across Chicagoland.',
}

export default async function MarketIntelPage() {
  const supabase = await createServerClient()

  const [zipScores, watchedZips, metroAreas] = await Promise.all([
    getZipScores(supabase),
    getWatchedZips(supabase),
    getDistinctMetroAreas(supabase),
  ])

  const locations = await fetchPracticeLocations(supabase, { gpOnly: true })

  // Per-ZIP census tallies are the ONLY ownership aggregate this page ships.
  // Detector fields (entity_classification / ownership_status) never leave the
  // server here — the legacy floor exhibit lives in Methodology (/data-breakdown).
  const zipCensusTallies = buildZipCensusTallies(locations)

  const latestUpdate = locations
    .map((p) => p.updated_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop() ?? null

  const freshness = {
    totalPractices: locations.length,
    daEnriched: locations.filter((p) => p.data_axle_enriched === true).length,
    lastUpdated: latestUpdate,
  }

  return (
    <MarketIntelShell
      initialZipScores={zipScores}
      initialWatchedZips={watchedZips}
      metroAreas={metroAreas}
      freshness={freshness}
      zipCensusTallies={zipCensusTallies}
    />
  )
}
