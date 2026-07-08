'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { KpiCard } from '@/components/data-display/kpi-card'
import { HeadlineKpiCard } from '@/components/data-display/headline-kpi-card'
import { gpLocationsStat, handReviewedStat } from '@/lib/census/headline-stats'
import { DataFreshnessBar } from '@/components/data-display/data-freshness-bar'
import { LivingLocationSelector } from './living-location-selector'
import { SaturationTable } from './saturation-table'
import { ADABenchmarks } from './ada-benchmarks'

// Lazy-load heavy components (map, charts, large tables)
const PracticeDensityMap = dynamic(() => import('./practice-density-map').then(m => ({ default: m.PracticeDensityMap })), {
  loading: () => <div className="h-[500px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">Loading map...</div>,
  ssr: false,
})
const SaturationMap = dynamic(() => import('./saturation-map').then(m => ({ default: m.SaturationMap })), {
  loading: () => <div className="h-[500px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">Loading saturation map...</div>,
  ssr: false,
})
const MarketOverviewCharts = dynamic(() => import('./market-overview-charts').then(m => ({ default: m.MarketOverviewCharts })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const PracticeDirectory = dynamic(() => import('./practice-directory').then(m => ({ default: m.PracticeDirectory })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const ConsolidatedPracticeTree = dynamic(() => import('./consolidated-practice-tree').then(m => ({ default: m.ConsolidatedPracticeTree })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const OpportunitySignals = dynamic(() => import('./opportunity-signals').then(m => ({ default: m.OpportunitySignals })), {
  loading: () => <div className="h-[200px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const OwnershipLandscape = dynamic(() => import('./ownership-landscape').then(m => ({ default: m.OwnershipLandscape })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const MarketAnalytics = dynamic(() => import('./market-analytics').then(m => ({ default: m.MarketAnalytics })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import { summarizeBuckets, tierToBucket, type BucketSummary } from '@/lib/census/ownership-truth'
import { CensusBucketSummaryCard } from '@/components/data-display/census-bucket-summary'
import { computeJobOpportunityScore } from '@/lib/utils/scoring'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  fetchPracticeLocations,
  practiceLocationToLaunchpadRecord,
} from '@/lib/supabase/queries/practice-locations'
import { Hospital, ClipboardCheck, Users, Clock, MapPin, Store, Zap } from 'lucide-react'

import type { Practice, ZipScore, WatchedZip } from '@/lib/types'
import type { ADABenchmark } from '@/lib/supabase/queries/ada-benchmarks'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ServerKpis {
  /** GP-class location rows in scope (structural count, not an ownership claim). */
  total_p: number
  large_count: number
  retirement_risk: number
  highVolCount: number
  /** The five-bucket census ownership summary — the ONLY ownership headline. */
  bucketSummary: BucketSummary
}

interface JobMarketShellProps {
  initialZipScores: ZipScore[]
  initialWatchedZips: WatchedZip[]
  freshness: {
    totalPractices: number
    daEnriched: number
    lastUpdated: string | null
  }
  adaBenchmarks?: ADABenchmark[]
  serverKpis: ServerKpis
  defaultLocationKey: string
}

/**
 * Per-ZIP census bucket composition (GP scope). Counts are of tracked GP
 * location rows in the ZIP; `unresolved_count` = rows without a reviewed
 * census conclusion — always carried, never dropped or guessed.
 */
export interface ZipStats {
  zip_code: string
  city: string
  total_practices: number
  solo_owner_count: number
  dentist_owned_count: number
  dso_pe_count: number
  institutional_count: number
  unresolved_count: number
  reviewed_count: number
  reviewed_pct: number
}

// ────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'map', label: 'Map' },
  { id: 'directory', label: 'Directory' },
  { id: 'tree', label: 'Consolidated Tree' },
  { id: 'analytics', label: 'Analytics' },
] as const

type TabId = (typeof TABS)[number]['id']

// Tabs that require the full practice dataset
const FULL_DATA_TABS: TabId[] = ['map', 'directory', 'tree', 'analytics']

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

// GP-scope guard (non-ownership axis): specialists, labs, org-only NPIs,
// unverified Data-Axle rows, and duplicate shells stay outside the GP
// denominator. This is NOT an ownership claim — ownership comes only from
// the census tier.
const NON_GP_CLASSES = new Set([
  'specialist',
  'non_clinical',
  'org_only_npi',
  'da_unverified',
  'duplicate_location',
])

function isGpRow(p: Practice): boolean {
  return !NON_GP_CLASSES.has((p.entity_classification ?? '').trim().toLowerCase())
}

/** Live GP-clinic denominator for a ZIP set: SUM(zip_scores.total_gp_locations). */
function universeForZips(zipScores: ZipScore[], zipList: string[]): number {
  return zipScores
    .filter((zs) => zipList.includes(zs.zip_code))
    .map((zs) => zs.total_gp_locations)
    .filter((v): v is number => v != null && !isNaN(v))
    .reduce((a, b) => a + b, 0)
}

/**
 * Census-first KPI bundle. Mirrors the server computation in page.tsx —
 * ownership from `tierToBucket(ownership_tier)` only; structural KPIs
 * (staff size, retirement age, volume) are census-scoped where they imply
 * ownership (retirement/high-vol restrict to reviewed dentist-owned tiers).
 */
function computeCensusKpis(allPractices: Practice[], universe: number): ServerKpis {
  const gpPractices = allPractices.filter(isGpRow)
  const currentYear = new Date().getFullYear()
  let large_count = 0
  let retirement_risk = 0
  let highVolCount = 0

  for (const p of gpPractices) {
    const bucket = tierToBucket(p.ownership_tier)
    const dentistOwned =
      bucket === 'true_solo_owner_operated' || bucket === 'dentist_owned_not_solo'
    if ((p.employee_count ?? 0) >= 10) large_count++
    const yr = p.year_established != null ? Number(p.year_established) : NaN
    if (dentistOwned && !isNaN(yr) && yr > 0 && yr <= currentYear - 30) retirement_risk++
    if (
      p.ownership_tier === 'true_independent' &&
      ((p.employee_count ?? 0) >= 5 || (p.estimated_revenue ?? 0) >= 800_000)
    ) {
      highVolCount++
    }
  }

  return {
    total_p: gpPractices.length,
    large_count,
    retirement_risk,
    highVolCount,
    bucketSummary: summarizeBuckets(
      gpPractices.map((p) => ({
        ownership_tier: p.ownership_tier ?? null,
        pe_backed: p.pe_backed ?? null,
      })),
      universe
    ),
  }
}

function computeZipStats(practices: Practice[]): ZipStats[] {
  const byZip: Record<string, Practice[]> = {}
  for (const p of practices) {
    const zip = (p.zip ?? '').toString().slice(0, 5)
    if (!zip) continue
    if (!byZip[zip]) byZip[zip] = []
    byZip[zip].push(p)
  }

  return Object.entries(byZip).map(([zip_code, pList]) => {
    let city = ''
    let gpTotal = 0
    const counts = {
      true_solo_owner_operated: 0,
      dentist_owned_not_solo: 0,
      dso_pe_corporate: 0,
      institutional: 0,
      unresolved: 0,
    }

    for (const p of pList) {
      if (!city && p.city) city = p.city
      if (!isGpRow(p)) continue
      gpTotal++
      counts[tierToBucket(p.ownership_tier)]++
    }

    const reviewed_count = gpTotal - counts.unresolved

    return {
      zip_code,
      city,
      total_practices: gpTotal,
      solo_owner_count: counts.true_solo_owner_operated,
      dentist_owned_count: counts.dentist_owned_not_solo,
      dso_pe_count: counts.dso_pe_corporate,
      institutional_count: counts.institutional,
      unresolved_count: counts.unresolved,
      reviewed_count,
      reviewed_pct: gpTotal > 0 ? Math.round((reviewed_count / gpTotal) * 1000) / 10 : 0,
    }
  })
}

function locationPracticeToPractice(row: ReturnType<typeof practiceLocationToLaunchpadRecord>): Practice {
  return {
    ...row,
    buyability_confidence: null,
    import_batch_id: null,
    notes: null,
    created_at: null,
    data_axle_raw_name: null,
    enumeration_date: null,
    last_updated: null,
    parent_iusa: null,
    raw_record_count: null,
    taxonomy_description: null,
  } as unknown as Practice
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

function JobMarketShellInner({
  initialZipScores,
  initialWatchedZips,
  freshness,
  adaBenchmarks,
  serverKpis,
  defaultLocationKey,
}: JobMarketShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createBrowserClient()

  // Current living location from URL or default
  const locationKeys = Object.keys(LIVING_LOCATIONS)
  const urlLocation = searchParams.get('location')
  const currentLocation = locationKeys.includes(urlLocation ?? '') ? urlLocation! : defaultLocationKey
  const loc = LIVING_LOCATIONS[currentLocation]

  // Tab state from URL
  const urlTab = searchParams.get('tab')
  const activeTab: TabId = TABS.some(t => t.id === urlTab) ? (urlTab as TabId) : 'overview'

  const handleTabChange = useCallback((tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // ── State ──────────────────────────────────────────────────────────────
  // Full practice data — loaded lazily only when a data-heavy tab is active
  const [practices, setPractices] = useState<Practice[] | null>(null)
  const defaultLoc = LIVING_LOCATIONS[defaultLocationKey]
  const [zipScores, setZipScores] = useState<ZipScore[]>(
    initialZipScores.filter(zs => defaultLoc.commutable_zips.includes(zs.zip_code))
  )
  const [loading, setLoading] = useState(false)
  // Track which location has had full data loaded
  const [loadedLocation, setLoadedLocation] = useState<string | null>(null)
  // Client-computed KPIs (used when location changes from default)
  const [clientKpis, setClientKpis] = useState<ServerKpis | null>(null)

  // Whether we're using server KPIs or need client-computed ones
  const isDefaultLocation = currentLocation === defaultLocationKey
  const activeKpis = (isDefaultLocation && !clientKpis) ? serverKpis : (clientKpis ?? serverKpis)

  // Track previous location to detect changes inside the merged effect
  const prevLocationRef = useRef<string>(currentLocation)

  // ── Fetch full practices for a location (parallel batched) ─────────
  const fetchFullPractices = useCallback(
    async (locationKey: string) => {
      const zipList = LIVING_LOCATIONS[locationKey]?.commutable_zips ?? []
      if (zipList.length === 0) return

      setLoading(true)
      try {
        const locations = await fetchPracticeLocations(supabase, {
          zips: zipList,
          gpOnly: true,
          orderBy: 'practice_name',
          ascending: true,
        })
        const allPractices = locations
          .map(practiceLocationToLaunchpadRecord)
          .map(locationPracticeToPractice)

        setPractices(allPractices)
        setLoadedLocation(locationKey)

        // Filter zip_scores for this location
        const filteredZs = initialZipScores.filter((zs) =>
          zipList.includes(zs.zip_code)
        )
        setZipScores(filteredZs)

        // Compute client-side KPIs from fetched data
        setClientKpis(computeCensusKpis(allPractices, universeForZips(initialZipScores, zipList)))
      } finally {
        setLoading(false)
      }
    },
    [supabase, initialZipScores]
  )

  // Fetch practice rows for a location and compute census-first KPIs
  const fetchKpiCounts = useCallback(async (locationKey: string) => {
    const zipList = LIVING_LOCATIONS[locationKey]?.commutable_zips ?? []
    if (zipList.length === 0) return

    try {
      const allPracticesForKpis = (await fetchPracticeLocations(supabase, { zips: zipList, gpOnly: true }))
        .map(practiceLocationToLaunchpadRecord)
        .map(locationPracticeToPractice)
      setClientKpis(computeCensusKpis(allPracticesForKpis, universeForZips(initialZipScores, zipList)))
    } catch {
      // Silently handle — KPIs will show server defaults
    }
  }, [supabase, initialZipScores])

  // ── Unified effect: handle location changes AND tab-triggered data loads ──
  // Merging two separate effects prevents a race condition where both fire in
  // the same render cycle (e.g. user clicks a new location while on the Map
  // tab), triggering two concurrent fetchFullPractices calls that can race to
  // setPractices. A single effect with a prevLocationRef gate ensures only one
  // fetch fires per transition.
  useEffect(() => {
    const locationChanged = currentLocation !== prevLocationRef.current
    prevLocationRef.current = currentLocation

    const needsFullData = FULL_DATA_TABS.includes(activeTab)

    if (locationChanged) {
      // ── Location changed — reset all derived state ──────────────────
      if (!urlLocation || urlLocation === defaultLocationKey) {
        // Reverted to (or started at) default — no fetch needed, just
        // filter zipScores from the server-provided initialZipScores.
        setPractices(null)
        setLoadedLocation(null)
        setClientKpis(null)
        setZipScores(initialZipScores.filter(zs => defaultLoc.commutable_zips.includes(zs.zip_code)))
      } else {
        // Non-default location — reset and fetch
        setPractices(null)
        setLoadedLocation(null)
        setClientKpis(null)

        const zipList = LIVING_LOCATIONS[urlLocation]?.commutable_zips ?? []
        const filteredZs = initialZipScores.filter((zs) =>
          zipList.includes(zs.zip_code)
        )
        setZipScores(filteredZs)

        if (needsFullData) {
          fetchFullPractices(urlLocation)
        } else {
          fetchKpiCounts(urlLocation)
        }
      }
    } else if (needsFullData && loadedLocation !== currentLocation) {
      // ── Tab changed to a data-heavy tab, no location change ─────────
      // Only fetch if the current location hasn't been fully loaded yet.
      fetchFullPractices(currentLocation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentLocation])

  const handleLocationChange = useCallback((newLocation: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('location', newLocation)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // ── Compute derived stats (only when full data is loaded) ───────────
  const zipStats = useMemo(
    () => practices ? computeZipStats(practices) : [],
    [practices]
  )

  // Compute scores once and reuse everywhere
  const practicesWithScore = useMemo(
    () => practices ? computeJobOpportunityScore(practices) : [],
    [practices]
  )

  // ── KPI display values ─────────────────────────────────────────────
  const kpiDisplay = useMemo(() => {
    const k = activeKpis

    // Density and buyable ratio from zip_scores (already loaded)
    const filteredZs = zipScores.filter((zs) =>
      loc.commutable_zips.includes(zs.zip_code)
    )
    const avgDld = filteredZs.length > 0
      ? filteredZs.map((z) => z.dld_gp_per_10k).filter((v): v is number => v != null && !isNaN(v))
      : []
    const avgDldVal = avgDld.length > 0
      ? (avgDld.reduce((a, b) => a + b, 0) / avgDld.length).toFixed(1)
      : null
    const bprVals = filteredZs.map((z) => z.buyable_practice_ratio).filter((v): v is number => v != null && !isNaN(v))
    const avgBpr = bprVals.length > 0
      ? (bprVals.reduce((a, b) => a + b, 0) / bprVals.length)
      : null
    const daEnrichVals = filteredZs.map((z) => z.data_axle_enrichment_pct).filter((v): v is number => v != null && !isNaN(v))
    const avgDaEnrich = daEnrichVals.length > 0
      ? daEnrichVals.reduce((a, b) => a + b, 0) / daEnrichVals.length
      : 0
    const bprConfidence = avgDaEnrich > 50 ? 3 : avgDaEnrich > 20 ? 2 : 1

    return {
      ...k,
      avgDldVal,
      avgBpr,
      bprConfidence,
    }
  }, [activeKpis, zipScores, loc.commutable_zips])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#1A1A1A]">
            Chicagoland Practice Directory
          </h1>
          <p className="text-[#6B6B60] text-sm mt-1 max-w-3xl">
            Search general-dentistry offices by location, ownership, hiring signals, and
            acquisition leads. Ownership labels come from the reviewed data; offices we have
            not reviewed yet are clearly marked.
          </p>
        </div>

        {/* Data Freshness Banner */}
        <DataFreshnessBar
          totalPractices={freshness.totalPractices}
          daEnriched={freshness.daEnriched}
          lastUpdated={freshness.lastUpdated}
        />

        {/* Living Location Selector */}
        <LivingLocationSelector
          value={currentLocation}
          onChange={handleLocationChange}
        />

        {loading && (
          <div className="flex items-center gap-2 text-[#B8860B] text-sm">
            <div className="h-4 w-4 border-2 border-[#B8860B] border-t-transparent rounded-full animate-spin" />
            Loading practices for {currentLocation}...
          </div>
        )}

        {/* ── KPIs ──────────────────────────────────────────── */}
        <section id="kpis" className="space-y-4">
          {/* The five-bucket census strip IS the ownership headline for this
              scope. The old detector KPIs ("Confirmed Corporate" etc.) were
              removed, not relabeled (user decision 2026-07-04): detector output
              is no longer presented as an ownership answer anywhere. */}
          <CensusBucketSummaryCard
            summary={activeKpis.bucketSummary}
            scopeLabel={currentLocation}
          />

          {/* First two cards are canonical headline stats (lib/census/headline-stats)
              — same labels/formulas as Home and Ownership. */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <HeadlineKpiCard
              stat={gpLocationsStat(activeKpis.bucketSummary, { gpRowCount: activeKpis.total_p })}
              icon={<Hospital className="h-5 w-5" />}
            />
            <HeadlineKpiCard
              stat={handReviewedStat(activeKpis.bucketSummary)}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <KpiCard
              icon={<Users className="h-5 w-5" />}
              label="10+ Staff"
              value={kpiDisplay.large_count.toLocaleString()}
            />
            <KpiCard
              icon={<Clock className="h-5 w-5" />}
              label="Retirement Risk"
              value={kpiDisplay.retirement_risk.toLocaleString()}
              accentColor="#C23B3B"
              tooltip="Census dentist-owned clinics (T1–T3) established 30+ years ago. Offices we have not reviewed are never counted here — they stay in the Not Reviewed Yet group."
            />
          </div>

          {/* Row 2: 3 KPIs with captions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <KpiCard
                icon={<MapPin className="h-5 w-5" />}
                label="Dentist Office Density"
                value={kpiDisplay.avgDldVal ? `${kpiDisplay.avgDldVal} / 10k people` : '--'}
              />
              <p className="text-xs text-[#6B6B60] mt-1 px-1">
                General-dentistry offices per 10,000 residents. Around 6 is average; lower
                means less local competition, higher means a crowded market.
              </p>
            </div>
            <div>
              <KpiCard
                icon={<Store className="h-5 w-5" />}
                label="Acquisition Lead Filter"
                value={
                  kpiDisplay.avgBpr != null
                    ? `${(kpiDisplay.avgBpr * 100).toFixed(0)}%`
                    : '--'
                }
                suffix={
                  kpiDisplay.avgBpr != null
                    ? Array.from({ length: kpiDisplay.bprConfidence })
                        .map(() => '\u2605')
                        .join('')
                    : undefined
                }
              />
              <p className="text-xs text-[#6B6B60] mt-1 px-1">
                Early screening estimate for offices that may be worth acquisition research.
                It is not a final recommendation.
              </p>
            </div>
            <div>
              <KpiCard
                icon={<Zap className="h-5 w-5" />}
                label="Busy Independents"
                value={kpiDisplay.highVolCount.toLocaleString()}
              />
              <p className="text-xs text-[#6B6B60] mt-1 px-1">
                Reviewed true independent offices with larger staff or revenue. These may be
                better associate targets than tiny solo offices.
              </p>
            </div>
          </div>

        </section>

        {/* ── Tab Navigation ────────────────────────────────── */}
        <div className="border-b border-[#E8E5DE]">
          <nav className="flex gap-0" aria-label="Practice Directory tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-[#B8860B] border-b-2 border-[#B8860B]'
                    : 'text-[#6B6B60] hover:text-[#1A1A1A] border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content ───────────────────────────────────── */}

        {/* Overview Tab -- uses zipScores (already loaded), no full practice data required */}
        {activeTab === 'overview' && (
          <div key="overview" className="space-y-6">
            <SaturationTable
              zipScores={zipScores}
              watchedZips={initialWatchedZips}
            />
            <SaturationMap
              zipScores={zipScores}
              watchedZips={initialWatchedZips}
              centerLat={loc.center_lat}
              centerLon={loc.center_lon}
            />
            {adaBenchmarks && adaBenchmarks.length > 0 && (
              <ADABenchmarks data={adaBenchmarks} />
            )}
            {practices ? (
              <OpportunitySignals
                practices={practicesWithScore}
                zipList={loc.commutable_zips}
              />
            ) : (
              <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center">
                <button
                  onClick={() => fetchFullPractices(currentLocation)}
                  disabled={loading}
                  className="text-sm text-[#B8860B] hover:text-[#D4920B] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load practice data to see Opportunity Signals'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          <div key="map">
            {practices ? (
              <PracticeDensityMap
                practices={practices}
                centerLat={loc.center_lat}
                centerLon={loc.center_lon}
              />
            ) : (
              <div className="h-[500px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">
                Loading practice data...
              </div>
            )}
          </div>
        )}

        {/* Directory Tab */}
        {activeTab === 'directory' && (
          <div key="directory">
            {practices ? (
              <PracticeDirectory
                practices={practicesWithScore}
                allPractices={practicesWithScore}
              />
            ) : (
              <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">
                Loading practice data...
              </div>
            )}
          </div>
        )}

        {/* Consolidated Tree Tab */}
        {activeTab === 'tree' && (
          <div key="tree">
            {practices ? (
              <ConsolidatedPracticeTree practices={practicesWithScore} />
            ) : (
              <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">
                Loading practice data...
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div key="analytics" className="space-y-6">
            {practices ? (
              <>
                <MarketOverviewCharts
                  practices={practices}
                  zipStats={zipStats}
                />
                <OwnershipLandscape
                  practices={practices}
                  zipStats={zipStats}
                />
                <MarketAnalytics
                  practices={practices}
                  zipStats={zipStats}
                />
              </>
            ) : (
              <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">
                Loading practice data...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function JobMarketShell(props: JobMarketShellProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF7]">
          <div className="px-6 py-6 space-y-6">
            <h1 className="font-sans font-bold text-2xl text-[#1A1A1A]">
              Chicagoland Practice Directory
            </h1>
            <p className="text-[#6B6B60] text-sm mt-1">Loading...</p>
          </div>
        </div>
      }
    >
      <JobMarketShellInner {...props} />
    </Suspense>
  )
}
