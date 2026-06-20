'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { KpiCard } from '@/components/data-display/kpi-card'
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
import { isIndependentClassification, isCorporateClassification, classifyPractice, DSO_FILTER_KEYWORDS } from '@/lib/constants/entity-classifications'
import { getCorporateBand, corporateBandTooltip, corporateBandSubtitle } from '@/lib/constants/consolidation-honesty'
import { computeJobOpportunityScore } from '@/lib/utils/scoring'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  fetchPracticeLocations,
  practiceLocationToLaunchpadRecord,
} from '@/lib/supabase/queries/practice-locations'
import { Hospital, CircleCheck, BarChart3, Target, Users, Clock, MapPin, Store, Zap } from 'lucide-react'

import type { Practice, ZipScore, WatchedZip } from '@/lib/types'
import type { ADABenchmark } from '@/lib/supabase/queries/ada-benchmarks'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ServerKpis {
  total_p: number
  indep_cnt: number
  dso_cnt: number
  pe_cnt: number
  unk_cnt: number
  highConfCorporate: number
  allSignalsCorporate: number
  large_count: number
  retirement_risk: number
  highVolCount: number
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

export interface ZipStats {
  zip_code: string
  city: string
  total_practices: number
  independent_count: number
  dso_affiliated_count: number
  pe_backed_count: number
  unknown_count: number
  consolidated_count: number
  consolidation_pct_of_total: number
}

// ────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'map', label: 'Map' },
  { id: 'directory', label: 'Directory' },
  { id: 'analytics', label: 'Analytics' },
] as const

type TabId = (typeof TABS)[number]['id']

