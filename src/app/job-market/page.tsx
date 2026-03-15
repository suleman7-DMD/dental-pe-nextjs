import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import { JobMarketShell } from './_components/job-market-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Job Market Intelligence | Dental PE Intelligence',
  description:
    'Evaluate dental practice landscapes near your planned living locations — independent vs consolidated markets.',
}

export default async function JobMarketPage() {
  const supabase = await createServerClient()

  // Fetch zip_scores and watched_zips server-side for initial render
  const [zipScores, watchedZips, adaBenchmarks] = await Promise.all([
    getZipScores(supabase),
    getWatchedZips(supabase),
    getADABenchmarks(supabase),
  ])

  // Pre-fetch data freshness stats
  const { count: totalCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })

  const { count: daCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .not('data_axle_import_date', 'is', null)

  const { data: latestUpdate } = await supabase
    .from('practices')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const freshness = {
    totalPractices: totalCount ?? 0,
    daEnriched: daCount ?? 0,
    lastUpdated: latestUpdate?.updated_at ?? null,
  }

  // Get the default location's ZIP list for initial data load
  const defaultLocationKey = Object.keys(LIVING_LOCATIONS)[0]
  const defaultZips = LIVING_LOCATIONS[defaultLocationKey].commutable_zips

  // Only fetch essential fields for initial render (not all 30+ columns)
  // and cap at 500 rows — the client shell fetches more on-demand via React Query
  const practiceFields = [
    'id', 'npi', 'practice_name', 'doing_business_as', 'city', 'state', 'zip',
    'phone', 'website', 'entity_classification', 'ownership_status',
    'affiliated_dso', 'buyability_score', 'classification_confidence',
    'classification_reasoning', 'year_established', 'employee_count',
    'estimated_revenue', 'latitude', 'longitude', 'data_axle_import_date',
    'num_providers', 'location_type', 'taxonomy_code',
  ].join(',')

  const { data: initialBatch } = await supabase
    .from('practices')
    .select(practiceFields)
    .in('zip', defaultZips)
    .order('practice_name', { ascending: true })
    .range(0, 499)

  const initialPractices = (initialBatch ?? []) as unknown as import('@/lib/types').Practice[]

  return (
    <JobMarketShell
      initialZipScores={zipScores}
      initialWatchedZips={watchedZips}
      initialPractices={initialPractices ?? []}
      freshness={freshness}
      adaBenchmarks={adaBenchmarks}
    />
  )
}
