import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import {
  INDEPENDENT_CLASSIFICATIONS,
  DSO_NATIONAL_TAXONOMY_LEAKS,
  DSO_REGIONAL_STRONG_SIGNAL_FILTER,
} from '@/lib/constants/entity-classifications'
import { JobMarketShell } from './_components/job-market-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Job Market Intelligence | Dental PE Intelligence',
  description:
    'Evaluate dental practice landscapes near your planned living locations — independent vs consolidated markets.',
}

/** Safely await a Supabase count query — returns 0 on error instead of crashing the page. */
const safeCount = async (
  query: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> => {
  try {
    const { count, error } = await query
    if (error) {
      console.error('Supabase count query failed:', error)
    }
    return count ?? 0
  } catch (e) {
    console.error('Supabase count query threw:', e)
    return 0
  }
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

    // ── Batch 2: Global counts + freshness (parallel) ─────────────────────
    const [globalTotalCount, daCount, latestUpdate] = await Promise.all([
      safeCount(
        supabase
          .from('practices')
          .select('npi', { count: 'exact', head: true })
      ),
      safeCount(
        supabase
          .from('practices')
          .select('npi', { count: 'exact', head: true })
          .not('data_axle_import_date', 'is', null)
      ),
      Promise.resolve(
        supabase
          .from('practices')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()
      )
        .then(({ data }) => data?.updated_at ?? null)
        .catch(() => null),
    ])

    // ── Batch 3: Location-scoped count queries (parallel) ─────────────────
    const [
      locTotalCount,
      locIndepCount,
      locDsoRegionalCount,
      locDsoNationalCount,
      locDsoNationalRealCount,
      locDsoRegionalStrongCount,
      locDsoSpecialistsCount,
      locHighVolCount,
      locLargeStaffCount,
      locRetirementCount,
    ] = await Promise.all([
      // Total in default location
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
      ),
      // Independent count (7 types)
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .in('entity_classification', [...INDEPENDENT_CLASSIFICATIONS])
      ),
      // All dso_regional
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .eq('entity_classification', 'dso_regional')
      ),
      // All dso_national
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .eq('entity_classification', 'dso_national')
      ),
      // High-conf dso_national (exclude taxonomy leaks)
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .eq('entity_classification', 'dso_national')
          .not(
            'affiliated_dso',
            'in',
            `(${DSO_NATIONAL_TAXONOMY_LEAKS.join(',')})`
          )
      ),
      // High-conf dso_regional (strong signals only)
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .eq('entity_classification', 'dso_regional')
          .or(DSO_REGIONAL_STRONG_SIGNAL_FILTER)
      ),
      // DSO-owned specialists
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .eq('entity_classification', 'specialist')
          .in('ownership_status', ['dso_affiliated', 'pe_backed'])
      ),
      // High-volume solos
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .eq('entity_classification', 'solo_high_volume')
      ),
      // Large staff (10+ employees)
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .gte('employee_count', 10)
      ),
      // Retirement risk (independent + established before 1995)
      safeCount(
        supabase
          .from('practice_locations')
          .select('location_id', { count: 'exact', head: true })
          .in('zip', defaultZips)
          .eq('is_likely_residential', false)
          .in('entity_classification', [...INDEPENDENT_CLASSIFICATIONS])
          .not('year_established', 'is', null)
          .lt('year_established', 1995)
      ),
    ])

    const freshness = {
      totalPractices: globalTotalCount,
      daEnriched: daCount,
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
