'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowUpRight, Building2, Network, Search, Users } from 'lucide-react'
import { CensusBadge } from '@/components/data-display/census-badge'
import { TIER_META, formatNetworkId } from '@/lib/census/ownership-truth'
import { displayName } from '@/lib/census/display-name'
import type { Practice } from '@/lib/types'

interface ConsolidatedPracticeTreeProps {
  practices: Practice[]
}

type GroupKind = 'dentist_consolidated' | 'dso_pe'

interface ConsolidatedGroup {
  id: string
  label: string
  kind: GroupKind
  rows: Practice[]
  cityCount: number
  evidenceCount: number
  peBacked: boolean
  tierCounts: Record<string, number>
}

function displayPracticeName(p: Practice): string {
  return displayName(p)
}

function parseEvidenceUrlCount(value: string | null | undefined): number {
  if (!value) return 0
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((u) => typeof u === 'string' && u.startsWith('http')).length
  } catch {
    // fallback below
  }
  return (value.match(/https?:\/\//g) ?? []).length
}

function tierLabel(tier: string | null | undefined): string {
  if (!tier) return 'Not reviewed'
  return TIER_META[tier as keyof typeof TIER_META]?.shortLabel ?? tier.replace(/_/g, ' ')
}

function buildGroups(practices: Practice[]): ConsolidatedGroup[] {
  const relevant = practices.filter((p) =>
    p.network_id &&
    (p.ownership_tier === 'dentist_multi' ||
      p.ownership_tier === 'stealth_dso' ||
      p.ownership_tier === 'branded_dso')
  )
  const byNetwork = new Map<string, Practice[]>()
  for (const row of relevant) {
    const id = row.network_id!
    const list = byNetwork.get(id) ?? []
    list.push(row)
    byNetwork.set(id, list)
  }

  return Array.from(byNetwork.entries())
    .map(([id, rows]) => {
      const tierCounts: Record<string, number> = {}
      for (const row of rows) {
        const tier = row.ownership_tier ?? 'unreviewed'
        tierCounts[tier] = (tierCounts[tier] ?? 0) + 1
      }
      const dsoRows = rows.filter((row) => row.ownership_tier === 'stealth_dso' || row.ownership_tier === 'branded_dso')
      const kind: GroupKind = dsoRows.length > 0 ? 'dso_pe' : 'dentist_consolidated'
      const cityCount = new Set(rows.map((r) => r.city).filter(Boolean)).size
      return {
        id,
        label: formatNetworkId(id),
        kind,
        rows: rows.sort((a, b) =>
          `${a.city ?? ''} ${displayPracticeName(a)}`.localeCompare(`${b.city ?? ''} ${displayPracticeName(b)}`)
        ),
        cityCount,
        evidenceCount: rows.reduce((sum, row) => sum + parseEvidenceUrlCount(row.ownership_evidence_urls), 0),
        peBacked: rows.some((row) => row.pe_backed === true),
        tierCounts,
      }
    })
    .filter((group) => group.rows.length >= 2)
    .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label))
}

