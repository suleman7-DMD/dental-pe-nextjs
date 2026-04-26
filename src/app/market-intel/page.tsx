import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips, getDistinctMetroAreas } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { MarketIntelShell } from './_components/market-intel-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Market Intelligence | Dental PE Intelligence',
  description:
    'Drill into watched neighborhoods to see ownership breakdown, consolidation levels, and market saturation across ZIP codes.',
}

export default async function MarketIntelPage() {
  const supabase = await createServerClient()

  const [zipScores, watchedZips, metroAreas, adaBenchmarks] = await Promise.all([
    getZipScores(supabase),
    getWatchedZips(supabase),
    getDistinctMetroAreas(supabase),
    getADABenchmarks(supabase),
  ])

  // Run ALL secondary queries in parallel: freshness + classification counts
  const allWatchedZipCodes = watchedZips.map(z => z.zip_code)
  const taxonomyLeaks = ['General Dentistry', 'Oral Surgery', 'Orthodontics', 'Periodontics', 'Endodontics', 'Pediatric Dentistry', 'Prosthodontics', 'Dental Hygiene']

  const [
    { count: totalPractices },
    { count: daEnriched },
    { data: latestUpdate },
    { count: watchedTotal },
    { count: corporateByEC },
    { count: corporateByStatus },
    { count: independentByEC },
    { count: independentByStatus },
    { count: dsoNationalReal },
    { count: dsoRegionalStrong },
    { count: dsoSpecialists },
  ] = await Promise.all([
    supabase.from('practices').select('npi', { count: 'exact', head: true }),
    supabase.from('practices').select('npi', { count: 'exact', head: true }).not('data_axle_import_date', 'is', null),
    supabase.from('practices').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).in('entity_classification', ['dso_regional', 'dso_national']),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).in('ownership_status', ['dso_affiliated', 'pe_backed']).is('entity_classification', null),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).in('entity_classification', ['solo_established', 'solo_new', 'solo_inactive', 'solo_high_volume', 'family_practice', 'small_group', 'large_group']),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).in('ownership_status', ['independent', 'likely_independent']).is('entity_classification', null),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).eq('entity_classification', 'dso_national').not('affiliated_dso', 'in', `(${taxonomyLeaks.join(',')})`),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).eq('entity_classification', 'dso_regional').or('classification_reasoning.ilike.%EIN=%,classification_reasoning.ilike.%generic brand%,classification_reasoning.ilike.%parent_company%,classification_reasoning.ilike.%franchise%,classification_reasoning.ilike.%branch%'),
    supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).eq('entity_classification', 'specialist').in('ownership_status', ['dso_affiliated', 'pe_backed']),
  ])

  // FIX 4: Per-entity-classification counts for Ownership tab
  const ecValues = ['solo_established','solo_new','solo_inactive','solo_high_volume','family_practice','small_group','large_group','dso_regional','dso_national','specialist','non_clinical'] as const
  const ecCountResults = await Promise.all(
    ecValues.map(ec => supabase.from('practice_locations').select('location_id', { count: 'exact', head: true }).in('zip', allWatchedZipCodes).eq('is_likely_residential', false).eq('entity_classification', ec))
  )
  const entityCounts: Record<string, number> = {}
  ecValues.forEach((ec, i) => { entityCounts[ec] = ecCountResults[i].count ?? 0 })

  const freshness = {
    totalPractices: totalPractices ?? 0,
    daEnriched: daEnriched ?? 0,
    lastUpdated: latestUpdate?.updated_at ?? null,
  }

  const highConfCorporate = (dsoNationalReal ?? 0) + (dsoRegionalStrong ?? 0) + (dsoSpecialists ?? 0)
  const allCorporate = (corporateByEC ?? 0) + (corporateByStatus ?? 0)

  const classificationCounts = {
    total: watchedTotal ?? 0,
    corporate: allCorporate,
    corporateHighConf: highConfCorporate,
    independent: (independentByEC ?? 0) + (independentByStatus ?? 0),
    unknown: Math.max(0, (watchedTotal ?? 0) - allCorporate - (independentByEC ?? 0) - (independentByStatus ?? 0)),
  }

  return (
    <MarketIntelShell
      initialZipScores={zipScores}
      initialWatchedZips={watchedZips}
      metroAreas={metroAreas}
      adaBenchmarks={adaBenchmarks}
      freshness={freshness}
      classificationCounts={classificationCounts}
      entityCounts={entityCounts}
    />
  )
}
