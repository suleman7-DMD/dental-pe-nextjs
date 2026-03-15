import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips, getDistinctMetroAreas } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { MarketIntelShell } from './_components/market-intel-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Market Intelligence | Dental PE Intelligence',
  description:
    'Drill into watched neighborhoods to see ownership breakdown, consolidation levels, and market saturation across ZIP codes.',
}

export default async function MarketIntelPage() {
  const supabase = await createServerClient()

  const [zipScores, watchedZips, metroAreas, adaBenchmarks] = await Promise.all([
    getZipScores(supabase),
    getWatchedZips(supabase),
    getDistinctMetroAreas(supabase),
    getADABenchmarks(supabase),
  ])

  // Data freshness stats
  const { count: totalPractices } = await supabase
    .from('practices')
    .select('npi', { count: 'exact', head: true })

  const { count: daEnriched } = await supabase
    .from('practices')
    .select('npi', { count: 'exact', head: true })
    .not('data_axle_import_date', 'is', null)

  const { data: latestUpdate } = await supabase
    .from('practices')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const freshness = {
    totalPractices: totalPractices ?? 0,
    daEnriched: daEnriched ?? 0,
    lastUpdated: latestUpdate?.updated_at ?? null,
  }

  // Get entity_classification-based practice counts for watched ZIPs
  const allWatchedZipCodes = watchedZips.map(z => z.zip_code)

  // Total practices in watched ZIPs
  const { count: watchedTotal } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .in('zip', allWatchedZipCodes)

  // Corporate by entity_classification (primary)
  const { count: corporateByEC } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .in('zip', allWatchedZipCodes)
    .in('entity_classification', ['dso_regional', 'dso_national'])

  // Corporate by ownership_status fallback (where entity_classification missing)
  const { count: corporateByStatus } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .in('zip', allWatchedZipCodes)
    .in('ownership_status', ['dso_affiliated', 'pe_backed'])
    .is('entity_classification', null)

  // Independent by entity_classification (primary) — 7 types per isIndependentClassification()
  const { count: independentByEC } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .in('zip', allWatchedZipCodes)
    .in('entity_classification', [
      'solo_established', 'solo_new', 'solo_inactive', 'solo_high_volume',
      'family_practice', 'small_group', 'large_group'
    ])

  // Independent by ownership_status fallback
  const { count: independentByStatus } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .in('zip', allWatchedZipCodes)
    .in('ownership_status', ['independent', 'likely_independent'])
    .is('entity_classification', null)

  const classificationCounts = {
    total: watchedTotal ?? 0,
    corporate: (corporateByEC ?? 0) + (corporateByStatus ?? 0),
    independent: (independentByEC ?? 0) + (independentByStatus ?? 0),
    unknown: (watchedTotal ?? 0) - (corporateByEC ?? 0) - (corporateByStatus ?? 0) - (independentByEC ?? 0) - (independentByStatus ?? 0),
  }

  return (
    <MarketIntelShell
      initialZipScores={zipScores}
      initialWatchedZips={watchedZips}
      metroAreas={metroAreas}
      adaBenchmarks={adaBenchmarks}
      freshness={freshness}
      classificationCounts={classificationCounts}
    />
  )
}
