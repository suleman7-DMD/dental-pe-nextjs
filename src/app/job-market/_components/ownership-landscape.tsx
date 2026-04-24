'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { DataTable } from '@/components/data-display/data-table'

import { ENTITY_CLASSIFICATION_COLORS } from '@/lib/constants/colors'
import { getEntityClassificationLabel, isCorporateClassification, DSO_FILTER_KEYWORDS } from '@/lib/constants/entity-classifications'
import type { Practice, ZipScore, WatchedZip } from '@/lib/types'
import type { ZipStats } from './job-market-shell'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface OwnershipLandscapeProps {
  practices: Practice[]
  zipStats: ZipStats[]
  zipScores: ZipScore[]
  watchedZips: WatchedZip[]
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function OwnershipLandscape({ practices, zipStats, zipScores, watchedZips }: OwnershipLandscapeProps) {
  // ── Ownership Status Bar Chart ────────────────────────────────────────
  const ownershipData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of practices) {
      const ec = (p.entity_classification ?? '').trim().toLowerCase() || 'unknown'
      counts[ec] = (counts[ec] ?? 0) + 1
    }

    return Object.entries(counts)
      .map(([ec, count]) => ({
        label: getEntityClassificationLabel(ec),
        value: count,
        color: ENTITY_CLASSIFICATION_COLORS[ec as keyof typeof ENTITY_CLASSIFICATION_COLORS] ?? '#9C9C90',
      }))
      .sort((a, b) => b.value - a.value)
  }, [practices])

  // ── Practice Size Distribution ────────────────────────────────────────
  const sizeData = useMemo(() => {
    const sizes = { 'Solo (1-4)': 0, 'Small Group (5-9)': 0, 'Large Group (10+)': 0 }

    for (const p of practices) {
      const emp = p.employee_count != null ? Number(p.employee_count) : NaN
      if (isNaN(emp) || emp <= 0) continue

      if (emp <= 4) sizes['Solo (1-4)']++
      else if (emp <= 9) sizes['Small Group (5-9)']++
      else sizes['Large Group (10+)']++
    }

    // Only show if we have any data
    const total = Object.values(sizes).reduce((a, b) => a + b, 0)
    if (total === 0) return null

    return Object.entries(sizes).map(([label, value]) => ({ label, value }))
  }, [practices])

  // ── Top DSOs table ────────────────────────────────────────────────────
  const topDsos = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of practices) {
      const dso = p.affiliated_dso
      if (!dso || dso.trim() === '') continue
      if (DSO_FILTER_KEYWORDS.some(kw => dso.toLowerCase().includes(kw))) continue
      if (!isCorporateClassification(p.entity_classification)) continue
      counts[dso] = (counts[dso] ?? 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, practices]) => ({ name, practices }))
  }, [practices])

  // ── DSO Penetration by ZIP ────────────────────────────────────────────
  const wzCityMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const wz of watchedZips) {
      if (wz.city) map.set(wz.zip_code, wz.city)
    }
    return map
  }, [watchedZips])

  const dsoPenetration = useMemo(() => {
    if (!zipScores || zipScores.length === 0) return []
    return [...zipScores]
      .filter((zs) => zs.corporate_share_pct != null && zs.corporate_share_pct > 0)
      .sort((a, b) => (b.corporate_share_pct ?? 0) - (a.corporate_share_pct ?? 0))
      .map((zs) => ({
        zip: zs.zip_code,
        city: wzCityMap.get(zs.zip_code) ?? zs.city ?? '--',
        practices: zs.total_gp_locations ?? 0,
        corporate_share_pct: (zs.corporate_share_pct ?? 0) * 100,
      }))
  }, [zipScores, wzCityMap])

  if (practices.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Ownership Landscape"
        helpText="Breakdown of practices by ownership status and size."
      />

      <div className="mt-4 space-y-6">
        {/* Ownership Status Bar */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <BarChart
            data={ownershipData}
            orientation="horizontal"
            height={300}
            xAxisLabel="Practices"
            tooltipFormat={(d) => `${d.label}: ${d.value.toLocaleString()} practices`}
          />
        </div>

        {/* Practice Size Distribution */}
        {sizeData && (
          <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
              Practice Size Distribution
            </h3>
            <BarChart
              data={sizeData}
              orientation="vertical"
              height={300}
              xAxisLabel="Practice Size"
              yAxisLabel="Practices"
              barColor="#42A5F5"
            />
          </div>
        )}

        {/* Top DSOs Table */}
        {topDsos.length > 0 && (
          <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
              Top DSOs in Zone
            </h3>
            <DataTable
              data={topDsos}
              columns={[
                { key: 'name', header: 'DSO Name' },
                {
                  key: 'practices',
                  header: 'Practices',
                  render: (v: number) => v.toLocaleString(),
                },
              ]}
              rowKey="name"
            />
          </div>
        )}

        {/* DSO Penetration by ZIP */}
        {dsoPenetration.length > 0 && (
          <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
              DSO Penetration by ZIP
            </h3>
            <DataTable
              data={dsoPenetration}
              columns={[
                { key: 'zip', header: 'ZIP' },
                { key: 'city', header: 'City' },
                {
                  key: 'practices',
                  header: 'Practices',
                  render: (v: number | null) => v != null ? v.toLocaleString() : '--',
                },
                {
                  key: 'corporate_share_pct',
                  header: 'Corporate Share %',
                  render: (v: number | null) => v != null ? `${Number(v).toFixed(1)}%` : '--',
                },
              ]}
              rowKey="zip"
            />
          </div>
        )}
      </div>
    </div>
  )
}