// Tabs that require the full practice dataset
const FULL_DATA_TABS: TabId[] = ['map', 'directory', 'analytics']

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function computeZipStats(practices: Practice[]): ZipStats[] {
  const byZip: Record<string, Practice[]> = {}
  for (const p of practices) {
    const zip = (p.zip ?? '').toString().slice(0, 5)
    if (!zip) continue
    if (!byZip[zip]) byZip[zip] = []
    byZip[zip].push(p)
  }

  return Object.entries(byZip).map(([zip_code, pList]) => {
    const total_practices = pList.length
    let independent_count = 0
    let dso_affiliated_count = 0
    const pe_backed_count = 0
    let unknown_count = 0
    let non_gp_count = 0 // specialist + non_clinical + org_only + da_unverified + duplicate_location — outside the GP denominator
    let city = ''

    for (const p of pList) {
      if (!city && p.city) city = p.city
      const ec = (p.entity_classification ?? '').trim().toLowerCase()
      if (ec === 'specialist' || ec === 'non_clinical' || ec === 'org_only_npi' || ec === 'da_unverified' || ec === 'duplicate_location') {
        non_gp_count++
      }
      const category = classifyPractice(p.entity_classification, p.ownership_status)
      if (category === 'corporate') {
        dso_affiliated_count++
      } else if (category === 'independent') {
        independent_count++
      } else {
        unknown_count++
      }
    }

    const consolidated_count = dso_affiliated_count + pe_backed_count
    // Consolidation share uses the GP-clinic denominator (excludes specialists /
    // non-clinical), matching the canonical corporate_location_count /
    // total_gp_locations definition used by every headline KPI. Using all
    // practices here would understate each ZIP's share vs the page headline.
    const gp_count = Math.max(0, total_practices - non_gp_count)
    const consolidation_pct_of_total =
      gp_count > 0
        ? Math.round((consolidated_count / gp_count) * 1000) / 10
        : 0

    return {
      zip_code,
      city,
      total_practices,
      independent_count,
      dso_affiliated_count,
      pe_backed_count,
      unknown_count,
      consolidated_count,
      consolidation_pct_of_total,
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
        computeClientKpis(allPractices)
      } finally {
        setLoading(false)
      }
    },
    [supabase, initialZipScores]
  )

  // Compute KPIs client-side from full practice data (GP-scoped to match server)
  const computeClientKpis = useCallback((allPractices: Practice[]) => {
    const gpPractices = allPractices.filter((p) => {
      const ec = (p.entity_classification ?? '').toLowerCase()
      return ec !== 'specialist' && ec !== 'non_clinical' && ec !== 'org_only_npi' && ec !== 'da_unverified' && ec !== 'duplicate_location'
    })
    const total_p = gpPractices.length
    let indep_cnt = 0
    let dso_cnt = 0
    const pe_cnt = 0
    let unk_cnt = 0
    let dsoNationalReal = 0
    let dsoRegionalStrong = 0
    let highVolCount = 0
    let large_count = 0
    let retirement_risk = 0
    const currentYear = new Date().getFullYear()

    for (const p of gpPractices) {
      const category = classifyPractice(p.entity_classification, p.ownership_status)
      if (category === 'corporate') dso_cnt++
      else if (category === 'independent') indep_cnt++
      else unk_cnt++

      const ec = (p.entity_classification ?? '').trim().toLowerCase()
      if (ec === 'dso_national') {
        const dso = (p.affiliated_dso ?? '').trim()
        const isTaxonomyLeak = dso && DSO_FILTER_KEYWORDS.some(kw => dso.toLowerCase().includes(kw))
        if (!isTaxonomyLeak) dsoNationalReal++
      } else if (ec === 'dso_regional') {
        const reasoning = (p.classification_reasoning ?? '').toLowerCase()
        if (reasoning.includes('ein=') || reasoning.includes('generic brand') ||
            reasoning.includes('parent_company') || reasoning.includes('franchise') ||
            reasoning.includes('branch')) {
          dsoRegionalStrong++
        }
      }

      if (ec === 'solo_high_volume') highVolCount++
      if (p.employee_count != null && Number(p.employee_count) >= 10) large_count++

      const yr = p.year_established != null ? Number(p.year_established) : NaN
      const isIndep = isIndependentClassification(p.entity_classification)
      if (!isNaN(yr) && yr < currentYear - 30 && isIndep) retirement_risk++
    }

    setClientKpis({
      total_p,
      indep_cnt,
      dso_cnt,
      pe_cnt,
      unk_cnt,
      highConfCorporate: dsoNationalReal + dsoRegionalStrong,
      allSignalsCorporate: dso_cnt + pe_cnt,
      large_count,
      retirement_risk,
      highVolCount,
    })
  }, [])

  // Fetch lightweight KPI counts for a location (no row data, just counts)
  const fetchKpiCounts = useCallback(async (locationKey: string) => {
    const zipList = LIVING_LOCATIONS[locationKey]?.commutable_zips ?? []
    if (zipList.length === 0) return

    try {
      const allPracticesForKpis = (await fetchPracticeLocations(supabase, { zips: zipList, gpOnly: true }))
        .map(practiceLocationToLaunchpadRecord)
        .map(locationPracticeToPractice)
      const practicesForKpis = allPracticesForKpis.filter((p) => {
        const ec = (p.entity_classification ?? '').toLowerCase()
        return ec !== 'specialist' && ec !== 'non_clinical' && ec !== 'org_only_npi' && ec !== 'da_unverified' && ec !== 'duplicate_location'
      })
      const corporate = practicesForKpis.filter((p) => isCorporateClassification(p.entity_classification)).length
      const total_p = practicesForKpis.length
      const indep_cnt = practicesForKpis.filter((p) => isIndependentClassification(p.entity_classification)).length
      const largeStaffCount = practicesForKpis.filter((p) => (p.employee_count ?? 0) >= 10).length
      const currentYear = new Date().getFullYear()
      const retireCount = practicesForKpis.filter((p) =>
        isIndependentClassification(p.entity_classification) &&
        p.year_established != null &&
        p.year_established < currentYear - 30
      ).length
      const hvCount = practicesForKpis.filter((p) => p.entity_classification === 'solo_high_volume').length

      // Compute highConfCorporate from the canonical GP-only directory set.
      let dsoNationalReal = 0
      let dsoRegionalStrong = 0
      for (const p of practicesForKpis) {
        const ec = (p.entity_classification ?? '').trim().toLowerCase()
        if (ec === 'dso_national') {
          const dso = (p.affiliated_dso ?? '').trim()
          const isTaxonomyLeak = dso && DSO_FILTER_KEYWORDS.some(kw => dso.toLowerCase().includes(kw))
          if (!isTaxonomyLeak) dsoNationalReal++
        } else if (ec === 'dso_regional') {
          const reasoning = (p.classification_reasoning ?? '').toLowerCase()
          if (reasoning.includes('ein=') || reasoning.includes('generic brand') ||
              reasoning.includes('parent_company') || reasoning.includes('franchise') ||
              reasoning.includes('branch')) {
            dsoRegionalStrong++
          }
        }
      }

      setClientKpis({
        total_p,
        indep_cnt,
        dso_cnt: corporate,
        pe_cnt: 0,
        unk_cnt: Math.max(0, total_p - corporate - indep_cnt),
        highConfCorporate: dsoNationalReal + dsoRegionalStrong,
        allSignalsCorporate: corporate,
        large_count: largeStaffCount,
        retirement_risk: retireCount,
        highVolCount: hvCount,
      })
    } catch {
      // Silently handle — KPIs will show server defaults
    }
  }, [supabase])

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
    const total_p = k.total_p
    const unk_pct = total_p > 0 ? (k.unk_cnt / total_p) * 100 : 100
    const indep_pct = total_p > 0 ? ((k.indep_cnt / total_p) * 100).toFixed(1) + '%' : '--'
    const highConf_pct = total_p > 0 ? ((k.highConfCorporate / total_p) * 100).toFixed(1) + '%' : '--'
    const allSignals_pct = total_p > 0 ? ((k.allSignalsCorporate / total_p) * 100).toFixed(1) + '%' : '--'

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
    // Location-deduped clinic count (sum of total_gp_locations across active ZIPs).
    // Collapses NPI-1 + NPI-2 + suite-variant rows at the same physical building
    // to one clinic — the honest "how many clinics" denominator.
    const gpLocations = filteredZs
      .map((z) => z.total_gp_locations)
      .filter((v): v is number => v != null && !isNaN(v))
      .reduce((a, b) => a + b, 0)

    // Avg buyability — only available when full data is loaded
    let avg_buy = '--'
    if (practices) {
      const buyScores = practices
        .map((p) => (p.buyability_score != null ? Number(p.buyability_score) : NaN))
        .filter((v) => !isNaN(v))
      avg_buy = buyScores.length > 0
        ? (buyScores.reduce((a, b) => a + b, 0) / buyScores.length).toFixed(1)
        : '--'
    }

    return {
      ...k,
      unk_pct,
      indep_pct,
      highConf_pct,
      allSignals_pct,
      avg_buy,
      avgDldVal,
      avgBpr,
      bprConfidence,
      gpLocations,
    }
  }, [activeKpis, zipScores, loc.commutable_zips, practices])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#1A1A1A]">
            Job Market Intelligence
          </h1>
          <p className="text-[#6B6B60] text-sm mt-1 max-w-3xl">
            Evaluate dental practice landscapes near your planned living locations --
            where are independent practices, and where is consolidation squeezing out opportunity?
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
        <section id="kpis">
          {/* Row 1: 6 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              icon={<Hospital className="h-5 w-5" />}
              label="Tracked Clinics"
              value={
                kpiDisplay.gpLocations > 0
                  ? kpiDisplay.gpLocations.toLocaleString()
                  : kpiDisplay.total_p.toLocaleString()
              }
              subtitle={
                kpiDisplay.gpLocations > 0 ? (
                  <span className="text-xs text-[#6B6B60]">
                    {kpiDisplay.total_p.toLocaleString()} GP location records
                  </span>
                ) : undefined
              }
              tooltip="Headline = GP clinic locations in this living location (zip_scores.total_gp_locations — address-deduped, residential- and unverified-record-filtered). Subtitle = raw GP-class rows in practice_locations for the same scope; the small delta is residential-flagged addresses that the scored denominator drops."
            />
            <KpiCard
              icon={<CircleCheck className="h-5 w-5" />}
              label="Independent %"
              value={kpiDisplay.indep_pct}
              accentColor="#2D8B4E"
            />
            <KpiCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Confirmed Corporate"
              value={kpiDisplay.allSignals_pct}
              accentColor="#C23B3B"
              tooltip={corporateBandTooltip(
                getCorporateBand(parseFloat(kpiDisplay.allSignals_pct) || 0, 'mixed')
              )}
              subtitle={
                <div className="space-y-1">
                  <p className="text-[9px] text-[#707064] leading-tight">
                    {corporateBandSubtitle(
                      getCorporateBand(parseFloat(kpiDisplay.allSignals_pct) || 0, 'mixed')
                    )}
                  </p>
                </div>
              }
            />
            <KpiCard
              icon={<Target className="h-5 w-5" />}
              label="Avg Buyability"
              value={kpiDisplay.avg_buy}
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
            />
          </div>

          {/* Row 2: 3 KPIs with captions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <KpiCard
                icon={<MapPin className="h-5 w-5" />}
                label="Avg Dental Density"
                value={kpiDisplay.avgDldVal ? `${kpiDisplay.avgDldVal}/10k` : '--'}
              />
              <p className="text-xs text-[#6B6B60] mt-1 px-1">
                GP offices per 10k residents. National avg ~6.1. Lower = less competition.
              </p>
            </div>
            <div>
              <KpiCard
                icon={<Store className="h-5 w-5" />}
                label="Buyable Practice %"
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
                % of GP offices that are independently owned solos -- potential acquisition targets.
              </p>
            </div>
            <div>
              <KpiCard
                icon={<Zap className="h-5 w-5" />}
                label="High-Volume Solos"
                value={kpiDisplay.highVolCount.toLocaleString()}
              />
              <p className="text-xs text-[#6B6B60] mt-1 px-1">
                Solo practices with 5+ employees or $800k+ revenue. Likely need associate help.
              </p>
            </div>
          </div>

          {/* Unknown ownership warning */}
          {kpiDisplay.unk_pct > 30 && kpiDisplay.total_p > 0 && (
            <p className="text-xs text-[#D4920B] mt-3 flex items-start gap-1">
              <span className="shrink-0">Warning:</span>
              <span>
                {kpiDisplay.unk_pct.toFixed(0)}% of practices have unknown ownership (
                {kpiDisplay.unk_cnt.toLocaleString()} / {kpiDisplay.total_p.toLocaleString()}).
                Known independent: {kpiDisplay.indep_cnt.toLocaleString()}. Real independent count is
                likely higher. Add Data Axle exports to improve classification.
              </span>
            </p>
          )}
        </section>

        {/* ── Tab Navigation ────────────────────────────────── */}
        <div className="border-b border-[#E8E5DE]">
          <nav className="flex gap-0" aria-label="Job Market tabs">
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

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div key="analytics" className="space-y-6">
            {practices ? (
              <>
                <MarketOverviewCharts
                  practices={practices}
                  zipStats={zipStats}
                  kpis={{
                    indep_cnt: activeKpis.indep_cnt,
                    dso_cnt: activeKpis.dso_cnt,
                    pe_cnt: activeKpis.pe_cnt,
                    unk_cnt: activeKpis.unk_cnt,
                  }}
                />
                <OwnershipLandscape
                  practices={practices}
                  zipStats={zipStats}
                  zipScores={zipScores}
                  watchedZips={initialWatchedZips}
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
              Job Market Intelligence
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
