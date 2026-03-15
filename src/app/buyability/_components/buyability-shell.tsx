'use client'

import { useState, useMemo, useCallback } from 'react'
import { Download, ArrowUpDown, ChevronDown, ChevronUp, Target, ShieldOff, Briefcase, Microscope } from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import { StatusBadge } from '@/components/data-display/status-badge'
import { getEntityClassificationLabel } from '@/lib/constants/entity-classifications'
import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Verdict extraction (port from app.py lines 1447-1455)
// ────────────────────────────────────────────────────────────────────────────

function extractFromNotes(pattern: RegExp, notes: string | null | undefined): string {
  if (!notes) return '\u2014'
  const m = notes.match(pattern)
  return m ? m[1].trim() : '\u2014'
}

interface AnalyzedPractice extends Practice {
  verdict: string
  buyability_tag: string
  confidenceStars: string
}

function analyzePractices(practices: Practice[]): AnalyzedPractice[] {
  return practices.map((p) => ({
    ...p,
    verdict: extractFromNotes(/VERDICT:\s*(.+?)(?:\n|$)/, p.notes),
    buyability_tag: extractFromNotes(/Buyability:\s*(.+?)(?:\n|$)/, p.notes),
    confidenceStars:
      p.buyability_confidence != null && p.buyability_confidence > 0
        ? '\u2605'.repeat(Math.min(Math.round(p.buyability_confidence), 5))
        : '?',
  }))
}

// ────────────────────────────────────────────────────────────────────────────
// Sort config
// ────────────────────────────────────────────────────────────────────────────

type SortField =
  | 'practice_name'
  | 'city'
  | 'zip'
  | 'buyability_score'
  | 'year_established'
  | 'employee_count'

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

interface BuyabilityShellProps {
  initialPractices: Practice[]
}

const CATEGORY_MAP: Record<string, string> = {
  'Acquisition Targets': 'acquisition_target',
  'Dead Ends': 'dead_end',
  'Job Targets': 'job_target',
  Specialists: 'specialist',
}

