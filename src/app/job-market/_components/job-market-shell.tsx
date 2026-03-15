'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { StickySectionNav } from '@/components/layout/sticky-section-nav'
import { KpiCard } from '@/components/data-display/kpi-card'
import { DataFreshnessBar } from '@/components/data-display/data-freshness-bar'
import { LivingLocationSelector } from './living-location-selector'
import { PracticeDensityMap } from './practice-density-map'
import { MarketOverviewCharts } from './market-overview-charts'
import { PracticeDirectory } from './practice-directory'
import { OpportunitySignals } from './opportunity-signals'
import { OwnershipLandscape } from './ownership-landscape'
import { MarketAnalytics } from './market-analytics'
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import { isIndependentClassification, isCorporateClassification, classifyPractice } from '@/lib/constants/entity-classifications'
import { computeJobOpportunityScore } from '@/lib/utils/scoring'
import { createBrowserClient } from '@/lib/supabase/client'
import { Hospital, CircleCheck, BarChart3, Target, Users, Clock, MapPin, Store, Zap } from 'lucide-react'

import type { Practice, ZipScore, WatchedZip } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface JobMarketShellProps {
  initialZipScores: ZipScore[]
  initialWatchedZips: WatchedZip[]
  initialPractices: Practice[]
  freshness: {
    totalPractices: number
    daEnriched: number
    lastUpdated: string | null
  }
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
// Section anchors
// ────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'map', label: 'Map' },
  { id: 'overview', label: 'Overview' },
  { id: 'directory', label: 'Directory' },
  { id: 'signals', label: 'Signals' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'analytics', label: 'Analytics' },
]

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function cleanStatus(status: string | null | undefined): string {
  return (status ?? 'unknown').trim().toLowerCase()
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
    const total_practices = pList.length
    let independent_count = 0
    let dso_affiliated_count = 0
    let pe_backed_count = 0
    let unknown_count = 0
    let city = ''

    for (const p of pList) {
      if (!city && p.city) city = p.city
      const category = classifyPractice(p.entity_classification, p.ownership_status)
      if (category === 'corporate') {
        dso_affiliated_count++
      } else if (category === 'independent' || category === 'specialist' || category === 'non_clinical') {
        independent_count++
      } else {
        unknown_count++
      }
    }

    const consolidated_count = dso_affiliated_count + pe_backed_count
    const consolidation_pct_of_total =
      total_practices > 0
        ? Math.round((consolidated_count / total_practices) * 1000) / 10
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

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function JobMarketShell({
  initialZipScores,
  initialWatchedZips,
  initialPractices,
  freshness,
}: JobMarketShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createBrowserClient()

  // Current living location from URL or default
  const locationKeys = Object.keys(LIVING_LOCATIONS)
  const urlLocation = searchParams.get('location')
  const currentLocation = locationKeys.includes(urlLocation ?? '') ? urlLocation! : locationKeys[0]
  const loc = LIVING_LOCATIONS[currentLocation]

  const [practices, setPractices] = useState<Practice[]>(initialPractices)
  const [zipScores, setZipScores] = useState<ZipScore[]>(initialZipScores)
  const [loading, setLoading] = useState(false)

  // ── Re-fetch practices when location changes ──────────────────────────
  const fetchPracticesForLocation = useCallback(
    async (locationKey: string) => {
      const zipList = LIVING_LOCATIONS[locationKey]?.commutable_zips ?? []
      if (zipList.length === 0) return

      setLoading(true)
      try {
        const allPractices: Practice[] = []
        const pageSize = 1000

        // Paginate to get ALL practices (Supabase max 1000 rows per query)
        let offset = 0
        let hasMore = true
        while (hasMore) {
          const { data } = await supabase
            .from('practices')
            .select('*')
            .in('zip', zipList)
            .order('practice_name', { ascending: true })
            .range(offset, offset + pageSize - 1)
          if (data && data.length > 0) {
            allPractices.push(...(data as Practice[]))
            offset += data.length
            hasMore = data.length === pageSize
          } else {
            hasMore = false
          }
        }

        setPractices(allPractices)

        // Also filter zip_scores
        const filteredZs = initialZipScores.filter((zs) =>
          zipList.includes(zs.zip_code)
        )
        setZipScores(filteredZs)
      } finally {
        setLoading(false)
      }
    },
    [supabase, initialZipScores]
  )

  // Load data when URL location changes (but skip initial since server already fetched)
  useEffect(() => {
    if (urlLocation && urlLocation !== locationKeys[0]) {
      fetchPracticesForLocation(urlLocation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLocation])

  const handleLocationChange = (newLocation: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('location', newLocation)
    router.push(`?${params.toString()}`, { scroll: false })
    fetchPracticesForLocation(newLocation)
  }

  // ── Compute derived stats ─────────────────────────────────────────────
  const zipStats = useMemo(() => computeZipStats(practices), [practices])

  const practicesWithScore = useMemo(
    () => computeJobOpportunityScore(practices),
    [practices]
  )

  const kpis = useMemo(() => {
    const filteredZs = zipScores.filter((zs) =>
      loc.commutable_zips.includes(zs.zip_code)
    )

    // Always compute ownership counts from practices using entity_classification
    const total_p = practices.length
    let indep_cnt = 0
    let pe_cnt = 0
    let dso_cnt = 0
    let unk_cnt = 0

    for (const p of practices) {
      const category = classifyPractice(p.entity_classification, p.ownership_status)
      if (category === 'corporate') {
        dso_cnt++
      } else if (category === 'independent' || category === 'specialist' || category === 'non_clinical') {
        indep_cnt++
      } else {
        unk_cnt++
      }
    }

    const unk_pct = total_p > 0 ? (unk_cnt / total_p) * 100 : 100
    const indep_pct = total_p > 0 ? ((indep_cnt / total_p) * 100).toFixed(1) + '%' : '--'
    const consol_pct =
      total_p > 0 ? (((pe_cnt + dso_cnt) / total_p) * 100).toFixed(1) + '%' : '--'

    // Avg buyability
    const buyScores = practices
      .map((p) => (p.buyability_score != null ? Number(p.buyability_score) : NaN))
      .filter((v) => !isNaN(v))
    const avg_buy = buyScores.length > 0
      ? (buyScores.reduce((a, b) => a + b, 0) / buyScores.length).toFixed(1)
      : '--'

    // Large staff count
    const large_count = practices.filter(
      (p) => p.employee_count != null && Number(p.employee_count) >= 10
    ).length

    // Retirement risk
    const currentYear = new Date().getFullYear()
    const retirement_risk = practices.filter((p) => {
      const yr = p.year_established != null ? Number(p.year_established) : NaN
      const isIndep = isIndependentClassification(p.entity_classification) ||
        (!p.entity_classification && ['independent', 'likely_independent'].includes(cleanStatus(p.ownership_status)))
      return !isNaN(yr) && yr <= currentYear - 30 && isIndep
    }).length

    // Density
    const avgDld =
      filteredZs.length > 0
        ? filteredZs
            .map((z) => z.dld_gp_per_10k)
            .filter((v): v is number => v != null && !isNaN(v))
        : []
    const avgDldVal =
      avgDld.length > 0
        ? (avgDld.reduce((a, b) => a + b, 0) / avgDld.length).toFixed(1)
        : null

    // Buyable practice ratio
    const bprVals = filteredZs
      .map((z) => z.buyable_practice_ratio)
      .filter((v): v is number => v != null && !isNaN(v))
    const avgBpr = bprVals.length > 0
      ? (bprVals.reduce((a, b) => a + b, 0) / bprVals.length)
      : null

    // Data Axle enrichment for confidence
    const daEnrichVals = filteredZs
      .map((z) => z.data_axle_enrichment_pct)
      .filter((v): v is number => v != null && !isNaN(v))
    const avgDaEnrich = daEnrichVals.length > 0
      ? daEnrichVals.reduce((a, b) => a + b, 0) / daEnrichVals.length
      : 0
    const bprConfidence = avgDaEnrich > 50 ? 3 : avgDaEnrich > 20 ? 2 : 1

    // High-volume solos
    const highVolCount = practices.filter(
      (p) => p.entity_classification === 'solo_high_volume'
    ).length

    return {
      total_p,
      indep_cnt,
      pe_cnt,
      dso_cnt,
      unk_cnt,
      unk_pct,
      indep_pct,
      consol_pct,
      avg_buy,
      large_count,
      retirement_risk,
      avgDldVal,
      avgBpr,
      bprConfidence,
      highVolCount,
    }
  }, [practices, zipScores, loc.commutable_zips])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      <StickySectionNav sections={SECTIONS} />

      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#F8FAFC]">
            Job Market Intelligence
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1 max-w-3xl">
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
          <div className="flex items-center gap-2 text-[#7eb8e0] text-sm">
            <div className="h-4 w-4 border-2 border-[#7eb8e0] border-t-transparent rounded-full animate-spin" />
            Loading practices for {currentLocation}...
          </div>
        )}

        {practices.length === 0 && !loading ? (
          <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
            No practices found for this zone.
          </div>
        ) : (
          <>
            {/* ── KPIs ──────────────────────────────────────────── */}
            <section id="kpis">
              {/* Row 1: 6 KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard
                  icon={<Hospital className="h-5 w-5" />}
                  label="Total Practices"
                  value={kpis.total_p.toLocaleString()}
                />
                <KpiCard
                  icon={<CircleCheck className="h-5 w-5" />}
                  label="Independent %"
                  value={kpis.indep_pct}
                  accentColor="#22C55E"
                />
                <KpiCard
                  icon={<BarChart3 className="h-5 w-5" />}
                  label="Known Consolidated %"
                  value={kpis.consol_pct}
                  accentColor="#EF4444"
                />
                <KpiCard
                  icon={<Target className="h-5 w-5" />}
                  label="Avg Buyability"
                  value={kpis.avg_buy}
                />
                <KpiCard
                  icon={<Users className="h-5 w-5" />}
                  label="10+ Staff"
                  value={kpis.large_count.toLocaleString()}
                />
                <KpiCard
                  icon={<Clock className="h-5 w-5" />}
                  label="Retirement Risk"
                  value={kpis.retirement_risk.toLocaleString()}
                  accentColor="#EF4444"
                />
              </div>

              {/* Row 2: 3 KPIs with captions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <KpiCard
                    icon={<MapPin className="h-5 w-5" />}
                    label="Avg Dental Density"
                    value={kpis.avgDldVal ? `${kpis.avgDldVal}/10k` : '--'}
                  />
                  <p className="text-xs text-[#94A3B8] mt-1 px-1">
                    GP offices per 10k residents. National avg ~6.1. Lower = less competition.
                  </p>
                </div>
                <div>
                  <KpiCard
                    icon={<Store className="h-5 w-5" />}
                    label="Buyable Practice %"
                    value={
                      kpis.avgBpr != null
                        ? `${(kpis.avgBpr * 100).toFixed(0)}%`
                        : '--'
                    }
                    suffix={
                      kpis.avgBpr != null
                        ? Array.from({ length: kpis.bprConfidence })
                            .map(() => '\u2605')
                            .join('')
                        : undefined
                    }
                  />
                  <p className="text-xs text-[#94A3B8] mt-1 px-1">
                    % of GP offices that are independently owned solos -- potential acquisition targets.
                  </p>
                </div>
                <div>
                  <KpiCard
                    icon={<Zap className="h-5 w-5" />}
                    label="High-Volume Solos"
                    value={kpis.highVolCount.toLocaleString()}
                  />
                  <p className="text-xs text-[#94A3B8] mt-1 px-1">
                    Solo practices with 5+ employees or $800k+ revenue. Likely need associate help.
                  </p>
                </div>
              </div>

              {/* Unknown ownership warning */}
              {kpis.unk_pct > 30 && (
                <p className="text-xs text-[#F59E0B] mt-3 flex items-start gap-1">
                  <span className="shrink-0">Warning:</span>
                  <span>
                    {kpis.unk_pct.toFixed(0)}% of practices have unknown ownership (
                    {kpis.unk_cnt.toLocaleString()} / {kpis.total_p.toLocaleString()}).
                    Known independent: {kpis.indep_cnt.toLocaleString()}. Real independent count is
                    likely higher. Add Data Axle exports to improve classification.
                  </span>
                </p>
              )}
            </section>

            {/* ── Practice Density Map ──────────────────────────── */}
            <section id="map">
              <PracticeDensityMap
                practices={practices}
                centerLat={loc.center_lat}
                centerLon={loc.center_lon}
              />
            </section>

            {/* ── Market Overview ───────────────────────────────── */}
            <section id="overview">
              <MarketOverviewCharts
                practices={practices}
                zipStats={zipStats}
                kpis={{
                  indep_cnt: kpis.indep_cnt,
                  dso_cnt: kpis.dso_cnt,
                  pe_cnt: kpis.pe_cnt,
                  unk_cnt: kpis.unk_cnt,
                }}
              />
            </section>

            {/* ── Practice Directory ───────────────────────────── */}
            <section id="directory">
              <PracticeDirectory
                practices={practicesWithScore}
                allPractices={practices}
              />
            </section>

            {/* ── Opportunity Signals ──────────────────────────── */}
            <section id="signals">
              <OpportunitySignals
                practices={practicesWithScore}
                zipList={loc.commutable_zips}
              />
            </section>

            {/* ── Ownership Landscape ──────────────────────────── */}
            <section id="ownership">
              <OwnershipLandscape
                practices={practices}
                zipStats={zipStats}
                zipScores={zipScores}
              />
            </section>

            {/* ── Market Analytics ─────────────────────────────── */}
            <section id="analytics">
              <MarketAnalytics
                practices={practices}
                zipStats={zipStats}
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
