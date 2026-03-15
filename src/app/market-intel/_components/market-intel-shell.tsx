'use client'

import { useState, useMemo, Suspense } from 'react'
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
import { ConsolidationMap } from './consolidation-map'
import { ZipScoreTable } from './zip-score-table'
import { CityPracticeTree } from './city-practice-tree'
import { DSOPenetrationTable } from './dso-penetration-table'

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
}

const TABS = [
  { id: 'consolidation', label: 'Consolidation' },
  { id: 'zip-analysis', label: 'ZIP Analysis' },
  { id: 'ownership', label: 'Ownership' },
] as const

type TabId = (typeof TABS)[number]['id']

function MarketIntelShellInner({
  initialZipScores,
  initialWatchedZips,
  metroAreas,
  freshness,
  classificationCounts,
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

  const [selectedMetro, setSelectedMetro] = useState<string>('All Watched ZIPs')
  const allMetros = useMemo(() => ['All Watched ZIPs', ...metroAreas], [metroAreas])

  // Filter zip scores and watched zips by selected metro
  const zipScores = useMemo(() => {
    if (selectedMetro === 'All Watched ZIPs') return initialZipScores
    return initialZipScores.filter(z => z.metro_area === selectedMetro)
  }, [initialZipScores, selectedMetro])

  const watchedZips = useMemo(() => {
    if (selectedMetro === 'All Watched ZIPs') return initialWatchedZips
    return initialWatchedZips.filter(z => z.metro_area === selectedMetro)
  }, [initialWatchedZips, selectedMetro])

  const zipList = useMemo(() => watchedZips.map(z => z.zip_code), [watchedZips])

  // Compute KPI values
  const kpis = useMemo(() => {
    if (selectedMetro === 'All Watched ZIPs') {
      const { total, corporate, corporateHighConf, independent, unknown } = classificationCounts
      if (total === 0) return null
      const highConfPct = (corporateHighConf / total) * 100
      const allSignalsPct = (corporate / total) * 100
      return {
        totalP: total,
        corporateHighConf,
        corporateAll: corporate,
        indepCount: independent,
        unkCount: unknown,
        highConfPct,
        allSignalsPct,
        indepPct: (independent / total) * 100,
        unkPct: (unknown / total) * 100,
      }
    }

    // For filtered metro, use zip_scores
    if (zipScores.length === 0) return null
    const totalP = zipScores.reduce((sum, z) => {
      const t = z.total_practices ?? ((z.total_gp_locations ?? 0) + (z.total_specialist_locations ?? 0))
      return sum + t
    }, 0)
    let corporateCount = 0
    for (const z of zipScores) {
      if (z.corporate_share_pct != null && z.total_gp_locations != null) {
        corporateCount += Math.round(z.corporate_share_pct * z.total_gp_locations)
      } else {
        corporateCount += (z.dso_affiliated_count ?? 0) + (z.pe_backed_count ?? 0)
      }
    }
    const specialistCount = zipScores.reduce((sum, z) => sum + (z.total_specialist_locations ?? 0), 0)
    const indepCount = Math.max(0, totalP - corporateCount - specialistCount)
    const allSignalsPct = totalP > 0 ? (corporateCount / totalP) * 100 : 0

    return {
      totalP,
      corporateHighConf: 0,
      corporateAll: corporateCount,
      indepCount,
      unkCount: specialistCount,
      highConfPct: 0,
      allSignalsPct,
      indepPct: totalP > 0 ? (indepCount / totalP) * 100 : 0,
      unkPct: totalP > 0 ? (specialistCount / totalP) * 100 : 0,
    }
  }, [zipScores, selectedMetro, classificationCounts])

  // Compute entity classification breakdown for Ownership tab
  const ecBreakdown = useMemo(() => {
    if (zipScores.length === 0) return []
    // We can derive a rough breakdown from zip_scores data
    // For each entity classification, sum from zip_scores where available
    // This is a simplified view; full accuracy requires practice-level data
    return ENTITY_CLASSIFICATIONS.map(ec => ({
      value: ec.value,
      label: ec.label,
      description: ec.description,
      category: ec.category,
    }))
  }, [zipScores])

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">
            Drill into your watched neighborhoods to see who owns what, which practices are
            independent, and where consolidation is happening.
          </p>
        </div>

        {/* Data freshness bar */}
        <div className="rounded-lg border border-[#D4D0C8] bg-gradient-to-r from-[#F7F7F4] to-[#F5F5F0] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[#6B6B60] text-[0.82rem] font-medium">
            <strong className="text-[#1A1A1A]">{freshness.totalPractices.toLocaleString()}</strong>{' '}
            practices tracked &nbsp;&middot;&nbsp;{' '}
            <strong className="text-[#1A1A1A]">{freshness.daEnriched.toLocaleString()}</strong>{' '}
            Data Axle enriched
            {freshness.lastUpdated && (
              <>
                {' '}&nbsp;&middot;&nbsp;{' '}
                Updated {formatRelativeTime(freshness.lastUpdated)}
              </>
            )}
          </span>
        </div>

        {/* Metro area selector */}
        <div className="flex items-center gap-3">
          <label className="text-[0.78rem] text-[#6B6B60] uppercase tracking-wider font-medium">
            Metro Area
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
                <KpiCard label="Total Practices" value={formatNumber(kpis.totalP)} />
                <KpiCard
                  label="Known Corporate"
                  value={formatPct(kpis.highConfPct)}
                  tooltip={`High-confidence: ${kpis.corporateHighConf.toLocaleString()} practices (DSO brands + EIN clusters). Including shared-phone signals: ${formatPct(kpis.allSignalsPct)} (${kpis.corporateAll.toLocaleString()}).`}
                  accentColor="#C23B3B"
                />
                <KpiCard
                  label="Independent (of total)"
                  value={formatPct(kpis.indepPct)}
                />
                <KpiCard label="Specialist + Other" value={formatPct(kpis.unkPct)} />
              </div>

              {/* Tiered consolidation detail */}
              <div className="mt-3 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]/60 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C23B3B]" />
                    <span className="text-xs text-[#1A1A1A] font-medium">
                      Known Corporate (high confidence):
                    </span>
                    <span className="text-xs font-mono font-bold text-[#C23B3B]">
                      {formatPct(kpis.highConfPct)} ({kpis.corporateHighConf.toLocaleString()})
                    </span>
                  </div>
                  <span className="text-[#D4D0C8]">|</span>
                  <span className="text-[10px] text-[#6B6B60]">
                    Real DSO brands + EIN-verified corporate entities + DSO-owned specialists
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#D4920B]" />
                    <span className="text-xs text-[#1A1A1A] font-medium">
                      Incl. shared-phone signals:
                    </span>
                    <span className="text-xs font-mono font-bold text-[#D4920B]">
                      {formatPct(kpis.allSignalsPct)} ({kpis.corporateAll.toLocaleString()})
                    </span>
                  </div>
                  <span className="text-[#D4D0C8]">|</span>
                  <span className="text-[10px] text-[#6B6B60]">
                    Adds practices sharing a phone # with others (weaker signal, may be group practices)
                  </span>
                </div>
              </div>

              <p className="text-[#9C9C90] text-xs mt-2">
                {kpis.totalP.toLocaleString()} practices: Independent {kpis.indepPct.toFixed(1)}% ({kpis.indepCount.toLocaleString()}) |
                Specialist/Other {kpis.unkPct.toFixed(1)}% ({kpis.unkCount.toLocaleString()}).
                All percentages use total practices as denominator.
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
                          ({classifications.length} type{classifications.length > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="divide-y divide-[#E8E5DE]">
                        {classifications.map(ec => (
                          <div key={ec.value} className="px-4 py-3 flex items-start gap-3">
                            <code className="text-xs font-mono bg-[#F7F7F4] px-2 py-0.5 rounded text-[#6B6B60] whitespace-nowrap mt-0.5">
                              {ec.value}
                            </code>
                            <div>
                              <div className="text-sm font-medium text-[#1A1A1A]">{ec.label}</div>
                              <div className="text-xs text-[#6B6B60] mt-0.5">{ec.description}</div>
                            </div>
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
                        <strong className="text-[#1A1A1A]">High-confidence corporate</strong> -- Real DSO brand matches (dso_national, excluding taxonomy leaks) + dso_regional with EIN/brand/parent company/franchise signals + DSO-owned specialists. Most reliable indicator of actual corporate ownership.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#D4920B] mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-[#1A1A1A]">All-signals corporate</strong> -- Includes shared-phone-only dso_regional classifications. ~92% of dso_regional were triggered by shared phone numbers alone, which often indicates group practices at the same address rather than true DSO affiliation. Treat as directional.
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
                      <strong>Priority order (first match wins):</strong> non_clinical &rarr; specialist &rarr; dso_national &rarr; corporate signals (dso_regional) &rarr; family_practice &rarr; large_group &rarr; small_group &rarr; solo variants.
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
