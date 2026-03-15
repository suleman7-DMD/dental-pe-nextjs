'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { DonutChart } from '@/components/charts/donut-chart'
import { HistogramChart } from '@/components/charts/histogram-chart'

import { ENTITY_CLASSIFICATION_COLORS } from '@/lib/constants/colors'
import { getEntityClassificationLabel, isCorporateClassification, DSO_FILTER_KEYWORDS } from '@/lib/constants/entity-classifications'

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

const EC_HISTOGRAM_COLORS: Record<string, string> = {
  'Solo Established': '#2D8B4E',
  'Solo New': '#81C784',
  'Solo Inactive': '#9E9E9E',
  'Solo High Volume': '#1B5E20',
  'Family Practice': '#D4920B',
  'Small Group': '#42A5F5',
  'Large Group': '#1565C0',
  'DSO Regional': '#FFA726',
  'DSO National': '#C23B3B',
  'Specialist': '#7C3AED',
  'Non-Clinical': '#9C9C90',
  'Unknown': '#9C9C90',
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
    const counts: Record<string, number> = {}
    for (const p of practices) {
      const ec = (p.entity_classification ?? '').trim().toLowerCase() || 'unknown'
      counts[ec] = (counts[ec] ?? 0) + 1
    }

    const segments = Object.entries(counts)
      .map(([key, value]) => ({
        label: getEntityClassificationLabel(key),
        value,
        color: ENTITY_CLASSIFICATION_COLORS[key as keyof typeof ENTITY_CLASSIFICATION_COLORS] ?? '#9C9C90',
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)

    const grandTotal = segments.reduce((s, seg) => s + seg.value, 0)
    return { segments, centerLabel: grandTotal.toLocaleString(), grandTotal }
  }, [practices])

  // ── Chart 3: Practice Age Distribution ────────────────────────────────
  const ageHistogramData = useMemo(() => {
    const rows: Array<{ year: number; ownership: string }> = []
    for (const p of practices) {
      const yr = p.year_established != null ? Number(p.year_established) : NaN
      if (isNaN(yr) || yr < 1900 || yr > 2030) continue
      const ec = (p.entity_classification ?? '').trim().toLowerCase()
      const ownership = getEntityClassificationLabel(ec || 'unknown')
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
      // Filter out taxonomy description artifacts
      if (DSO_FILTER_KEYWORDS.some(kw => dso.toLowerCase().includes(kw))) continue
      // Only count practices classified as corporate
      if (!isCorporateClassification(p.entity_classification)) continue
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
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Consolidation by ZIP</h3>
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
                colors: ['#2D8B4E', '#D4920B', '#C23B3B'],
              }}
              tooltipFormat={(d) => `ZIP ${d.label}: ${d.value.toFixed(1)}%`}
            />
          ) : (
            <p className="text-sm text-[#6B6B60] text-center py-8">
              No ZIP-level consolidation data available.
            </p>
          )}
        </div>

        {/* 2. Ownership Breakdown Donut */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Ownership Breakdown</h3>
          <DonutChart
            segments={donutData.segments}
            centerLabel={donutData.centerLabel}
            height={420}
            tooltipFormat={(d) =>
              `${d.label}: ${d.value.toLocaleString()} practices (${
                ((d.value / Math.max(donutData.grandTotal, 1)) * 100).toFixed(1)
              }%)`
            }
          />
        </div>

        {/* 3. Practice Age Distribution */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Practice Age Distribution</h3>
          {ageHistogramData.length > 0 ? (
            <HistogramChart
              data={ageHistogramData}
              xField="year"
              colorField="ownership"
              colorMap={EC_HISTOGRAM_COLORS}
              categoryOrder={[
                'Solo Established',
                'Solo New',
                'Solo Inactive',
                'Solo High Volume',
                'Family Practice',
                'Small Group',
                'Large Group',
                'DSO Regional',
                'DSO National',
                'Specialist',
                'Non-Clinical',
                'Unknown',
              ]}
              xAxisLabel="Year Established"
              yAxisLabel="Practices"
              height={420}
              stacked
              verticalLines={[
                {
                  x: 1995,
                  color: '#C23B3B',
                  dash: true,
                  label: 'Retirement Risk Zone',
                },
              ]}
            />
          ) : (
            <p className="text-sm text-[#6B6B60] text-center py-8">
              No year-established data available for practice age chart.
            </p>
          )}
        </div>

        {/* 4. Top DSOs in Zone */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Top DSOs in Zone</h3>
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
            <p className="text-sm text-[#6B6B60] text-center py-8">
              No DSO-affiliated practices found in this zone.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
