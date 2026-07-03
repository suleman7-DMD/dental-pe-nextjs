import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { fetchPracticeLocations } from '@/lib/supabase/queries/practice-locations'
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import {
  INDEPENDENT_CLASSIFICATIONS,
  DSO_NATIONAL_TAXONOMY_LEAKS,
} from '@/lib/constants/entity-classifications'
import { JobMarketShell } from './_components/job-market-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: 'Master GP Directory | Chicagoland Census',
  description:
    'Search Chicagoland GP locations by ownership, ZIP, job-hunt context, and acquisition relevance.',
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

    const locTotalCount = gpLocations.length
    const locIndepCount = gpLocations.filter((p) =>
      INDEPENDENT_CLASSIFICATIONS.includes(
        p.entity_classification as (typeof INDEPENDENT_CLASSIFICATIONS)[number]
      )
    ).length
    const locDsoRegionalCount = gpLocations.filter((p) => p.entity_classification === 'dso_regional').length
    const locDsoNationalCount = gpLocations.filter((p) => p.entity_classification === 'dso_national').length
    const locDsoNationalRealCount = gpLocations.filter((p) => p.entity_classification === 'dso_national' && !(DSO_NATIONAL_TAXONOMY_LEAKS as readonly string[]).includes(p.affiliated_dso ?? '')).length
    const locDsoRegionalStrongCount = gpLocations.filter((p) => p.entity_classification === 'dso_regional' && (p.ein || p.parent_company || p.classification_reasoning?.toLowerCase().includes('generic brand') || p.classification_reasoning?.toLowerCase().includes('franchise') || p.classification_reasoning?.toLowerCase().includes('branch'))).length
    const locDsoSpecialistsCount = 0
    const locHighVolCount = gpLocations.filter((p) => p.entity_classification === 'solo_high_volume').length
    const locLargeStaffCount = gpLocations.filter((p) => (p.employee_count ?? 0) >= 10).length
    const locRetirementCount = gpLocations.filter((p) =>
      INDEPENDENT_CLASSIFICATIONS.includes(
        p.entity_classification as (typeof INDEPENDENT_CLASSIFICATIONS)[number]
      ) &&
      p.year_established != null &&
      p.year_established < new Date().getFullYear() - 30
    ).length
    // Enriched count: scoped to the GP location set (data_axle_enriched=true).
    // This makes the freshness bar scope-aware: "21.7% in Chicagoland" instead of
    // "0.8% globally" (which used a frozen 381k denominator from data-snapshot.ts).
    const locDaEnrichedCount = gpLocations.filter((p) => p.data_axle_enriched === true).length

    const freshness = {
      totalPractices: locations.length,
      daEnriched: locDaEnrichedCount,
      lastUpdated: latestUpdate,
    }

    // Compute server-side KPI counts using GP-scoped denominators
    const corporate = locDsoRegionalCount + locDsoNationalCount
    const highConfCorporate =
      locDsoNationalRealCount +
      locDsoRegionalStrongCount +
      locDsoSpecialistsCount
    const total_p = locTotalCount  // GP locations only — excludes specialist/non_clinical
    const indep_cnt = locIndepCount
    // unclassified = GP total - corporate - independent (specialist/non_clinical already excluded)
    const unk_cnt = Math.max(0, total_p - corporate - indep_cnt)

    const serverKpis = {
      total_p,
      indep_cnt,
      dso_cnt: corporate,
      pe_cnt: 0,
      unk_cnt,
      highConfCorporate,
      allSignalsCorporate: corporate,
      large_count: locLargeStaffCount,
      retirement_risk: locRetirementCount,
      highVolCount: locHighVolCount,
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

    const fallbackKpis = {
      total_p: 0,
      indep_cnt: 0,
      dso_cnt: 0,
      pe_cnt: 0,
      unk_cnt: 0,
      highConfCorporate: 0,
      allSignalsCorporate: 0,
      large_count: 0,
      retirement_risk: 0,
      highVolCount: 0,
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
