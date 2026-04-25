'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Download,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldOff,
  Briefcase,
  Microscope,
} from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import { StatusBadge } from '@/components/data-display/status-badge'
import {
  getEntityClassificationLabel,
  isIndependentClassification,
  isCorporateClassification,
} from '@/lib/constants/entity-classifications'
import { toCSVString } from '@/lib/utils/csv-export'
import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Category assignment — computed from actual data, not notes
// ────────────────────────────────────────────────────────────────────────────

type BuyabilityCategory =
  | 'acquisition_target'
  | 'dead_end'
  | 'job_target'
  | 'specialist'

function categorize(p: Practice): BuyabilityCategory {
  const ec = p.entity_classification ?? ''
  if (ec === 'specialist') return 'specialist'
  if (isCorporateClassification(ec)) return 'dead_end'
  if (ec === 'non_clinical') return 'dead_end'
  // Independent practices
  if (isIndependentClassification(ec) || !ec) {
    // High buyability = acquisition target
    if (p.buyability_score != null && p.buyability_score >= 50) return 'acquisition_target'
    // Large employer or group = good job target
    if (
      (p.employee_count != null && p.employee_count >= 5) ||
      ec === 'large_group' ||
      ec === 'small_group'
    )
      return 'job_target'
    // Default: acquisition target (still independent, just lower score)
    return 'acquisition_target'
  }
  return 'acquisition_target'
}

interface AnalyzedPractice extends Practice {
  category: BuyabilityCategory
  confidenceStars: string
}

function analyzePractices(practices: Practice[]): AnalyzedPractice[] {
  return practices.map((p) => ({
    ...p,
    category: categorize(p),
    confidenceStars:
      p.classification_confidence != null && p.classification_confidence > 0
        ? '\u2605'.repeat(Math.min(Math.round(p.classification_confidence / 20), 5))
        : p.buyability_score != null
          ? '\u2605'.repeat(Math.min(Math.ceil(p.buyability_score / 25), 5))
          : '\u2014',
  }))
}

// ────────────────────────────────────────────────────────────────────────────
// Sort + pagination
// ────────────────────────────────────────────────────────────────────────────

type SortField =
  | 'practice_name'
  | 'city'
  | 'zip'
  | 'buyability_score'
  | 'year_established'
  | 'employee_count'

const PAGE_SIZE = 25

const CATEGORIES: { label: string; value: BuyabilityCategory | 'all' }[] = [
  { label: 'All Categories', value: 'all' },
  { label: 'Acquisition Targets (broad)', value: 'acquisition_target' },
  { label: 'Dead Ends', value: 'dead_end' },
  { label: 'Job Targets', value: 'job_target' },
  { label: 'Specialists', value: 'specialist' },
]

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

interface BuyabilityShellProps {
  initialPractices: Practice[]
}

