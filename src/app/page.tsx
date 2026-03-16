import { createServerClient } from '@/lib/supabase/server'
import { getDealStats, getRecentDeals } from '@/lib/supabase/queries/deals'
import { getPracticeStats, getRetirementRiskCount, getAcquisitionTargetCount } from '@/lib/supabase/queries/practices'
import { getWatchedZipCount } from '@/lib/supabase/queries/watched-zips'
import { getRecentChanges } from '@/lib/supabase/queries/changes'
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

    // Phase 1: fetch deals + lightweight queries in parallel
    // NOTE: getPracticeStats runs separately to avoid concurrent DB overload.
    // Running 10+ count queries on a 400k-row table simultaneously causes
    // Supabase Postgres statement_timeout (error 57014).
    const [dealStats, watchedZips, recentDeals] =
      await Promise.all([
        getDealStats(supabase).catch(
          () =>
            ({
              total_deals: 0,
              by_deal_type: {},
              by_state: {},
              avg_deal_size_mm: null,
              avg_ebitda_multiple: null,
              unique_pe_sponsors: 0,
              deals: [],
              distinctSponsors: [],
              distinctPlatforms: [],
              distinctStates: [],
              distinctSpecialties: [],
              distinctSources: [],
              distinctTypes: [],
              totalDeals: 0,
              ytdDeals: 0,
              activeSponsors: 0,
            }) as DealStats
        ),
        getWatchedZipCount(supabase).catch(() => 0),
        getRecentDeals(supabase, 10).catch(() => []),
      ])

    // Phase 2: practice stats (internally batched to avoid statement_timeout)
    const practiceStats = await getPracticeStats(supabase).catch((err) => {
      console.error('[HomePage] getPracticeStats error:', err)
      return {
        totalPractices: 0,
        total: 0,
        corporate: 0,
        corporateHighConf: 0,
        independent: 0,
        unknown: 0,
        enriched: 0,
        consolidatedPct: '--',
        independentPct: '--',
      }
    })

    // Phase 3: secondary metrics (lightweight, each does 1-2 queries)
    const [retirementRisk, acquisitionTargets, recentChanges, latestDealResult] =
      await Promise.all([
        getRetirementRiskCount(supabase).catch((err) => {
          console.error('[HomePage] retirementRisk error:', err)
          return 0
        }),
        getAcquisitionTargetCount(supabase).catch((err) => {
          console.error('[HomePage] acquisitionTargets error:', err)
          return 0
        }),
        getRecentChanges(supabase, undefined, 90)
          .then((changes) => changes.slice(0, 8))
          .catch((err) => {
            console.error('[HomePage] recentChanges error:', err)
            return [] as import('@/lib/types').PracticeChange[]
          }),
        (async () => {
          const { data } = await supabase
            .from('deals')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
          return data as { created_at: string }[] | null
        })(),
      ])

    const lastPipelineRun = latestDealResult?.[0]?.created_at
      ? String(latestDealResult[0].created_at).slice(0, 10)
      : null

    // Use enrichedCount from practiceStats (already fetched there) to avoid duplicate query
    const enrichedCount = 'enriched' in practiceStats ? (practiceStats as { enriched: number }).enriched : 0

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
      enrichedCount,
      recentDeals,
    }

    return <HomeShell summary={summary} acquisitionTargets={acquisitionTargets} recentChanges={recentChanges} />
  } catch (error) {
    console.error('HomePage error:', error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAFAF7] text-[#1A1A1A]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-[#6B6B60]">
            Data is being fetched. Please refresh in a moment.
          </p>
          <p className="text-[#9C9C90] text-sm mt-4">
            If this persists, check Supabase connection.
          </p>
        </div>
      </div>
    )
  }
}
