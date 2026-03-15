'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import { DataTable } from '@/components/data-display/data-table'

import type { Practice } from '@/lib/types'
import type { ZipStats } from './job-market-shell'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface OwnershipLandscapeProps {
  practices: Practice[]
  zipStats: ZipStats[]
}

// ────────────────────────────────────────────────────────────────────────────
// Status labels and colors
// ────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  independent: { label: 'Independent', color: '#66BB6A' },
  likely_independent: { label: 'Likely Independent', color: '#81C784' },
  dso_affiliated: { label: 'DSO Affiliated', color: '#FFB74D' },
  pe_backed: { label: 'PE-Backed', color: '#EF5350' },
  unknown: { label: 'Unknown', color: '#78909C' },
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function OwnershipLandscape({ practices, zipStats }: OwnershipLandscapeProps) {
  if (practices.length === 0) return null

  // ── Ownership Status Bar Chart ────────────────────────────────────────
  const ownershipData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of practices) {
      const status = (p.ownership_status ?? 'unknown').trim().toLowerCase()
      counts[status] = (counts[status] ?? 0) + 1
    }

    return Object.entries(counts)
      .map(([status, count]) => {
        const cfg = STATUS_CONFIG[status] ?? {
          label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          color: '#78909C',
        }
        return {
          label: cfg.label,
          value: count,
          color: cfg.color,
        }
      })
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
      // Filter out "General Dentistry" artifact
      if (dso.toLowerCase() === 'general dentistry') continue
      counts[dso] = (counts[dso] ?? 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, practices]) => ({ name, practices }))
  }, [practices])

  // ── DSO Penetration by ZIP ────────────────────────────────────────────
  const dsoPenetration = useMemo(() => {
    if (zipStats.length === 0) return []

    return [...zipStats]
      .filter((zs) => zs.consolidation_pct_of_total != null)
      .sort((a, b) => a.consolidation_pct_of_total - b.consolidation_pct_of_total)
      .map((zs) => ({
        zip: zs.zip_code,
        city: zs.city || '--',
        practices: zs.total_practices,
        consolidation_pct: zs.consolidation_pct_of_total,
      }))
  }, [zipStats])

  return (
    <div>
      <SectionHeader
        title="Ownership Landscape"
        helpText="Breakdown of practices by ownership status and size."
      />

      <div className="mt-4 space-y-6">
        {/* Ownership Status Bar */}
        <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
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
          <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
            <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">
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
          <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
            <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">
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
          <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
            <h3 className="text-sm font-semibold text-[#E8ECF1] mb-3">
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
                  key: 'consolidation_pct',
                  header: 'Known Consolidation %',
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
