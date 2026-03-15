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

  return (
    <MarketIntelShell
      initialZipScores={zipScores}
      initialWatchedZips={watchedZips}
      metroAreas={metroAreas}
      adaBenchmarks={adaBenchmarks}
      freshness={freshness}
    />
  )
}