export function BuyabilityShell({ initialPractices }: BuyabilityShellProps) {
  const analyzed = useMemo(() => analyzePractices(initialPractices), [initialPractices])

  const [category, setCategory] = useState<BuyabilityCategory | 'all'>('all')
  const [zipFilter, setZipFilter] = useState('All ZIPs')
  const [sortField, setSortField] = useState<SortField>('buyability_score')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(0)

  // KPI counts from actual data
  const kpis = useMemo(() => {
    const acq = analyzed.filter((p) => p.category === 'acquisition_target').length
    const dead = analyzed.filter((p) => p.category === 'dead_end').length
    const job = analyzed.filter((p) => p.category === 'job_target').length
    const spec = analyzed.filter((p) => p.category === 'specialist').length
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

    if (category !== 'all') {
      result = result.filter((p) => p.category === category)
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
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return result
  }, [analyzed, category, zipFilter, sortField, sortAsc])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  )

  // Reset page on filter change
  const handleCategoryChange = useCallback((val: string) => {
    setCategory(val as BuyabilityCategory | 'all')
    setPage(0)
  }, [])
  const handleZipChange = useCallback((val: string) => {
    setZipFilter(val)
    setPage(0)
  }, [])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortAsc(!sortAsc)
      } else {
        setSortField(field)
        setSortAsc(false)
      }
      setPage(0)
    },
    [sortField, sortAsc]
  )

  // CSV download
  const handleDownload = useCallback(() => {
    const exportRows = filtered.map((p) => ({
      'Practice Name': p.practice_name ?? '',
      Address: p.address ?? '',
      City: p.city ?? '',
      ZIP: p.zip ?? '',
      Classification: getEntityClassificationLabel(p.entity_classification),
      Category: p.category,
      'Buyability Score': p.buyability_score ?? '',
      'Year Established': p.year_established ?? '',
      Employees: p.employee_count ?? '',
    }))
    const csv = toCSVString(exportRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'buyability_analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-[#8F8E82]" />
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-[#B8860B]" />
    ) : (
      <ChevronDown className="h-3 w-3 text-[#B8860B]" />
    )
  }

  const categoryColor = (cat: BuyabilityCategory) => {
    switch (cat) {
      case 'acquisition_target':
        return 'text-[#2D8B4E]'
      case 'dead_end':
        return 'text-[#C23B3B]'
      case 'job_target':
        return 'text-[#B8860B]'
      case 'specialist':
        return 'text-[#7C3AED]'
    }
  }

  const categoryLabel = (cat: BuyabilityCategory) => {
    switch (cat) {
      case 'acquisition_target':
        return 'Acq. Target'
      case 'dead_end':
        return 'Dead End'
      case 'job_target':
        return 'Job Target'
      case 'specialist':
        return 'Specialist'
    }
  }

  if (analyzed.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] p-6">
        <h1 className="font-sans font-bold text-2xl text-[#1A1A1A] mb-2">Buyability Scanner</h1>
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-8 text-center text-[#6B6B60] mt-6">
          <p className="font-medium text-[#1A1A1A] mb-2">No analyzed practices yet.</p>
          <p className="text-sm">
            Run the directory importer to load practice analysis data, or import Data Axle records
            for automated scoring.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#1A1A1A]">Buyability Scanner</h1>
          <p className="text-[#6B6B60] text-sm mt-1 max-w-3xl">
            {analyzed.length} practices scored by acquisition likelihood. Acquisition Targets =
            any independent practice (broad framework — includes lower-score independents; the
            Home page&apos;s KPI uses a stricter buyability_score ≥ 50 cutoff). Dead Ends =
            corporate/DSO. Job Targets = good associate opportunities. Specialists = ortho,
            perio, endo, etc.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<Target className="h-4 w-4" />}
            label="Acquisition Targets"
            value={kpis.acq.toLocaleString()}
            tooltip="Broad definition: any independent practice (entity_classification ∈ solo/family/group). Includes lower-buyability targets. Home page uses strict definition (independents with buyability_score ≥ 50, ~34 practices)."
            accentColor="#2D8B4E"
          />
          <KpiCard
            icon={<ShieldOff className="h-4 w-4" />}
            label="Dead Ends"
            value={kpis.dead.toLocaleString()}
            accentColor="#C23B3B"
          />
          <KpiCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Job Targets"
            value={kpis.job.toLocaleString()}
            accentColor="#B8860B"
          />
          <KpiCard
            icon={<Microscope className="h-4 w-4" />}
            label="Specialists"
            value={kpis.spec.toLocaleString()}
            accentColor="#7C3AED"
          />
        </div>

        {/* Filters */}
        <SectionHeader
          title="Practice Analysis"
          description={`Showing ${filtered.length} of ${analyzed.length} practices. Filter by category or ZIP. Sort by score to find top targets.`}
        />

        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B] min-w-[200px]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={zipFilter}
            onChange={(e) => handleZipChange(e.target.value)}
            className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B] min-w-[160px]"
          >
            {zipOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          <button
            onClick={handleDownload}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2 text-sm text-[#6B6B60] hover:text-[#1A1A1A] hover:border-[#D4D0C8] transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>

        {/* Data Table with pagination */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#E8E5DE] text-[#6B6B60] bg-[#F5F5F0]">
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('practice_name')}
                  >
                    <span className="flex items-center gap-1">
                      Practice Name <SortIcon field="practice_name" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider">
                    Address
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('city')}
                  >
                    <span className="flex items-center gap-1">
                      City <SortIcon field="city" />
                    </span>
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('zip')}
                  >
                    <span className="flex items-center gap-1">
                      ZIP <SortIcon field="zip" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider">
                    Classification
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('buyability_score')}
                  >
                    <span className="flex items-center gap-1">
                      Score <SortIcon field="buyability_score" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider">
                    Confidence
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('year_established')}
                  >
                    <span className="flex items-center gap-1">
                      Year Est. <SortIcon field="year_established" />
                    </span>
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('employee_count')}
                  >
                    <span className="flex items-center gap-1">
                      Employees <SortIcon field="employee_count" />
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-[#6B6B60]">
                      No practices match the selected filters.
                    </td>
                  </tr>
                ) : (
                  pageData.map((p, idx) => (
                    <tr
                      key={p.npi ?? idx}
                      className={`border-b border-black/[0.06] hover:bg-black/[0.04] transition-colors ${
                        idx % 2 === 0 ? 'bg-[#FAFAF7]' : 'bg-[#FFFFFF]'
                      }`}
                    >
                      <td className="px-4 py-2.5 text-[#1A1A1A] max-w-[200px] truncate">
                        {p.practice_name ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6B60] max-w-[180px] truncate text-xs">
                        {p.address ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6B60]">{p.city ?? '--'}</td>
                      <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">
                        {p.zip ?? '--'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={p.entity_classification ?? p.ownership_status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6B6B60]">
                        {getEntityClassificationLabel(p.entity_classification)}
                      </td>
                      <td className="px-4 py-2.5 text-[#1A1A1A] font-mono font-bold tabular-nums">
                        {p.buyability_score ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#D4920B] text-xs">{p.confidenceStars}</td>
                      <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">
                        {p.year_established ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">
                        {p.employee_count ?? '--'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor(p.category)} bg-current/10`}
                          style={{
                            backgroundColor:
                              p.category === 'acquisition_target'
                                ? 'rgba(45,139,78,0.1)'
                                : p.category === 'dead_end'
                                  ? 'rgba(194,59,59,0.1)'
                                  : p.category === 'job_target'
                                    ? 'rgba(184,134,11,0.1)'
                                    : 'rgba(124,58,237,0.1)',
                          }}
                        >
                          {categoryLabel(p.category)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-4 py-3 border-t border-[#E8E5DE] flex items-center justify-between">
            <span className="text-[11px] text-[#707064]">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length.toLocaleString()} practices
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#707064] hover:bg-[#F7F7F4] hover:text-[#3D3D35] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-[#707064] px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-[#E8E5DE] bg-[#F5F5F0] text-[#707064] hover:bg-[#F7F7F4] hover:text-[#3D3D35] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
