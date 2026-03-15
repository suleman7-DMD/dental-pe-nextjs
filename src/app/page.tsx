import { createServerClient } from '@/lib/supabase/server'
import { getDealStats, getRecentDeals } from '@/lib/supabase/queries/deals'
import { getPracticeStats, getRetirementRiskCount, getAcquisitionTargetCount } from '@/lib/supabase/queries/practices'
import { getWatchedZipCount } from '@/lib/supabase/queries/watched-zips'
import { HomeShell } from './_components/home-shell'
import type { HomeSummary } from '@/lib/types'
import type { DealStats } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Dental PE Intelligence Platform',
  description:
    'Track private equity consolidation in US dentistry. Deal flow, market intelligence, buyability scoring, and pipeline monitoring.',
}

export default async function HomePage() {
  try {
    const supabase = await createServerClient()

    const [
      dealStats,
      practiceStats,
      watchedZips,
      retirementRisk,
      acquisitionTargets,
      recentDeals,
    ] = await Promise.all([
      getDealStats(supabase).catch(() => ({ total_deals: 0, by_deal_type: {}, by_state: {}, avg_deal_size_mm: null, avg_ebitda_multiple: null, unique_pe_sponsors: 0, deals: [], distinctSponsors: [], distinctPlatforms: [], distinctStates: [], distinctSpecialties: [], distinctSources: [], distinctTypes: [], totalDeals: 0, ytdDeals: 0, activeSponsors: 0 } as DealStats)),
      getPracticeStats(supabase).catch(() => ({ totalPractices: 0, consolidatedPct: '--', independentPct: '--' })),
      getWatchedZipCount(supabase).catch(() => 0),
      getRetirementRiskCount(supabase).catch(() => 0),
      getAcquisitionTargetCount(supabase).catch(() => 0),
      getRecentDeals(supabase, 5).catch(() => []),
    ])

    const { data: latestDeal } = await supabase
      .from('deals')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    const lastPipelineRun = latestDeal?.[0]?.created_at
      ? String(latestDeal[0].created_at).slice(0, 10)
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
  } catch (error) {
    console.error('HomePage error:', error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0F1E] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-gray-400">Data is being fetched. Please refresh in a moment.</p>
          <p className="text-gray-600 text-sm mt-4">If this persists, check Supabase connection.</p>
        </div>
      </div>
    )
  }
}
