'use client'

import { useState, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { KpiCard } from '@/components/data-display/kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import { formatPct, formatNumber } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils/formatting'
import {
  ENTITY_CLASSIFICATIONS,
  getEntityClassificationLabel,
} from '@/lib/constants/entity-classifications'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'
import { WarroomCrossLink } from '@/components/layout/warroom-cross-link'
import { DSOPenetrationTable } from './dso-penetration-table'
import { CorporateBandBar } from '@/components/data-display/corporate-band-bar'
import {
  getCorporateBand,
  corporateBandTooltip,
  corporateBandSubtitle,
} from '@/lib/constants/consolidation-honesty'

// Lazy-load heavy components (maps, large tables with sub-queries)
const ConsolidationMap = dynamic(() => import('./consolidation-map').then(m => ({ default: m.ConsolidationMap })), {
  loading: () => <div className="h-[400px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">Loading map...</div>,
  ssr: false,
})
const ZipScoreTable = dynamic(() => import('./zip-score-table').then(m => ({ default: m.ZipScoreTable })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const CityPracticeTree = dynamic(() => import('./city-practice-tree').then(m => ({ default: m.CityPracticeTree })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})

interface MarketIntelShellProps {
  initialZipScores: ZipScore[]
  initialWatchedZips: WatchedZip[]
  metroAreas: string[]
  adaBenchmarks: unknown[]
  freshness: {
    totalPractices: number
    daEnriched: number
    lastUpdated: string | null
  }
  classificationCounts: {
    total: number
    corporate: number
    corporateHighConf: number
    independent: number
    unknown: number
  }
  entityCounts: Record<string, number>
}

const TABS = [
  { id: 'consolidation', label: 'Consolidation' },
  { id: 'zip-analysis', label: 'ZIP Analysis' },
  { id: 'ownership', label: 'Ownership' },
] as const

type TabId = (typeof TABS)[number]['id']
const ALL_CHICAGO_SCOPE = 'Chicagoland'

function MarketIntelShellInner({
  initialZipScores,
  initialWatchedZips,
  metroAreas,
  freshness,
  classificationCounts,
  entityCounts,
}: MarketIntelShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = (searchParams.get('tab') ?? 'consolidation') as TabId
  const setActiveTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'consolidation') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const newSearch = params.toString()
    const url = newSearch ? `${pathname}?${newSearch}` : pathname
    router.push(url, { scroll: false })
  }

  const [selectedMetro, setSelectedMetro] = useState<string>(ALL_CHICAGO_SCOPE)
  const allMetros = useMemo(
    () => [ALL_CHICAGO_SCOPE, ...metroAreas.filter((m) => m !== ALL_CHICAGO_SCOPE)],
    [metroAreas]
  )

  // Filter zip scores and watched zips by selected metro
  const zipScores = useMemo(() => {
    if (selectedMetro === ALL_CHICAGO_SCOPE) return initialZipScores
    return initialZipScores.filter(z => z.metro_area === selectedMetro)
  }, [initialZipScores, selectedMetro])

  const watchedZips = useMemo(() => {
    if (selectedMetro === ALL_CHICAGO_SCOPE) return initialWatchedZips
    return initialWatchedZips.filter(z => z.metro_area === selectedMetro)
  }, [initialWatchedZips, selectedMetro])

  const zipList = useMemo(() => watchedZips.map(z => z.zip_code), [watchedZips])

  // Compute KPI values
  const kpis = useMemo(() => {
    // Location-deduped clinic count (sum of total_gp_locations across active ZIPs).
    // Collapses NPI-1 + NPI-2 + suite-variant rows at the same physical building.
    const totalGpLocations = zipScores
      .map((z) => z.total_gp_locations)
      .filter((v): v is number => v != null && !isNaN(v))
      .reduce((a, b) => a + b, 0)

    if (selectedMetro === ALL_CHICAGO_SCOPE) {
      const { total, corporate, corporateHighConf, independent } = classificationCounts
      if (total === 0) return null
      const gpDenom = totalGpLocations > 0 ? totalGpLocations : total
      const unknownCount = Math.max(0, gpDenom - corporate - independent)
      const highConfPct = (corporateHighConf / gpDenom) * 100
      const allSignalsPct = (corporate / gpDenom) * 100
      return {
        totalP: total,
        totalGpLocations,
        gpDenom,
        unknownCount,
        corporateHighConf,
        corporateAll: corporate,
        indepCount: independent,
        highConfPct,
        allSignalsPct,
        indepPct: (independent / gpDenom) * 100,
      }
    }

    if (zipScores.length === 0) return null
    const totalP = totalGpLocations
    let corporateCount = 0
    for (const z of zipScores) {
      if (z.corporate_share_pct != null && z.total_gp_locations != null) {
        corporateCount += Math.round(z.corporate_share_pct * z.total_gp_locations)
      } else {
        corporateCount += (z.dso_affiliated_count ?? 0) + (z.pe_backed_count ?? 0)
      }
    }
    const indepCount = zipScores.reduce((sum, z) => sum + (z.independent_count ?? 0), 0)
    const corporateHighConf = zipScores.reduce((sum, z) => sum + (z.corporate_highconf_count ?? 0), 0)
    const gpDenom = totalGpLocations > 0 ? totalGpLocations : totalP
    const unknownCount = Math.max(0, gpDenom - corporateCount - indepCount)
    const allSignalsPct = gpDenom > 0 ? (corporateCount / gpDenom) * 100 : 0
    const highConfPct = gpDenom > 0 ? (corporateHighConf / gpDenom) * 100 : 0

    return {
      totalP,
      totalGpLocations,
      gpDenom,
      unknownCount,
      corporateHighConf,
      corporateAll: corporateCount,
      indepCount,
      highConfPct,
      allSignalsPct,
      indepPct: gpDenom > 0 ? (indepCount / gpDenom) * 100 : 0,
    }
  }, [zipScores, selectedMetro, classificationCounts])

  // Compute entity classification breakdown for Ownership tab
  const ecBreakdown = useMemo(() => {
    return ENTITY_CLASSIFICATIONS.map(ec => ({
      value: ec.value,
      label: ec.label,
      description: ec.description,
      category: ec.category,
      count: entityCounts[ec.value] ?? 0,
    }))
  }, [entityCounts])

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ownership & Coverage</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">
            Read consolidation through census coverage first: reviewed ownership tiers,
            unreviewed ZIPs, legacy detector floor, and owner-network patterns.
          </p>
        </div>

        <WarroomCrossLink
          context="See consolidation, targets, and signals together — with scope, lens, and intent in one command surface."
          hrefSuffix="?mode=hunt&lens=consolidation"
        />

        {/* Data freshness bar */}
        <div className="rounded-lg border border-[#D4D0C8] bg-gradient-to-r from-[#F7F7F4] to-[#F5F5F0] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[#6B6B60] text-[0.82rem] font-medium">
            <strong
              className="text-[#1A1A1A]"
              title="Address-deduped Chicagoland GP clinic locations in the 269 watched Illinois ZIPs. Specialists, non-clinical rows, org-only NPIs, and da_unverified artifacts are excluded."
            >
              {freshness.totalPractices.toLocaleString()}
            </strong>{' '}
            GP clinic locations &nbsp;&middot;&nbsp;{' '}
            <strong className="text-[#1A1A1A]">{freshness.daEnriched.toLocaleString()}</strong>{' '}
            Data Axle enriched GP locations
            {freshness.lastUpdated && (
              <>
                {' '}&nbsp;&middot;&nbsp;{' '}
                Updated {formatRelativeTime(freshness.lastUpdated)}
              </>
            )}
          </span>
        </div>

        {/* Market selector */}
        <div className="flex items-center gap-3">
          <label className="text-[0.78rem] text-[#6B6B60] uppercase tracking-wider font-medium">
            Market
          </label>
          <select
            value={selectedMetro}
            onChange={e => setSelectedMetro(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-[0.82rem] text-[#1A1A1A] focus:outline-none focus:border-[#B8860B] transition-colors"
          >
            {allMetros.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Persistent KPIs (always visible above tabs) */}
        <div id="kpis">
          {kpis ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard
                  label="Tracked Clinics"
                  value={
                    kpis.totalGpLocations > 0
                      ? formatNumber(kpis.totalGpLocations)
                      : formatNumber(kpis.totalP)
                  }
                  subtitle={
                    <span className="text-xs text-[#6B6B60]">
                      Chicagoland GP directory scope
                    </span>
                  }
                  tooltip="Address-deduped general dental clinic locations from zip_scores.total_gp_locations. Specialists, non-clinical records, unverified Data Axle rows, and duplicate shells are excluded from this directory scope."
                />
                <KpiCard
                  label="Confirmed Corporate"
                  value={formatPct(kpis.allSignalsPct)}
                  subtitle={
                    <span className="text-xs text-[#6B6B60]">
                      {corporateBandSubtitle(getCorporateBand(kpis.allSignalsPct, 'mixed'))}
                    </span>
                  }
                  tooltip={corporateBandTooltip(getCorporateBand(kpis.allSignalsPct, 'mixed'))}
                  accentColor="#C23B3B"
                />
                <KpiCard
                  label="Not Confirmed Corporate"
                  value={formatPct(kpis.indepPct)}
                  tooltip={`Share of the ${kpis.gpDenom.toLocaleString()} GP clinic locations not detected as corporate by our verification system. Includes verified independents AND practices whose DSO affiliation our detector has not yet identified (stealth local-name DSOs, friendly-PC structures). True independent count is likely somewhat lower than this figure.`}
                />
                <KpiCard
                  label="Unclassified GP"
                  value={formatNumber(kpis.unknownCount)}
                  tooltip="GP directory rows not classified as independent or corporate. This should be zero when the classifier and practice_locations feed are in sync."
                />
              </div>

              {/* Tiered consolidation band — location floor → per-dentist floor → ADA anchor */}
              <CorporateBandBar
                className="mt-3"
                band={getCorporateBand(kpis.allSignalsPct, 'mixed')}
                title="Corporate consolidation — confirmed floor to ADA anchor"
                caption={`${kpis.corporateAll.toLocaleString()} of ${kpis.gpDenom.toLocaleString()} GP clinic locations carry documented corporate evidence. The two red markers are OURS (confirmed corporate, by location then by dentist); the goldenrod marker is the external ADA per-dentist anchor.`}
              />

              <p className="text-[#707064] text-xs mt-2">
                {kpis.gpDenom.toLocaleString()} GP clinic locations: Confirmed corporate {kpis.allSignalsPct.toFixed(1)}% ({kpis.corporateAll.toLocaleString()}) ·
                Not confirmed corp. {kpis.indepPct.toFixed(1)}% ({kpis.indepCount.toLocaleString()}).
                Corporate share and not-confirmed-corporate share use GP clinic locations as the denominator (matches the headline).
              </p>
            </>
          ) : (
            <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60] text-sm">
              No consolidation scores calculated yet. Run the merge_and_score pipeline to generate
              ZIP-level scores.
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="border-b border-[#E8E5DE]">
          <nav className="flex gap-0" aria-label="Market Intel tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-[#B8860B] text-[#B8860B]'
                    : 'border-transparent text-[#6B6B60] hover:text-[#1A1A1A] hover:border-[#D4D0C8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'consolidation' && (
          <div className="space-y-6">
            {/* DSO Penetration Table */}
            <DSOPenetrationTable
              zipScores={zipScores}
              watchedZips={watchedZips}
            />

            {/* Consolidation Map */}
            <ConsolidationMap
              zipScores={zipScores}
              selectedMetro={selectedMetro}
            />
          </div>
        )}

        {activeTab === 'zip-analysis' && (
          <div className="space-y-6">
            {/* ZIP Score Table */}
            <ZipScoreTable zipScores={zipScores} />

            {/* Practice Detail Tree */}
            <CityPracticeTree
              watchedZips={watchedZips}
              zipScores={zipScores}
              zipList={zipList}
            />
          </div>
        )}

        {activeTab === 'ownership' && (
          <div className="space-y-6">
            {/* Entity Classification Breakdown */}
            <div>
              <SectionHeader
                title="Entity Classification System"
                helpText="The 11-type entity classification system provides granular practice-type labels. This is the primary field for all ownership and consolidation analysis."
              />

              <div className="mt-4 space-y-4">
                {/* Classification categories */}
                {(['solo', 'group', 'corporate', 'other'] as const).map(category => {
                  const categoryLabels: Record<string, string> = {
                    solo: 'Solo Practices',
                    group: 'Group Practices',
                    corporate: 'Corporate / DSO',
                    other: 'Other',
                  }
                  const categoryColors: Record<string, string> = {
                    solo: '#2D8B4E',
                    group: '#B8860B',
                    corporate: '#C23B3B',
                    other: '#7C3AED',
                  }
                  const classifications = ecBreakdown.filter(ec => ec.category === category)
                  if (classifications.length === 0) return null

                  return (
                    <div key={category} className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: categoryColors[category] }}
                        />
                        <h3 className="text-sm font-semibold text-[#1A1A1A]">
                          {categoryLabels[category]}
                        </h3>
                        <span className="text-xs text-[#6B6B60]">
                          ({classifications.reduce((s, c) => s + c.count, 0).toLocaleString()} practices)
                        </span>
                      </div>
                      <div className="divide-y divide-[#E8E5DE]">
                        {classifications.map(ec => (
                          <div key={ec.value} className="px-4 py-3 flex items-start gap-3">
                            <code className="text-xs font-mono bg-[#F7F7F4] px-2 py-0.5 rounded text-[#6B6B60] whitespace-nowrap mt-0.5">
                              {ec.value}
                            </code>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-[#1A1A1A]">{ec.label}</div>
                              <div className="text-xs text-[#6B6B60] mt-0.5">{ec.description}</div>
                            </div>
                            <span className="text-sm font-mono font-semibold text-[#3D3D35] whitespace-nowrap mt-0.5">
                              {ec.count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Signal Quality Explanation */}
                <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
                    Signal Quality & Tiered Confidence
                  </h3>
                  <div className="space-y-3 text-xs text-[#3D3D35]">
                    <div className="flex gap-3">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C23B3B] mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-[#1A1A1A]">High-confidence corporate</strong> -- Real DSO brand matches (dso_national, excluding taxonomy leaks) + dso_regional with EIN/brand/parent company/franchise signals. Most reliable indicator of actual GP corporate ownership.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#D4920B] mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-[#1A1A1A]">All-signals corporate</strong> -- Adds dso_regional locations carrying a single corporate signal: an affiliated DSO operating under a local name (~73% of regional locations), a shared EIN across 3+ ZIPs (~60%), or a corporate parent (~43%). After the 2026-05-30 reclassification these are documented signals (web-verified IL friendly-PC clusters + NPPES brand-mining) -- the legacy shared-phone heuristic is now ~0% of regional rows. Directional but evidence-backed.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2D8B4E] mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-[#1A1A1A]">Independent</strong> -- All 7 solo and group classifications (solo_established, solo_new, solo_inactive, solo_high_volume, family_practice, small_group, large_group). Practices not matching known DSO brand or corporate signal patterns.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Classification Methodology */}
                <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
                    Classification Methodology
                  </h3>
                  <div className="space-y-2 text-xs text-[#3D3D35]">
                    <p>
                      Entity classification is assigned by the DSO classifier pipeline (Pass 3: <code className="bg-[#F7F7F4] px-1 rounded">classify_entity_types()</code>). Classification uses provider count at address, last name matching, taxonomy codes, corporate signals from Data Axle enrichment, and known DSO brand matching.
                    </p>
                    <p>
                      <strong>GP directory classes:</strong> dso_national, dso_regional, family_practice, large_group, small_group, and solo variants. Specialist, non-clinical, da_unverified, org-only, and duplicate rows are excluded from the visible GP directory and maps.
                    </p>
                    <p>
                      <strong>Confidence scores</strong> range from 0-100. Higher scores indicate stronger evidence for the classification (e.g., exact DSO brand match = high confidence vs. shared phone number alone = lower confidence).
                    </p>
                    <p>
                      <strong>Metrics confidence</strong> on ZIP scores: &apos;high&apos; (classification coverage &gt;80% AND unknown &lt;20%), &apos;medium&apos; (coverage &gt;50% AND unknown &lt;40%), &apos;low&apos; (anything else). Market type is set to NULL when confidence is low.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function MarketIntelShell(props: MarketIntelShellProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <MarketIntelShellInner {...props} />
    </Suspense>
  )
}