export function ConsolidatedPracticeTree({ practices }: ConsolidatedPracticeTreeProps) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | GroupKind>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const groups = useMemo(() => buildGroups(practices), [practices])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups.filter((group) => {
      if (kind !== 'all' && group.kind !== kind) return false
      if (!q) return true
      return (
        group.label.toLowerCase().includes(q) ||
        group.rows.some((row) =>
          [displayPracticeName(row), row.city, row.zip, row.address]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      )
    })
  }, [groups, kind, query])

  const selected = filtered.find((group) => group.id === selectedId) ?? filtered[0] ?? null
  const totalOffices = groups.reduce((sum, group) => sum + group.rows.length, 0)
  const dsoGroups = groups.filter((group) => group.kind === 'dso_pe').length
  const dentistGroups = groups.filter((group) => group.kind === 'dentist_consolidated').length

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Consolidated practice tree</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6B6B60]">
            A map of reviewed multi-office owners and DSO/PE operators in Chicagoland.
            Counts are reviewed offices only; use this as the live tree, not as proof that a group is complete.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All groups'],
            ['dentist_consolidated', 'Dentist consolidated'],
            ['dso_pe', 'DSO / PE'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value as typeof kind)}
              className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                kind === value
                  ? 'border-[#B8860B] bg-[#FFF7E5] text-[#8B6508]'
                  : 'border-[#E8E5DE] bg-white text-[#6B6B60] hover:bg-[#F7F7F4]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TreeStat icon={<Network className="h-4 w-4" />} label="Consolidators" value={groups.length.toLocaleString()} />
        <TreeStat icon={<Building2 className="h-4 w-4" />} label="Reviewed offices" value={totalOffices.toLocaleString()} />
        <TreeStat icon={<Users className="h-4 w-4" />} label="Dentist groups" value={dentistGroups.toLocaleString()} />
        <TreeStat icon={<Building2 className="h-4 w-4" />} label="DSO / PE groups" value={dsoGroups.toLocaleString()} />
      </div>

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9C9C90]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search owner, DSO, practice, city, or ZIP..."
          className="w-full rounded-md border border-[#E8E5DE] bg-white py-2 pl-9 pr-3 text-sm text-[#1A1A1A] outline-none focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/15"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {filtered.slice(0, 80).map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedId(group.id)}
              className={`w-full rounded-lg border bg-white p-4 text-left transition-colors ${
                selected?.id === group.id
                  ? 'border-[#B8860B] shadow-sm'
                  : 'border-[#E8E5DE] hover:border-[#D4D0C8]'
              }`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">{group.label}</h3>
                    {group.peBacked ? (
                      <span className="rounded-full bg-[#1A1A1A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1A1A1A]">
                        PE
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        group.kind === 'dso_pe'
                          ? 'bg-[#FEF2F2] text-[#B91C1C]'
                          : 'bg-[#EEF2FF] text-[#4F46E5]'
                      }`}
                    >
                      {group.kind === 'dso_pe' ? 'DSO / PE' : 'Dentist consolidated'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6B6B60]">
                    {group.rows.length} reviewed offices · {group.cityCount} cities · {group.evidenceCount} evidence URLs
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  {Object.entries(group.tierCounts).map(([tier, count]) => (
                    <span key={tier} className="rounded bg-[#F7F7F4] px-2 py-1 text-[11px] text-[#6B6B60]">
                      {tierLabel(tier)} {count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.rows.slice(0, 5).map((row) => (
                  <span key={row.location_id ?? row.npi} className="rounded-md bg-[#FAFAF7] px-2 py-1 text-[11px] text-[#6B6B60]">
                    {displayPracticeName(row)} · {row.city}
                  </span>
                ))}
                {group.rows.length > 5 ? (
                  <span className="rounded-md bg-[#FAFAF7] px-2 py-1 text-[11px] text-[#9C9C90]">
                    +{group.rows.length - 5} more
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        <aside className="rounded-lg border border-[#E8E5DE] bg-white p-4">
          {selected ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-[#1A1A1A]">{selected.label}</h3>
                <span className="text-xs text-[#6B6B60]">{selected.rows.length} offices</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#6B6B60]">
                This panel lists the exact reviewed offices currently assigned to this owner/group.
                If you know the group is larger, queue a correction from an office page so it can be researched and merged safely.
              </p>
              <div className="mt-4 max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {selected.rows.map((row) => (
                  <div key={row.location_id ?? row.npi} className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={row.location_id ? `/practice/${row.location_id}` : '#'}
                          className="font-medium text-[#1A1A1A] hover:text-[#8B6508]"
                        >
                          {displayPracticeName(row)}
                        </Link>
                        <p className="mt-1 text-xs text-[#6B6B60]">
                          {[row.address, row.city, row.zip].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <CensusBadge tier={row.ownership_tier} peBacked={row.pe_backed} compact />
                    </div>
                    {row.ownership_evidence_basis ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6B6B60]">
                        {row.ownership_evidence_basis}
                      </p>
                    ) : null}
                    {row.location_id ? (
                      <Link
                        href={`/practice/${row.location_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#8B6508] hover:text-[#1A1A1A]"
                      >
                        Open record <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B6B60]">No consolidated groups match the current filters.</p>
          )}
        </aside>
      </div>
    </section>
  )
}

function TreeStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-white p-4">
      <div className="flex items-center gap-2 text-[#6B6B60]">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-mono text-2xl font-bold text-[#1A1A1A]">{value}</div>
    </div>
  )
}
