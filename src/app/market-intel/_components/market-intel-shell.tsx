'use client'

import { useState, useMemo } from 'react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import { StickySectionNav } from '@/components/layout/sticky-section-nav'
import { formatPct, formatNumber } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils/formatting'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'
import type { ADABenchmark } from '@/lib/supabase/queries/ada-benchmarks'
import { ADABenchmarks } from './ada-benchmarks'
import { ConsolidationMap } from './consolidation-map'
import { ZipScoreTable } from './zip-score-table'
import { CityPracticeTree } from './city-practice-tree'
import { RecentChanges } from './recent-changes'
import { SaturationTable } from './saturation-table'

interface MarketIntelShellProps {
  initialZipScores: ZipScore[]
  initialWatchedZips: WatchedZip[]
  metroAreas: string[]
  adaBenchmarks: ADABenchmark[]
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

const NAV_ITEMS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'map', label: 'Map' },
  { id: 'zips', label: 'ZIP Scores' },
  { id: 'practices', label: 'Practices' },
  { id: 'changes', label: 'Changes' },
  { id: 'saturation', label: 'Saturation' },
]

export function MarketIntelShell({
  initialZipScores,
  initialWatchedZips,
  metroAreas,
  adaBenchmarks,
  freshness,
  classificationCounts,
}: MarketIntelShellProps) {
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
    // Total practices: prefer total_practices, fall back to GP + specialist locations
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
    // Specialist + non-clinical count (not independent, not corporate)
    const specialistCount = zipScores.reduce((sum, z) => sum + (z.total_specialist_locations ?? 0), 0)
    const indepCount = Math.max(0, totalP - corporateCount - specialistCount)
    const allSignalsPct = totalP > 0 ? (corporateCount / totalP) * 100 : 0

    return {
      totalP,
      corporateHighConf: 0, // not available per-metro yet
      corporateAll: corporateCount,
      indepCount,
      unkCount: specialistCount, // "Other" = specialist + non-clinical
      highConfPct: 0,
      allSignalsPct,
      indepPct: totalP > 0 ? (indepCount / totalP) * 100 : 0,
      unkPct: totalP > 0 ? (specialistCount / totalP) * 100 : 0,
    }
  }, [zipScores, selectedMetro, classificationCounts])

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F8FAFC] font-sans">
      <StickySectionNav sections={NAV_ITEMS} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">
            Drill into your watched neighborhoods to see who owns what, which practices are
            independent, and where consolidation is happening.
          </p>
        </div>

        {/* Data freshness bar */}
        <div className="rounded-lg border border-[#1a3a5c] bg-gradient-to-r from-[#0a1628] to-[#0d2137] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[#7eb8e0] text-[0.82rem] font-medium">
            <strong className="text-[#F8FAFC]">{freshness.totalPractices.toLocaleString()}</strong>{' '}
            practices tracked &nbsp;&middot;&nbsp;{' '}
            <strong className="text-[#F8FAFC]">{freshness.daEnriched.toLocaleString()}</strong>{' '}
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
          <label className="text-[0.78rem] text-[#94A3B8] uppercase tracking-wider font-medium">
            Metro Area
          </label>
          <select
            value={selectedMetro}
            onChange={e => setSelectedMetro(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#1E293B] bg-[#0F1629] text-[0.82rem] text-[#F8FAFC] focus:outline-none focus:border-[#3B82F6] transition-colors"
          >
            {allMetros.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* KPIs */}
        <div id="kpis">
          {kpis ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard label="Total Practices" value={formatNumber(kpis.totalP)} />
                <KpiCard
                  label="Known Corporate"
                  value={formatPct(kpis.highConfPct)}
                  tooltip={`High-confidence: ${kpis.corporateHighConf.toLocaleString()} practices (DSO brands + EIN clusters). Including shared-phone signals: ${formatPct(kpis.allSignalsPct)} (${kpis.corporateAll.toLocaleString()}).`}
                  accentColor="#EF4444"
                />
                <KpiCard
                  label="Independent (of total)"
                  value={formatPct(kpis.indepPct)}
                />
                <KpiCard label="Specialist + Other" value={formatPct(kpis.unkPct)} />
              </div>

              {/* Tiered consolidation detail */}
              <div className="mt-3 rounded-lg border border-[#1E293B] bg-[#0F1629]/60 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                    <span className="text-xs text-[#F8FAFC] font-medium">
                      Known Corporate (high confidence):
                    </span>
                    <span className="text-xs font-mono font-bold text-[#EF4444]">
                      {formatPct(kpis.highConfPct)} ({kpis.corporateHighConf.toLocaleString()})
                    </span>
                  </div>
                  <span className="text-[#334155]">|</span>
                  <span className="text-[10px] text-[#94A3B8]">
                    Real DSO brands + EIN-verified corporate entities + DSO-owned specialists
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                    <span className="text-xs text-[#F8FAFC] font-medium">
                      Incl. shared-phone signals:
                    </span>
                    <span className="text-xs font-mono font-bold text-[#F59E0B]">
                      {formatPct(kpis.allSignalsPct)} ({kpis.corporateAll.toLocaleString()})
                    </span>
                  </div>
                  <span className="text-[#334155]">|</span>
                  <span className="text-[10px] text-[#94A3B8]">
                    Adds practices sharing a phone # with others (weaker signal, may be group practices)
                  </span>
                </div>
              </div>

              <p className="text-[#64748B] text-xs mt-2">
                {kpis.totalP.toLocaleString()} practices: Independent {kpis.indepPct.toFixed(1)}% ({kpis.indepCount.toLocaleString()}) |
                Specialist/Other {kpis.unkPct.toFixed(1)}% ({kpis.unkCount.toLocaleString()}).
                All percentages use total practices as denominator.
              </p>
            </>
          ) : (
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8] text-sm">
              No consolidation scores calculated yet. Run the merge_and_score pipeline to generate
              ZIP-level scores.
            </div>
          )}
        </div>

        {/* ADA HPI Benchmarks */}
        <div id="benchmarks">
          <ADABenchmarks data={adaBenchmarks} />
        </div>

        {/* Consolidation Map */}
        <div id="map">
          <ConsolidationMap
            zipScores={zipScores}
            selectedMetro={selectedMetro}
          />
        </div>

        {/* ZIP Score Table */}
        <div id="zips">
          <ZipScoreTable zipScores={zipScores} />
        </div>

        {/* Practice Detail Tree */}
        <div id="practices">
          <CityPracticeTree
            watchedZips={watchedZips}
            zipScores={zipScores}
            zipList={zipList}
          />
        </div>

        {/* Recent Changes */}
        <div id="changes">
          <RecentChanges zipList={zipList} />
        </div>

        {/* Saturation Analysis */}
        <div id="saturation">
          <SaturationTable
            zipScores={zipScores}
            watchedZips={watchedZips}
          />
        </div>
      </div>
    </div>
  )
}
