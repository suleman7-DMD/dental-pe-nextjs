import { createServerClient } from '@/lib/supabase/server'
import { getDealStats, getRecentDeals } from '@/lib/supabase/queries/deals'
import { getPracticeStats, getRetirementRiskCount, getAcquisitionTargetCount } from '@/lib/supabase/queries/practices'
import { getWatchedZipCount } from '@/lib/supabase/queries/watched-zips'
import { HomeShell } from './_components/home-shell'
import type { HomeSummary } from '@/lib/types'

export const metadata = {
  title: 'Dental PE Intelligence Platform',
  description:
    'Track private equity consolidation in US dentistry. Deal flow, market intelligence, buyability scoring, and pipeline monitoring.',
}

export default async function HomePage() {
  const supabase = await createServerClient()

  const [
    dealStats,
    practiceStats,
    watchedZips,
    retirementRisk,
    acquisitionTargets,
    recentDeals,
  ] = await Promise.all([
    getDealStats(supabase),
    getPracticeStats(supabase),
    getWatchedZipCount(supabase),
    getRetirementRiskCount(supabase),
    getAcquisitionTargetCount(supabase),
    getRecentDeals(supabase, 5),
  ])

  // Get last pipeline run from pipeline_events if available
  // Falls back to most recent deal created_at
  const { data: latestDeal } = await supabase
    .from('deals')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  const lastPipelineRun = latestDeal?.[0]?.created_at
    ? latestDeal[0].created_at.slice(0, 10)
    : null

  const summary: HomeSummary = {
    totalDeals: dealStats.totalDeals,
    ytdDeals: dealStats.ytdDeals,
    activeSponsors: dealStats.activeSponsors,
    totalPractices: practiceStats.totalPractices,
    consolidatedPct: practiceStats.consolidatedPct,
    independentPct: practiceStats.independentPct,
    watchedZips,
    lastPipelineRun,
    retirementRisk,
    recentDeals,
  }

  return <HomeShell summary={summary} acquisitionTargets={acquisitionTargets} />
}
