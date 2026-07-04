'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { StackedBarChart } from '@/components/charts/stacked-bar-chart'
import { DataTable } from '@/components/data-display/data-table'

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

interface MarketAnalyticsProps {
  practices: Practice[]
  zipStats: ZipStats[]
}

/** network_id slugs ("heartland_dental") → display labels ("Heartland Dental"). */
function formatNetworkId(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ────────────────────────────────────────────────────────────────────────────
// Component — ownership analytics read the census truth layer only. The
// detector Independent/Consolidated/Unknown stack and the affiliated_dso /
// affiliated_pe_sponsor tables were removed, not relabeled.
// ────────────────────────────────────────────────────────────────────────────

export function MarketAnalytics({ practices, zipStats }: MarketAnalyticsProps) {
  const filteredPractices = useMemo(
    () => practices.filter((p) => isGpLocationClassification(p.entity_classification)),
    [practices]
  )

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

  // ── Census ownership breakdown (top 25, five-segment stacked bar) ─────
  const censusBreakdownData = useMemo(() => {
    const top25 = [...zipStats]
      .sort((a, b) => b.total_practices - a.total_practices)
      .slice(0, 25)

    return top25
      .sort((a, b) => a.total_practices - b.total_practices) // ascending for chart
      .map((zs) => {
        const total = Math.max(zs.total_practices, 1)
        const pct = (n: number) => Math.round((n / total) * 1000) / 10
        return {
          label: zs.city ? `${zs.zip_code} (${zs.city})` : zs.zip_code,
          segments: [
            {
              key: BUCKET_META.true_solo_owner_operated.shortLabel,
              value: pct(zs.solo_owner_count),
              color: BUCKET_META.true_solo_owner_operated.color,
            },
            {
              key: BUCKET_META.dentist_owned_not_solo.shortLabel,
              value: pct(zs.dentist_owned_count),
              color: BUCKET_META.dentist_owned_not_solo.color,
            },
            {
              key: BUCKET_META.dso_pe_corporate.shortLabel,
              value: pct(zs.dso_pe_count),
              color: BUCKET_META.dso_pe_corporate.color,
            },
            {
              key: BUCKET_META.institutional.shortLabel,
              value: pct(zs.institutional_count),
              color: BUCKET_META.institutional.color,
            },
            {
              key: BUCKET_META.unresolved.shortLabel,
              value: pct(zs.unresolved_count),
              color: BUCKET_META.unresolved.color,
            },
          ],
        }
      })
  }, [zipStats])

  // ── Corporate network share table (census network_id) ─────────────────
  const networkShare = useMemo(() => {
    const totalInZone = filteredPractices.length
    const counts: Record<string, { locations: number; zips: Set<string> }> = {}

    for (const p of filteredPractices) {
      if (tierToBucket(p.ownership_tier) !== 'dso_pe_corporate') continue
      const name = p.network_id ? formatNetworkId(p.network_id) : 'Network not recorded'

      if (!counts[name]) counts[name] = { locations: 0, zips: new Set() }
      counts[name].locations++
      const zip5 = (p.zip ?? '').toString().slice(0, 5)
      if (zip5) counts[name].zips.add(zip5)
    }

    return Object.entries(counts)
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
  }, [filteredPractices])

  // ── PE-backed clinics by network (census pe_backed flag) ──────────────
  const peBackedNetworks = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filteredPractices) {
      if (p.pe_backed !== true) continue
      const name = p.network_id ? formatNetworkId(p.network_id) : 'Network not recorded'
      counts[name] = (counts[name] ?? 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, clinics]) => ({ name, clinics }))
  }, [filteredPractices])

  if (zipStats.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Market Analytics"
        helpText="ZIP-level density, census ownership breakdown, and corporate-network landscape. All ownership reads come from the hand-reviewed census."
      />

      <div className="mt-4 space-y-6">
        {/* Dentist Density by ZIP */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
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

        {/* Census ownership breakdown by ZIP */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">
            Census Ownership Breakdown by ZIP -- Top 25
          </h3>
          <p className="text-xs text-[#6B6B60] mb-3">
            Five census buckets per ZIP. Unresolved = tracked clinics without a reviewed
            conclusion — shown honestly, never redistributed.
          </p>
          <StackedBarChart
            data={censusBreakdownData}
            orientation="horizontal"
            height={Math.max(400, censusBreakdownData.length * 22)}
            xAxisLabel="Percentage of Tracked Clinics"
            legendItems={HEADLINE_BUCKETS.map((b) => ({
              key: BUCKET_META[b].shortLabel,
              color: BUCKET_META[b].color,
            }))}
          />
        </div>

        {/* Competitive Landscape */}
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
            Competitive Landscape
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Corporate network share (census) */}
            <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
              <h4 className="text-xs font-semibold text-[#6B6B60] uppercase tracking-wider mb-3">
                Corporate Network Share (Census)
              </h4>
              {networkShare.length === 0 ? (
                <p className="text-sm text-[#6B6B60] text-center py-4">
                  No census-reviewed DSO/PE clinics found.
                </p>
              ) : (
                <DataTable
                  data={networkShare}
                  columns={[
                    { key: 'name', header: 'Network' },
                    {
                      key: 'locations',
                      header: 'Clinics',
                      render: (v: unknown) => v != null ? Number(v).toLocaleString() : '--',
                    },
                    {
                      key: 'zips_covered',
                      header: 'ZIPs Covered',
                      render: (v: unknown) => v != null ? Number(v).toLocaleString() : '--',
                    },
                    {
                      key: 'market_share',
                      header: 'Share of Tracked %',
                      render: (v: unknown) => v != null ? `${Number(v).toFixed(1)}%` : '--',
                    },
                  ]}
                  rowKey="name"
                />
              )}
            </div>

            {/* PE-backed clinics (census) */}
            <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
              <h4 className="text-xs font-semibold text-[#6B6B60] uppercase tracking-wider mb-3">
                PE-Backed Clinics (Census)
              </h4>
              {peBackedNetworks.length === 0 ? (
                <p className="text-sm text-[#6B6B60] text-center py-4">
                  No census-reviewed PE-backed clinics found.
                </p>
              ) : (
                <DataTable
                  data={peBackedNetworks}
                  columns={[
                    { key: 'name', header: 'Network' },
                    {
                      key: 'clinics',
                      header: 'PE-Backed Clinics',
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
