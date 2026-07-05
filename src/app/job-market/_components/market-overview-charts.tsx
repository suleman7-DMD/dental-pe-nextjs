'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { DonutChart } from '@/components/charts/donut-chart'
import { HistogramChart } from '@/components/charts/histogram-chart'

import { isGpLocationClassification } from '@/lib/constants/entity-classifications'
import {
  BUCKET_META,
  HEADLINE_BUCKETS,
  tierToBucket,
} from '@/lib/census/ownership-truth'

import type { Practice } from '@/lib/types'
import type { ZipStats } from './job-market-shell'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MarketOverviewChartsProps {
  practices: Practice[]
  zipStats: ZipStats[]
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** network_id slugs ("heartland_dental") → display labels ("Heartland Dental"). */
function formatNetworkId(id: string): string {
  const prefix = /^ao:/i.test(id) ? 'Owner: ' : /^brand:/i.test(id) ? 'Group: ' : ''
  const cleaned = id
    .replace(/^ao:/i, '')
    .replace(/^brand:/i, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return `${prefix}${cleaned}`
}

const BUCKET_HISTOGRAM_ORDER = HEADLINE_BUCKETS.map((b) => BUCKET_META[b].shortLabel)

const BUCKET_HISTOGRAM_COLORS: Record<string, string> = Object.fromEntries(
  HEADLINE_BUCKETS.map((b) => [BUCKET_META[b].shortLabel, BUCKET_META[b].color])
)

// ────────────────────────────────────────────────────────────────────────────
// Component — every ownership visual here reads the census truth layer
// (ownership_tier → headline bucket). The detector-era donut/top-DSO charts
// were removed, not relabeled.
// ────────────────────────────────────────────────────────────────────────────

export function MarketOverviewCharts({
  practices,
  zipStats,
}: MarketOverviewChartsProps) {
  // ── Defensive GP-only guard (scope axis, not an ownership claim) ───
  const filteredPractices = useMemo(
    () =>
      practices.filter((p) => isGpLocationClassification(p.entity_classification)),
    [practices]
  )

  // ── Chart 1: Census DSO/PE share by ZIP ───────────────────────────────
  // Reviewed-corporate count over ALL tracked clinics in the ZIP — a lower
  // bound wherever census coverage < 100%, which the tooltip states.
  const dsoPeByZip = useMemo(() => {
    return zipStats
      .filter((zs) => zs.dso_pe_count > 0)
      .map((zs) => ({
        label: zs.zip_code,
        value: (zs.dso_pe_count / Math.max(zs.total_practices, 1)) * 100,
        dsoPeCount: zs.dso_pe_count,
        total: zs.total_practices,
        unresolved: zs.unresolved_count,
      }))
      .sort((a, b) => a.value - b.value)
      .slice(-25)
  }, [zipStats])

  // ── Chart 2: Census ownership donut (five buckets, always) ────────────
  const donutData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const b of HEADLINE_BUCKETS) counts[b] = 0
    for (const p of filteredPractices) {
      counts[tierToBucket(p.ownership_tier)]++
    }

    const segments = HEADLINE_BUCKETS.map((b) => ({
      label: BUCKET_META[b].label,
      value: counts[b],
      color: BUCKET_META[b].color,
    })).filter((s) => s.value > 0)

    const grandTotal = segments.reduce((s, seg) => s + seg.value, 0)
    return { segments, centerLabel: grandTotal.toLocaleString(), grandTotal }
  }, [filteredPractices])

  // ── Chart 3: Practice age distribution, colored by census bucket ──────
  const ageHistogramData = useMemo(() => {
    const rows: Array<{ year: number; ownership: string }> = []
    for (const p of filteredPractices) {
      const yr = p.year_established != null ? Number(p.year_established) : NaN
      if (isNaN(yr) || yr < 1900 || yr > 2030) continue
      rows.push({ year: yr, ownership: BUCKET_META[tierToBucket(p.ownership_tier)].shortLabel })
    }
    return rows
  }, [filteredPractices])

  // ── Chart 4: Top corporate networks (census network_id) ───────────────
  const topNetworks = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filteredPractices) {
      if (tierToBucket(p.ownership_tier) !== 'dso_pe_corporate') continue
      const label = p.network_id ? formatNetworkId(p.network_id) : 'Network not recorded'
      counts[label] = (counts[label] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => a[1] - b[1])
      .slice(-15)
      .map(([label, value]) => ({ label, value }))
  }, [filteredPractices])

  if (zipStats.length === 0 && filteredPractices.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Market Overview"
        helpText="Ownership mix, DSO/PE concentration by ZIP, office age, and corporate groups in this area. Unreviewed offices stay unresolved."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* 1. DSO/PE share by ZIP */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">
            DSO/PE Share by ZIP
          </h3>
          <p className="text-xs text-[#6B6B60] mb-3">
            Reviewed DSO/PE/corporate offices as a percent of all offices in the ZIP.
            This is a lower bound where ownership review is incomplete.
          </p>
          {dsoPeByZip.length > 0 ? (
            <BarChart
              data={dsoPeByZip}
              orientation="horizontal"
              height={420}
              xAxisLabel="Reviewed DSO/PE % of offices"
              xRange={[0, 100]}
              colorScale={{
                type: 'gradient',
                min: 0,
                max: Math.max(...dsoPeByZip.map((d) => d.value), 1),
                colors: ['#2D8B4E', '#D4920B', '#C23B3B'],
              }}
              tooltipFormat={(d) => `ZIP ${d.label}: ${d.value.toFixed(1)}% reviewed DSO/PE`}
            />
          ) : (
            <p className="text-sm text-[#6B6B60] text-center py-8">
              No reviewed DSO/PE clinics in this zone yet.
            </p>
          )}
        </div>

        {/* 2. Ownership donut */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">Ownership Mix</h3>
          <p className="text-xs text-[#6B6B60] mb-3">
            Reviewed ownership groups. Unresolved = no reviewed answer yet.
          </p>
          <DonutChart
            segments={donutData.segments}
            centerLabel={donutData.centerLabel}
            height={420}
            tooltipFormat={(d) =>
              `${d.label}: ${d.value.toLocaleString()} clinics (${
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
              colorMap={BUCKET_HISTOGRAM_COLORS}
              categoryOrder={BUCKET_HISTOGRAM_ORDER}
              xAxisLabel="Year Established"
              yAxisLabel="Clinics"
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

        {/* 4. Top corporate networks (census) */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">
            Corporate Networks in Zone
          </h3>
          <p className="text-xs text-[#6B6B60] mb-3">
            Reviewed DSO/PE offices grouped by owner or network.
          </p>
          {topNetworks.length > 0 ? (
            <BarChart
              data={topNetworks}
              orientation="horizontal"
              height={420}
              xAxisLabel="Clinics"
              barColor="#C23B3B"
              tooltipFormat={(d) => `${d.label}: ${d.value} reviewed DSO/PE offices`}
            />
          ) : (
            <p className="text-sm text-[#6B6B60] text-center py-8">
              No reviewed DSO/PE offices found in this zone.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
