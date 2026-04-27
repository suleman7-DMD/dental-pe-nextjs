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
import {
  GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
  GLOBAL_PRACTICE_NPI_COUNT,
} from '@/lib/constants/data-snapshot'
import { JobMarketShell } from './_components/job-market-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: 'Job Market Intelligence | Dental PE Intelligence',
  description:
    'Evaluate dental practice landscapes near your planned living locations — independent vs consolidated markets.',
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

    const locations = await fetchPracticeLocations(supabase, { zips: defaultZips })
    const latestUpdate = locations
      .map((p) => p.updated_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop() ?? null
    const locTotalCount = locations.length
    const locIndepCount = locations.filter((p) =>
      INDEPENDENT_CLASSIFICATIONS.includes(
        p.entity_classification as (typeof INDEPENDENT_CLASSIFICATIONS)[number]
      )
    ).length
    const locDsoRegionalCount = locations.filter((p) => p.entity_classification === 'dso_regional').length
    const locDsoNationalCount = locations.filter((p) => p.entity_classification === 'dso_national').length
    const locDsoNationalRealCount = locations.filter((p) => p.entity_classification === 'dso_national' && !(DSO_NATIONAL_TAXONOMY_LEAKS as readonly string[]).includes(p.affiliated_dso ?? '')).length
    const locDsoRegionalStrongCount = locations.filter((p) => p.entity_classification === 'dso_regional' && (p.ein || p.parent_company || p.classification_reasoning?.toLowerCase().includes('generic brand') || p.classification_reasoning?.toLowerCase().includes('branch'))).length
    const locDsoSpecialistsCount = locations.filter((p) => p.entity_classification === 'specialist' && (p.ownership_status === 'dso_affiliated' || p.ownership_status === 'pe_backed')).length
    const locHighVolCount = locations.filter((p) => p.entity_classification === 'solo_high_volume').length
    const locLargeStaffCount = locations.filter((p) => (p.employee_count ?? 0) >= 10).length
    const locRetirementCount = locations.filter((p) =>
      INDEPENDENT_CLASSIFICATIONS.includes(
        p.entity_classification as (typeof INDEPENDENT_CLASSIFICATIONS)[number]
      ) &&
      p.year_established != null &&
      p.year_established < 1995
    ).length

    const freshness = {
      totalPractices: GLOBAL_PRACTICE_NPI_COUNT,
      daEnriched: GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
      lastUpdated: latestUpdate,
    }

    // Compute server-side KPI counts (no practice rows needed)
    const corporate = locDsoRegionalCount + locDsoNationalCount
    const highConfCorporate =
      locDsoNationalRealCount +
      locDsoRegionalStrongCount +
      locDsoSpecialistsCount
    const total_p = locTotalCount
    const indep_cnt = locIndepCount
    // specialist + non_clinical + unclassified = total - corporate - independent
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
