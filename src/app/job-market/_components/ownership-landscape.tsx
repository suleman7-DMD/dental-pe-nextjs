'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
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

interface OwnershipLandscapeProps {
  practices: Practice[]
  zipStats: ZipStats[]
}

/** network_id slugs ("heartland_dental") → display labels ("Heartland Dental"). */
function formatNetworkId(id: string): string {
  const prefix = /^ao:/i.test(id) ? 'Owner: ' : /^brand:/i.test(id) ? 'Group: ' : ''
  const cleaned = id
    .replace(/^ao:/i, '')
    .replace(/^brand:/i, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => (/\d/.test(w) || (w.length <= 3 && w === w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
  return `${prefix}${cleaned}`
}

// ────────────────────────────────────────────────────────────────────────────
// Component — census truth layer only. The detector entity_classification
// bars and the corporate_share_pct "penetration" table were removed, not
// relabeled: detector output is never presented as an ownership answer.
// ────────────────────────────────────────────────────────────────────────────

export function OwnershipLandscape({ practices, zipStats }: OwnershipLandscapeProps) {
  // ── Defensive GP-only guard (scope axis, not an ownership claim) ───
  const filteredPractices = useMemo(
    () =>
      practices.filter((p) => isGpLocationClassification(p.entity_classification)),
    [practices]
  )

  // ── Census ownership bar (five buckets, always all five) ──────────────
  const ownershipData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const b of HEADLINE_BUCKETS) counts[b] = 0
    for (const p of filteredPractices) {
      counts[tierToBucket(p.ownership_tier)]++
    }

    return HEADLINE_BUCKETS.map((b) => ({
      label: BUCKET_META[b].label,
      value: counts[b],
      color: BUCKET_META[b].color,
    }))
  }, [filteredPractices])

  // ── Practice Size Distribution (structural, not an ownership claim) ───
  const sizeData = useMemo(() => {
    const sizes = { 'Solo (1-4)': 0, 'Small Group (5-9)': 0, 'Large Group (10+)': 0 }

    for (const p of filteredPractices) {
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
  }, [filteredPractices])

  // ── Corporate networks table (census network_id) ──────────────────────
  const topNetworks = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filteredPractices) {
      if (tierToBucket(p.ownership_tier) !== 'dso_pe_corporate') continue
      const label = p.network_id ? formatNetworkId(p.network_id) : 'Network not recorded'
      counts[label] = (counts[label] ?? 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, clinics]) => ({ name, clinics }))
  }, [filteredPractices])

  // ── Census ownership by ZIP table ─────────────────────────────────────
  const censusByZip = useMemo(() => {
    return [...zipStats]
      .sort((a, b) => b.dso_pe_count - a.dso_pe_count || b.total_practices - a.total_practices)
      .map((zs) => ({
        zip: zs.zip_code,
        city: zs.city || '--',
        total: zs.total_practices,
        solo_owner: zs.solo_owner_count,
        dentist_owned: zs.dentist_owned_count,
        dso_pe: zs.dso_pe_count,
        unresolved: zs.unresolved_count,
        reviewed_pct: zs.reviewed_pct,
      }))
  }, [zipStats])

  if (filteredPractices.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Ownership Landscape"
        helpText="Reviewed ownership groups and corporate networks for this area. Unreviewed offices stay unresolved, never estimated."
      />

      <div className="mt-4 space-y-6">
        {/* Census ownership bar */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">
            Ownership Groups
          </h3>
          <p className="text-xs text-[#6B6B60] mb-3">
            Reviewed ownership answers. Unresolved = no reviewed answer yet.
          </p>
          <BarChart
            data={ownershipData}
            orientation="horizontal"
            height={300}
            xAxisLabel="Clinics"
            tooltipFormat={(d) => `${d.label}: ${d.value.toLocaleString()} clinics`}
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

        {/* Corporate networks table */}
        {topNetworks.length > 0 && (
          <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">
              Corporate Networks in Zone
            </h3>
            <p className="text-xs text-[#6B6B60] mb-3">
              Reviewed DSO/PE offices grouped by network.
            </p>
            <DataTable
              data={topNetworks}
              columns={[
                { key: 'name', header: 'Network' },
                {
                  key: 'clinics',
                  header: 'Reviewed DSO/PE offices',
                  render: (v: number) => v.toLocaleString(),
                },
              ]}
              rowKey="name"
            />
          </div>
        )}

        {/* Census ownership by ZIP */}
        {censusByZip.length > 0 && (
          <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">
              Ownership by ZIP
            </h3>
            <p className="text-xs text-[#6B6B60] mb-3">
              Per-ZIP ownership counts. Reviewed % = share of offices in that ZIP with a
              reviewed ownership answer.
            </p>
            <DataTable
              data={censusByZip}
              columns={[
                { key: 'zip', header: 'ZIP' },
                { key: 'city', header: 'City' },
                {
                  key: 'total',
                  header: 'Offices',
                  render: (v: number | null) => (v != null ? v.toLocaleString() : '--'),
                },
                {
                  key: 'solo_owner',
                  header: 'True Independent',
                  render: (v: number | null) => (v != null ? v.toLocaleString() : '--'),
                },
                {
                  key: 'dentist_owned',
                  header: 'Dentist-Owned',
                  render: (v: number | null) => (v != null ? v.toLocaleString() : '--'),
                },
                {
                  key: 'dso_pe',
                  header: 'DSO / PE',
                  render: (v: number | null) => (v != null ? v.toLocaleString() : '--'),
                },
                {
                  key: 'unresolved',
                  header: 'Unresolved',
                  render: (v: number | null) => (v != null ? v.toLocaleString() : '--'),
                },
                {
                  key: 'reviewed_pct',
                  header: 'Coverage %',
                  render: (v: number | null) => (v != null ? `${Number(v).toFixed(0)}%` : '--'),
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
