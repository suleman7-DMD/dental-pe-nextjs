import { createServerClient } from '@/lib/supabase/server'
import { getDealStats, getRecentDeals } from '@/lib/supabase/queries/deals'
import { getPracticeStats, getRetirementRiskCount, getAcquisitionTargetCount } from '@/lib/supabase/queries/practices'
import { getWatchedZipCount } from '@/lib/supabase/queries/watched-zips'
import { getRecentChanges } from '@/lib/supabase/queries/changes'
import { HomeShell } from './_components/home-shell'
import type { HomeSummary } from '@/lib/types'
import type { DealStats } from '@/lib/supabase/types'

export const revalidate = 1800
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
        totalGpLocations: undefined as number | undefined,
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
    // latestPipelineEvent = MAX(pipeline_events.timestamp) — last time the pipeline ran AT ALL.
    //   This is the honest "is sync alive?" signal: it advances on every run, including syncs
    //   that bring zero new deals. (Previously this used MAX(deals.created_at), which only
    //   moved when a NEW deal row was committed — making the page look stale during quiet weeks.)
    // latestDealDateResult = MAX(deal_date) — when the most recent deal was actually ANNOUNCED.
    //   Drives the honesty banner: if MAX(deal_date) is >30d old the banner fires regardless
    //   of how often sync runs, so stale upstream sources can't hide behind a healthy sync.
    const [retirementRisk, acquisitionTargets, recentChanges, latestPipelineEvent, latestDealDateResult] =
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
            .from('pipeline_events')
            .select('timestamp')
            .order('timestamp', { ascending: false })
            .limit(1)
          return data as { timestamp: string }[] | null
        })(),
        (async () => {
          const { data } = await supabase
            .from('deals')
            .select('deal_date')
            .not('deal_date', 'is', null)
            .order('deal_date', { ascending: false })
            .limit(1)
          return data as { deal_date: string }[] | null
        })(),
      ])

    const lastPipelineRun = latestPipelineEvent?.[0]?.timestamp
      ? String(latestPipelineEvent[0].timestamp).slice(0, 10)
      : null
    const lastNewDealDate = latestDealDateResult?.[0]?.deal_date
      ? String(latestDealDateResult[0].deal_date).slice(0, 10)
      : null

    // Use enrichedCount from practiceStats (already fetched there) to avoid duplicate query
    const enrichedCount = 'enriched' in practiceStats ? (practiceStats as { enriched: number }).enriched : 0

    const summary: HomeSummary = {
      totalDeals: dealStats.totalDeals,
      ytdDeals: dealStats.ytdDeals,
      activeSponsors: dealStats.activeSponsors,
      totalPractices: practiceStats.totalPractices,
      totalGpLocations: practiceStats.totalGpLocations,
      consolidatedPct: practiceStats.consolidatedPct,
      independentPct: practiceStats.independentPct,
      watchedZips,
      lastPipelineRun,
      lastNewDealDate,
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
          <p className="text-[#707064] text-sm mt-4">
            If this persists, check Supabase connection.
          </p>
        </div>
      </div>
    )
  }
}