export function BuyabilityShell({ initialPractices }: BuyabilityShellProps) {
  const analyzed = useMemo(() => analyzePractices(initialPractices), [initialPractices])

  const [category, setCategory] = useState('All')
  const [zipFilter, setZipFilter] = useState('All ZIPs')
  const [sortField, setSortField] = useState<SortField>('buyability_score')
  const [sortAsc, setSortAsc] = useState(false)

  // KPI counts
  const kpis = useMemo(() => {
    const acq = analyzed.filter((p) => p.buyability_tag === 'acquisition_target').length
    const dead = analyzed.filter((p) => p.buyability_tag === 'dead_end').length
    const job = analyzed.filter((p) => p.buyability_tag === 'job_target').length
    const spec = analyzed.filter((p) => p.buyability_tag === 'specialist').length
    return { acq, dead, job, spec }
  }, [analyzed])

  // Unique ZIPs for filter
  const zipOptions = useMemo(() => {
    const zips = Array.from(
      new Set(analyzed.map((p) => p.zip).filter(Boolean) as string[])
    ).sort()
    return ['All ZIPs', ...zips]
  }, [analyzed])

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let result = [...analyzed]

    if (category !== 'All') {
      const tag = CATEGORY_MAP[category]
      result = result.filter((p) => p.buyability_tag === tag)
    }

    if (zipFilter !== 'All ZIPs') {
      result = result.filter((p) => p.zip === zipFilter)
    }

    result.sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null

      switch (sortField) {
        case 'practice_name':
          aVal = a.practice_name ?? ''
          bVal = b.practice_name ?? ''
          break
        case 'city':
          aVal = a.city ?? ''
          bVal = b.city ?? ''
          break
        case 'zip':
          aVal = a.zip ?? ''
          bVal = b.zip ?? ''
          break
        case 'buyability_score':
          aVal = a.buyability_score ?? -Infinity
          bVal = b.buyability_score ?? -Infinity
          break
        case 'year_established':
          aVal = a.year_established ?? -Infinity
          bVal = b.year_established ?? -Infinity
          break
        case 'employee_count':
          aVal = a.employee_count ?? -Infinity
          bVal = b.employee_count ?? -Infinity
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return result
  }, [analyzed, category, zipFilter, sortField, sortAsc])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortAsc(!sortAsc)
      } else {
        setSortField(field)
        setSortAsc(false)
      }
    },
    [sortField, sortAsc]
  )

  // CSV download
  const handleDownload = useCallback(() => {
    const headers = [
      'Practice Name',
      'Address',
      'City',
      'ZIP',
      'Status',
      'Buyability Score',
      'Confidence',
      'Year Established',
      'Employee Count',
      'Verdict',
    ]
    const rows = filtered.map((p) => [
      p.practice_name ?? '',
      p.address ?? '',
      p.city ?? '',
      p.zip ?? '',
      p.ownership_status ?? '',
      p.buyability_score ?? '',
      p.confidenceStars,
      p.year_established ?? '',
      p.employee_count ?? '',
      p.verdict,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
      '\n'
    )
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'buyability_analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-[#475569]" />
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-[#3B82F6]" />
    ) : (
      <ChevronDown className="h-3 w-3 text-[#3B82F6]" />
    )
  }

  if (analyzed.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] p-6">
        <h1 className="font-sans font-bold text-2xl text-[#F8FAFC] mb-2">
          Buyability Scanner
        </h1>
        <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-8 text-center text-[#94A3B8] mt-6">
          <p className="font-medium text-[#F8FAFC] mb-2">No analyzed practices yet.</p>
          <p className="text-sm">
            Run the directory importer to load practice analysis data, or import Data Axle
            records for automated scoring.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#F8FAFC]">
            Buyability Scanner
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1 max-w-3xl">
            Practices scored by acquisition likelihood based on hand research and directory
            analysis. Acquisition Targets are practices likely buyable. Dead Ends are locked
            (dynasty, corporate, ghost). Job Targets are places to work, not buy.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<Target className="h-4 w-4" />}
            label="Acquisition Targets"
            value={kpis.acq.toLocaleString()}
            accentColor="#22C55E"
          />
          <KpiCard
            icon={<ShieldOff className="h-4 w-4" />}
            label="Dead Ends"
            value={kpis.dead.toLocaleString()}
            accentColor="#EF4444"
          />
          <KpiCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Job Targets"
            value={kpis.job.toLocaleString()}
            accentColor="#3B82F6"
          />
          <KpiCard
            icon={<Microscope className="h-4 w-4" />}
            label="Specialists"
            value={kpis.spec.toLocaleString()}
            accentColor="#7C4DFF"
          />
        </div>

        {/* Section Header + Filters */}
        <SectionHeader
          title="Analyzed Practices"
          description="Practices with hand-researched verdicts and/or buyability scores. Filter by category and ZIP code to find acquisition targets. Sort by score descending to see the most buyable practices first."
        />

        <div className="flex flex-wrap gap-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-[#1E293B] bg-[#0F1629] text-[#F8FAFC] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[200px]"
          >
            <option value="All">All Categories</option>
            <option value="Acquisition Targets">Acquisition Targets</option>
            <option value="Dead Ends">Dead Ends</option>
            <option value="Job Targets">Job Targets</option>
            <option value="Specialists">Specialists</option>
          </select>

          <select
            value={zipFilter}
            onChange={(e) => setZipFilter(e.target.value)}
            className="rounded-md border border-[#1E293B] bg-[#0F1629] text-[#F8FAFC] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[160px]"
          >
            {zipOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          <button
            onClick={handleDownload}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#0F1629] px-3 py-2 text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334155] transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>

        {/* Data Table */}
        <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B] text-[#94A3B8]">
                  <th
                    className="text-left px-4 py-2.5 font-medium text-xs cursor-pointer hover:text-[#F8FAFC]"
                    onClick={() => handleSort('practice_name')}
                  >
                    <span className="flex items-center gap-1">
                      Practice Name <SortIcon field="practice_name" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Address</th>
                  <th
                    className="text-left px-4 py-2.5 font-medium text-xs cursor-pointer hover:text-[#F8FAFC]"
                    onClick={() => handleSort('city')}
                  >
                    <span className="flex items-center gap-1">
                      City <SortIcon field="city" />
                    </span>
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-medium text-xs cursor-pointer hover:text-[#F8FAFC]"
                    onClick={() => handleSort('zip')}
                  >
                    <span className="flex items-center gap-1">
                      ZIP <SortIcon field="zip" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Classification</th>
                  <th
                    className="text-left px-4 py-2.5 font-medium text-xs cursor-pointer hover:text-[#F8FAFC]"
                    onClick={() => handleSort('buyability_score')}
                  >
                    <span className="flex items-center gap-1">
                      Score <SortIcon field="buyability_score" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Confidence</th>
                  <th
                    className="text-left px-4 py-2.5 font-medium text-xs cursor-pointer hover:text-[#F8FAFC]"
                    onClick={() => handleSort('year_established')}
                  >
                    <span className="flex items-center gap-1">
                      Year Est. <SortIcon field="year_established" />
                    </span>
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-medium text-xs cursor-pointer hover:text-[#F8FAFC]"
                    onClick={() => handleSort('employee_count')}
                  >
                    <span className="flex items-center gap-1">
                      Employees <SortIcon field="employee_count" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-[#94A3B8]">
                      No practices match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => (
                    <tr
                      key={p.npi ?? idx}
                      className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[#F8FAFC] max-w-[200px] truncate">
                        {p.practice_name ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#94A3B8] max-w-[180px] truncate text-xs">
                        {p.address ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#94A3B8]">{p.city ?? '--'}</td>
                      <td className="px-4 py-2.5 text-[#94A3B8] font-mono text-xs">
                        {p.zip ?? '--'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={p.ownership_status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#94A3B8]">
                          {getEntityClassificationLabel(p.entity_classification)}
                        </td>
                      <td className="px-4 py-2.5 text-[#F8FAFC] font-mono font-bold tabular-nums">
                        {p.buyability_score ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#F59E0B] text-xs">
                        {p.confidenceStars}
                      </td>
                      <td className="px-4 py-2.5 text-[#94A3B8] font-mono text-xs">
                        {p.year_established ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#94A3B8] font-mono text-xs">
                        {p.employee_count ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#94A3B8] max-w-[200px] truncate text-xs">
                        {p.verdict}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-[#1E293B] text-xs text-[#94A3B8]">
            Showing {filtered.length.toLocaleString()} of {analyzed.length.toLocaleString()} practices
          </div>
        </div>
      </div>
    </div>
  )
}
