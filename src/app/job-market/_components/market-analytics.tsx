'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { StackedBarChart } from '@/components/charts/stacked-bar-chart'
import { DataTable } from '@/components/data-display/data-table'

import type { Practice } from '@/lib/types'
import type { ZipStats } from './job-market-shell'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MarketAnalyticsProps {
  practices: Practice[]
  zipStats: ZipStats[]
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function MarketAnalytics({ practices, zipStats }: MarketAnalyticsProps) {
  if (zipStats.length === 0) return null

  // ── Dentist Density by ZIP (top 25, horizontal bar, blue) ─────────────
  const densityData = useMemo(() => {
    return [...zipStats]
      .sort((a, b) => b.total_practices - a.total_practices)
      .slice(0, 25)
      .sort((a, b) => a.total_practices - b.total_practices) // ascending for horizontal bar
      .map((zs) => ({
        label: zs.city ? `${zs.zip_code} (${zs.city})` : zs.zip_code,
        value: zs.total_practices,
      }))
  }, [zipStats])

  // ── Consolidation Breakdown (top 25, stacked horizontal bar) ──────────
  const consolidationData = useMemo(() => {
    const top25 = [...zipStats]
      .sort((a, b) => b.total_practices - a.total_practices)
      .slice(0, 25)

    return top25
      .sort((a, b) => a.total_practices - b.total_practices) // ascending for chart
      .map((zs) => {
        const total = Math.max(zs.total_practices, 1)
        const consolidatedCount = Math.max(
          total - (zs.independent_count ?? 0) - (zs.unknown_count ?? 0),
          0
        )
        const independentPct = ((zs.independent_count ?? 0) / total) * 100
        const consolidatedPct = (consolidatedCount / total) * 100
        const unknownPct = ((zs.unknown_count ?? 0) / total) * 100

        return {
          label: zs.city ? `${zs.zip_code} (${zs.city})` : zs.zip_code,
          segments: [
            { key: 'Independent', value: Math.round(independentPct * 10) / 10, color: '#22C55E' },
            { key: 'Consolidated', value: Math.round(consolidatedPct * 10) / 10, color: '#EF4444' },
            { key: 'Unknown', value: Math.round(unknownPct * 10) / 10, color: '#64748B' },
          ],
        }
      })
  }, [zipStats])

  // ── DSO Market Share table ────────────────────────────────────────────
  const dsoMarketShare = useMemo(() => {
    const totalInZone = practices.length
    const dsoCounts: Record<string, { locations: number; zips: Set<string> }> = {}

    for (const p of practices) {
      const dso = p.affiliated_dso
      if (!dso || dso.trim() === '') continue
      // Filter out "General Dentistry" artifact
      if (dso.toLowerCase() === 'general dentistry') continue

      if (!dsoCounts[dso]) dsoCounts[dso] = { locations: 0, zips: new Set() }
      dsoCounts[dso].locations++
      const zip5 = (p.zip ?? '').toString().slice(0, 5)
      if (zip5) dsoCounts[dso].zips.add(zip5)
    }

    return Object.entries(dsoCounts)
      .sort((a, b) => b[1].locations - a[1].locations)
      .slice(0, 15)
      .map(([name, data]) => ({
        name,
        locations: data.locations,
        zips_covered: data.zips.size,
        market_share: totalInZone > 0
          ? Math.round((data.locations / totalInZone) * 1000) / 10
          : 0,
      }))
  }, [practices])

  // ── PE Sponsors Active table ──────────────────────────────────────────
  const peSponsors = useMemo(() => {
    const peCounts: Record<
      string,
      { dsos: Set<string>; totalLocations: number }
    > = {}

    for (const p of practices) {
      const pe = p.affiliated_pe_sponsor
      if (!pe || pe.trim() === '') continue

      if (!peCounts[pe]) peCounts[pe] = { dsos: new Set(), totalLocations: 0 }
      peCounts[pe].totalLocations++
      const dso = p.affiliated_dso
      if (dso && dso.trim()) peCounts[pe].dsos.add(dso)
    }

    return Object.entries(peCounts)
      .sort((a, b) => b[1].totalLocations - a[1].totalLocations)
      .slice(0, 15)
      .map(([name, data]) => ({
        name,
        portfolio_dsos: data.dsos.size,
        total_locations: data.totalLocations,
      }))
  }, [practices])

  return (
    <div>
      <SectionHeader
        title="Market Analytics"
        helpText="ZIP-level density, consolidation breakdown, and competitive landscape analysis."
      />

      <div className="mt-4 space-y-6">
        {/* Dentist Density by ZIP */}
        <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
          <h3 className="text-sm font-semibold text-[#F8FAFC] mb-3">
            Dentist Density by ZIP -- Top 25
          </h3>
          <BarChart
            data={densityData}
            orientation="horizontal"
            height={Math.max(400, densityData.length * 22)}
            xAxisLabel="Total Practices"
            barColor="#42A5F5"
            showValues
            tooltipFormat={(d) => `${d.label}: ${d.value} practices`}
          />
        </div>

        {/* Consolidation Breakdown by ZIP */}
        <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
          <h3 className="text-sm font-semibold text-[#F8FAFC] mb-3">
            Consolidation Breakdown by ZIP -- Top 25
          </h3>
          <StackedBarChart
            data={consolidationData}
            orientation="horizontal"
            height={Math.max(400, consolidationData.length * 22)}
            xAxisLabel="Percentage of Practices"
            legendItems={[
              { key: 'Independent', color: '#22C55E' },
              { key: 'Consolidated', color: '#EF4444' },
              { key: 'Unknown', color: '#64748B' },
            ]}
          />
        </div>

        {/* Competitive Landscape */}
        <div>
          <h3 className="text-sm font-semibold text-[#F8FAFC] mb-3">
            Competitive Landscape
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DSO Market Share */}
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
              <h4 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
                DSO Market Share
              </h4>
              {dsoMarketShare.length === 0 ? (
                <p className="text-sm text-[#94A3B8] text-center py-4">
                  No DSO-affiliated practices found.
                </p>
              ) : (
                <DataTable
                  data={dsoMarketShare}
                  columns={[
                    { key: 'name', header: 'DSO Name' },
                    {
                      key: 'locations',
                      header: 'Locations',
                      render: (v: unknown) => v != null ? Number(v).toLocaleString() : '--',
                    },
                    {
                      key: 'zips_covered',
                      header: 'ZIPs Covered',
                      render: (v: unknown) => v != null ? Number(v).toLocaleString() : '--',
                    },
                    {
                      key: 'market_share',
                      header: 'Market Share %',
                      render: (v: unknown) => v != null ? `${Number(v).toFixed(1)}%` : '--',
                    },
                  ]}
                  rowKey="name"
                />
              )}
            </div>

            {/* PE Sponsors Active */}
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
              <h4 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
                PE Sponsors Active
              </h4>
              {peSponsors.length === 0 ? (
                <p className="text-sm text-[#94A3B8] text-center py-4">
                  No PE-backed practices found.
                </p>
              ) : (
                <DataTable
                  data={peSponsors}
                  columns={[
                    { key: 'name', header: 'PE Sponsor' },
                    {
                      key: 'portfolio_dsos',
                      header: 'Portfolio DSOs',
                      render: (v: unknown) => v != null ? Number(v).toLocaleString() : '--',
                    },
                    {
                      key: 'total_locations',
                      header: 'Total Locations',
                      render: (v: unknown) => v != null ? Number(v).toLocaleString() : '--',
                    },
                  ]}
                  rowKey="name"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
