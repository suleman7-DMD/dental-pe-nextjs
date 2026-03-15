import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
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
  const [zipScores, watchedZips] = await Promise.all([
    getZipScores(supabase),
    getWatchedZips(supabase),
  ])

  // Pre-fetch data freshness stats
  const { count: totalCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })

  const { count: daCount } = await supabase
    .from('practices')
    .select('*', { count: 'exact', head: true })
    .like('import_batch_id', 'DA_%')

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

  // Supabase returns max 1000 rows per query — must paginate
  const allPractices: Record<string, unknown>[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data: batch } = await supabase
      .from('practices')
      .select('*')
      .in('zip', defaultZips)
      .order('practice_name', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (batch && batch.length > 0) {
      allPractices.push(...batch)
      offset += batch.length
      hasMore = batch.length === pageSize
    } else {
      hasMore = false
    }
  }
  const initialPractices = allPractices as unknown as import('@/lib/types').Practice[]

  return (
    <JobMarketShell
      initialZipScores={zipScores}
      initialWatchedZips={watchedZips}
      initialPractices={initialPractices ?? []}
      freshness={freshness}
    />
  )
}
