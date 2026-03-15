'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { DonutChart } from '@/components/charts/donut-chart'
import { HistogramChart } from '@/components/charts/histogram-chart'

import type { Practice } from '@/lib/types'
import type { ZipStats } from './job-market-shell'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MarketOverviewChartsProps {
  practices: Practice[]
  zipStats: ZipStats[]
  kpis: {
    indep_cnt: number
    dso_cnt: number
    pe_cnt: number
    unk_cnt: number
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  independent: 'Independent',
  likely_independent: 'Independent',
  dso_affiliated: 'DSO-Affiliated',
  pe_backed: 'PE-Backed',
  unknown: 'Unknown',
}

const OWNERSHIP_COLORS: Record<string, string> = {
  Independent: '#4CAF50',
  'DSO-Affiliated': '#FFB74D',
  'PE-Backed': '#F44336',
  Unknown: '#78909C',
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function MarketOverviewCharts({
  practices,
  zipStats,
  kpis,
}: MarketOverviewChartsProps) {
  // ── Chart 1: Consolidation by ZIP ─────────────────────────────────────
  const consolidationByZip = useMemo(() => {
    const rows = zipStats
      .map((zs) => ({
        label: zs.zip_code,
        value: zs.consolidation_pct_of_total,
      }))
      .sort((a, b) => a.value - b.value)
      .slice(-25)

    return rows
  }, [zipStats])

  // ── Chart 2: Ownership Donut ──────────────────────────────────────────
  const donutData = useMemo(() => {
    const grandTotal = kpis.indep_cnt + kpis.dso_cnt + kpis.pe_cnt + kpis.unk_cnt
    return {
      segments: [
        { label: 'Independent', value: kpis.indep_cnt, color: '#4CAF50' },
        { label: 'DSO-Affiliated', value: kpis.dso_cnt, color: '#FFB74D' },
        { label: 'PE-Backed', value: kpis.pe_cnt, color: '#F44336' },
        { label: 'Unknown', value: kpis.unk_cnt, color: '#78909C' },
      ],
      centerLabel: grandTotal.toLocaleString(),
    }
  }, [kpis])

  // ── Chart 3: Practice Age Distribution ────────────────────────────────
  const ageHistogramData = useMemo(() => {
    const rows: Array<{ year: number; ownership: string }> = []

    for (const p of practices) {
      const yr = p.year_established != null ? Number(p.year_established) : NaN
      if (isNaN(yr) || yr < 1900 || yr > 2030) continue

      const status = (p.ownership_status ?? 'unknown').trim().toLowerCase()
      const ownership = STATUS_MAP[status] ?? 'Unknown'
      rows.push({ year: yr, ownership })
    }

    return rows
  }, [practices])

  // ── Chart 4: Top DSOs in Zone ─────────────────────────────────────────
  const topDsos = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const p of practices) {
      const dso = p.affiliated_dso
      if (!dso || dso.trim() === '') continue
      // FILTER OUT "General Dentistry" (franchise_name artifact per CLAUDE.md)
      if (dso.toLowerCase() === 'general dentistry') continue
      counts[dso] = (counts[dso] ?? 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => a[1] - b[1])
      .slice(-15)
      .map(([label, value]) => ({ label, value }))
  }, [practices])

  if (zipStats.length === 0 && practices.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Market Overview"
        helpText="Visual snapshot of consolidation patterns, ownership mix, practice age, and top DSO presence across your commutable zone."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* 1. Consolidation by ZIP */}
        <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
          <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">Consolidation by ZIP</h3>
          {consolidationByZip.length > 0 ? (
            <BarChart
              data={consolidationByZip}
              orientation="horizontal"
              height={420}
              xAxisLabel="Known Consolidated %"
              xRange={[0, 100]}
              colorScale={{
                type: 'gradient',
                min: 0,
                max: Math.max(...consolidationByZip.map((d) => d.value), 1),
                colors: ['#4CAF50', '#FFC107', '#F44336'],
              }}
              tooltipFormat={(d) => `ZIP ${d.label}: ${d.value.toFixed(1)}%`}
            />
          ) : (
            <p className="text-sm text-[#8892A0] text-center py-8">
              No ZIP-level consolidation data available.
            </p>
          )}
        </div>

        {/* 2. Ownership Breakdown Donut */}
        <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
          <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">Ownership Breakdown</h3>
          <DonutChart
            segments={donutData.segments}
            centerLabel={donutData.centerLabel}
            height={420}
            tooltipFormat={(d) =>
              `${d.label}: ${d.value.toLocaleString()} practices (${
                (d.value / Math.max(kpis.indep_cnt + kpis.dso_cnt + kpis.pe_cnt + kpis.unk_cnt, 1) * 100).toFixed(1)
              }%)`
            }
          />
        </div>

        {/* 3. Practice Age Distribution */}
        <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
          <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">Practice Age Distribution</h3>
          {ageHistogramData.length > 0 ? (
            <HistogramChart
              data={ageHistogramData}
              xField="year"
              colorField="ownership"
              colorMap={OWNERSHIP_COLORS}
              categoryOrder={['Independent', 'DSO-Affiliated', 'PE-Backed', 'Unknown']}
              xAxisLabel="Year Established"
              yAxisLabel="Practices"
              height={420}
              stacked
              verticalLines={[
                {
                  x: 1995,
                  color: '#FF3D00',
                  dash: true,
                  label: 'Retirement Risk Zone',
                },
              ]}
            />
          ) : (
            <p className="text-sm text-[#8892A0] text-center py-8">
              No year-established data available for practice age chart.
            </p>
          )}
        </div>

        {/* 4. Top DSOs in Zone */}
        <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
          <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">Top DSOs in Zone</h3>
          {topDsos.length > 0 ? (
            <BarChart
              data={topDsos}
              orientation="horizontal"
              height={420}
              xAxisLabel="Practices"
              barColor="#FFB74D"
              tooltipFormat={(d) => `${d.label}: ${d.value} practices`}
            />
          ) : (
            <p className="text-sm text-[#8892A0] text-center py-8">
              No DSO-affiliated practices found in this zone.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
