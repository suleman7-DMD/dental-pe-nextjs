import { createServerClient } from '@/lib/supabase/server'
import { getZipScores } from '@/lib/supabase/queries/zip-scores'
import { getWatchedZips, getDistinctMetroAreas } from '@/lib/supabase/queries/watched-zips'
import { getADABenchmarks } from '@/lib/supabase/queries/ada-benchmarks'
import { fetchPracticeLocations } from '@/lib/supabase/queries/practice-locations'
import {
  GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
  GLOBAL_PRACTICE_NPI_COUNT,
} from '@/lib/constants/data-snapshot'
import { MarketIntelShell } from './_components/market-intel-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
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

  const taxonomyLeaks = ['General Dentistry', 'Oral Surgery', 'Orthodontics', 'Periodontics', 'Endodontics', 'Pediatric Dentistry', 'Prosthodontics', 'Dental Hygiene']
  const locations = await fetchPracticeLocations(supabase)

  const watchedTotal = locations.length
  const corporateByEC = locations.filter((p) => p.entity_classification === 'dso_regional' || p.entity_classification === 'dso_national').length
  const corporateByStatus = locations.filter((p) => p.entity_classification == null && (p.ownership_status === 'dso_affiliated' || p.ownership_status === 'pe_backed')).length
  const independentByEC = locations.filter((p) => ['solo_established', 'solo_new', 'solo_inactive', 'solo_high_volume', 'family_practice', 'small_group', 'large_group'].includes(p.entity_classification ?? '')).length
  const independentByStatus = locations.filter((p) => p.entity_classification == null && (p.ownership_status === 'independent' || p.ownership_status === 'likely_independent')).length
  const dsoNationalReal = locations.filter((p) => p.entity_classification === 'dso_national' && !taxonomyLeaks.includes(p.affiliated_dso ?? '')).length
  const dsoRegionalStrong = locations.filter((p) => p.entity_classification === 'dso_regional' && (
    p.classification_reasoning?.includes('EIN=') ||
    p.classification_reasoning?.toLowerCase().includes('generic brand') ||
    p.classification_reasoning?.includes('parent_company') ||
    p.classification_reasoning?.toLowerCase().includes('franchise') ||
    p.classification_reasoning?.toLowerCase().includes('branch')
  )).length
  const dsoSpecialists = locations.filter((p) => p.entity_classification === 'specialist' && (p.ownership_status === 'dso_affiliated' || p.ownership_status === 'pe_backed')).length
  const latestUpdate = locations
    .map((p) => p.updated_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop() ?? null

  // FIX 4: Per-entity-classification counts for Ownership tab
  const ecValues = ['solo_established','solo_new','solo_inactive','solo_high_volume','family_practice','small_group','large_group','dso_regional','dso_national','specialist','non_clinical'] as const
  const entityCounts: Record<string, number> = {}
  ecValues.forEach((ec) => { entityCounts[ec] = locations.filter((p) => p.entity_classification === ec).length })

  const freshness = {
    totalPractices: GLOBAL_PRACTICE_NPI_COUNT,
    daEnriched: GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
    lastUpdated: latestUpdate,
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
