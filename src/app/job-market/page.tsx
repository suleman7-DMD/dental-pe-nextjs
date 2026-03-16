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

export default async function JobMarketPage() {
  const supabase = await createServerClient()

  // Get the default location's ZIP list
  const defaultLocationKey = Object.keys(LIVING_LOCATIONS)[0]
  const defaultZips = LIVING_LOCATIONS[defaultLocationKey].commutable_zips

  // ── Phase 1: All lightweight queries in parallel ──────────────────────
  // KPI counts use head:true (no row fetching) — fast even for 11k+ practices
  const [
    zipScores, watchedZips, adaBenchmarks,
    { count: globalTotalCount }, { count: daCount }, { data: latestUpdate },
    // Location-scoped counts for KPIs (no row fetching — just counts)
    { count: locTotalCount },
    { count: locIndepCount },
    { count: locDsoRegionalCount },
    { count: locDsoNationalCount },
    { count: locDsoNationalRealCount },
    { count: locDsoRegionalStrongCount },
    { count: locDsoSpecialistsCount },
    { count: locHighVolCount },
    { count: locLargeStaffCount },
    { count: locRetirementCount },
  ] = await Promise.all([
    getZipScores(supabase),
    getWatchedZips(supabase),
    getADABenchmarks(supabase),
    supabase.from('practices').select('npi', { count: 'exact', head: true }),
    supabase.from('practices').select('npi', { count: 'exact', head: true }).not('data_axle_import_date', 'is', null),
    supabase.from('practices').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
    // Total in default location
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips),
    // Independent count (7 types)
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .in('entity_classification', [...INDEPENDENT_CLASSIFICATIONS]),
    // All dso_regional
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .eq('entity_classification', 'dso_regional'),
    // All dso_national
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .eq('entity_classification', 'dso_national'),
    // High-conf dso_national (exclude taxonomy leaks)
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .eq('entity_classification', 'dso_national')
      .not('affiliated_dso', 'in', `(${DSO_NATIONAL_TAXONOMY_LEAKS.join(',')})`),
    // High-conf dso_regional (strong signals only)
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .eq('entity_classification', 'dso_regional')
      .or(DSO_REGIONAL_STRONG_SIGNAL_FILTER),
    // DSO-owned specialists
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .eq('entity_classification', 'specialist')
      .in('ownership_status', ['dso_affiliated', 'pe_backed']),
    // High-volume solos
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .eq('entity_classification', 'solo_high_volume'),
    // Large staff (10+ employees)
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .gte('employee_count', 10),
    // Retirement risk (independent + established before 1995)
    supabase.from('practices').select('npi', { count: 'exact', head: true })
      .in('zip', defaultZips)
      .in('entity_classification', [...INDEPENDENT_CLASSIFICATIONS])
      .not('year_established', 'is', null)
      .lt('year_established', 1995),
  ])

  const freshness = {
    totalPractices: globalTotalCount ?? 0,
    daEnriched: daCount ?? 0,
    lastUpdated: latestUpdate?.updated_at ?? null,
  }

  // Compute server-side KPI counts (no practice rows needed)
  const corporate = (locDsoRegionalCount ?? 0) + (locDsoNationalCount ?? 0)
  const highConfCorporate = (locDsoNationalRealCount ?? 0) + (locDsoRegionalStrongCount ?? 0) + (locDsoSpecialistsCount ?? 0)
  const total_p = locTotalCount ?? 0
  const indep_cnt = locIndepCount ?? 0
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
    large_count: locLargeStaffCount ?? 0,
    retirement_risk: locRetirementCount ?? 0,
    highVolCount: locHighVolCount ?? 0,
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
}
