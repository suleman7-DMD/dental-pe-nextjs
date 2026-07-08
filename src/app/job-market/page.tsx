import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { fetchPracticeLocations } from '@/lib/supabase/queries/practice-locations'
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import { summarizeBuckets, tierToBucket } from '@/lib/census/ownership-truth'
import { countSourceClassesFromRows } from '@/lib/census/zip-census'
import { JobMarketShell, type ServerKpis } from './_components/job-market-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: 'Chicagoland Practice Directory',
  description:
    'Search Chicagoland general-dentistry offices by ownership, ZIP, job-hunt context, and acquisition relevance.',
}

export default async function JobMarketPage() {
  const supabase = await createServerClient()

  // Default to "All Chicagoland" so headline KPIs match Home / Warroom / Launchpad.
  // Pre-2026-04-26 this used `Object.keys(LIVING_LOCATIONS)[0]` which returned
  // "West Loop / South Loop" (142 ZIPs) — Job Market's KPIs disagreed with every
  // other page even though all surfaces meant "Chicagoland".
  const defaultLocationKey =
    "All Chicagoland" in LIVING_LOCATIONS
      ? "All Chicagoland"
      : Object.keys(LIVING_LOCATIONS)[0]
  const defaultZips = LIVING_LOCATIONS[defaultLocationKey].commutable_zips

  try {
    // ── Batch 1: Lightweight full-table reads (parallel) ──────────────────
    const [zipScores, watchedZips, adaBenchmarks] = await Promise.all([
      getZipScores(supabase).catch((e) => {
        console.error('getZipScores failed:', e)
        return []
      }),
      getWatchedZips(supabase).catch((e) => {
        console.error('getWatchedZips failed:', e)
        return []
      }),
      getADABenchmarks(supabase).catch((e) => {
        console.error('getADABenchmarks failed:', e)
        return []
      }),
    ])

    const locations = await fetchPracticeLocations(supabase, { zips: defaultZips, gpOnly: true })
    const latestUpdate = locations
      .map((p) => p.updated_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop() ?? null

    // Canonical GP-only Chicagoland directory feed. The query layer excludes
    // specialists, non-clinical rows, org-only NPIs, da_unverified records, and
    // duplicate shells before the page computes KPIs or renders maps/lists.
    const gpLocations = locations

    // Enriched count: scoped to the GP location set (data_axle_enriched=true).
    // This makes the freshness bar scope-aware: "21.7% in Chicagoland" instead of
    // "0.8% globally" (which used a frozen 381k denominator from data-snapshot.ts).
    const locDaEnrichedCount = gpLocations.filter((p) => p.data_axle_enriched === true).length

    const freshness = {
      totalPractices: locations.length,
      daEnriched: locDaEnrichedCount,
      lastUpdated: latestUpdate,
    }

    // ── Census-first server KPIs ────────────────────────────────────────
    // Ownership comes ONLY from the hand-reviewed census (ownership_tier).
    // The universe denominator is live: SUM(zip_scores.total_gp_locations)
    // for the scope's ZIPs — never a hardcoded tally.
    const universe = zipScores
      .filter((zs) => defaultZips.includes(zs.zip_code))
      .map((zs) => zs.total_gp_locations)
      .filter((v): v is number => v != null && !isNaN(v))
      .reduce((a, b) => a + b, 0)

    const currentYear = new Date().getFullYear()
    let large_count = 0
    let retirement_risk = 0
    let highVolCount = 0
    for (const p of gpLocations) {
      const bucket = tierToBucket(p.ownership_tier)
      const dentistOwned =
        bucket === 'true_solo_owner_operated' || bucket === 'dentist_owned_not_solo'
      if ((p.employee_count ?? 0) >= 10) large_count++
      if (
        dentistOwned &&
        p.year_established != null &&
        p.year_established <= currentYear - 30
      ) {
        retirement_risk++
      }
      if (
        p.ownership_tier === 'true_independent' &&
        ((p.employee_count ?? 0) >= 5 || (p.estimated_revenue ?? 0) >= 800_000)
      ) {
        highVolCount++
      }
    }

    const serverKpis: ServerKpis = {
      total_p: gpLocations.length,
      large_count,
      retirement_risk,
      highVolCount,
      bucketSummary: summarizeBuckets(
        gpLocations.map((p) => ({ ownership_tier: p.ownership_tier, pe_backed: p.pe_backed })),
        universe
      ),
      sourceClasses: countSourceClassesFromRows(
        gpLocations.map((p) => ({
          ownership_tier: p.ownership_tier,
          census_review_status: p.census_review_status ?? null,
        })),
        universe
      ),
    }

    return (
      <JobMarketShell
        initialZipScores={zipScores}
        initialWatchedZips={watchedZips}
        freshness={freshness}
        adaBenchmarks={adaBenchmarks}
        serverKpis={serverKpis}
        defaultLocationKey={defaultLocationKey}
      />
    )
  } catch (error) {
    // If the entire page fails, render with safe fallback data
    console.error('JobMarketPage failed:', error)

    const fallbackKpis: ServerKpis = {
      total_p: 0,
      large_count: 0,
      retirement_risk: 0,
      highVolCount: 0,
      bucketSummary: summarizeBuckets([], 0),
      sourceClasses: { censusReviewed: 0, held: 0, undetermined: 0, notYetReviewed: 0 },
    }

    return (
      <JobMarketShell
        initialZipScores={[]}
        initialWatchedZips={[]}
        freshness={{ totalPractices: 0, daEnriched: 0, lastUpdated: null }}
        adaBenchmarks={[]}
        serverKpis={fallbackKpis}
        defaultLocationKey={defaultLocationKey}
      />
    )
  }
}
