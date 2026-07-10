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
import { HeadlineKpiCard } from '@/components/data-display/headline-kpi-card'
import { acquisitionLeadsBroadStat } from '@/lib/census/headline-stats'
import { SectionHeader } from '@/components/data-display/section-header'
import { CensusBadge } from '@/components/data-display/census-badge'
import { BUCKET_META, tierToBucket } from '@/lib/census/ownership-truth'
import {
  getEntityClassificationLabel,
  isCorporateClassification,
} from '@/lib/constants/entity-classifications'
import { toCSVString } from '@/lib/utils/csv-export'
import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Category assignment — the reviewed census tier is the basis (§7.1). The
// candidate set is census T1/T2 (solo owner-operated + dentist-owned
// single-location). Rows without a reviewed tier are quarantined as
// "unreviewed" — they never rank as acquisition targets, no matter what the
// older automated classification or score said.
// ────────────────────────────────────────────────────────────────────────────

type BuyabilityCategory =
  | 'acquisition_target'
  | 'dead_end'
  | 'job_target'
  | 'specialist'
  | 'unreviewed'

function categorize(p: Practice): BuyabilityCategory {
  // Hand-reviewed rows: the census tier decides, the old detector never does.
  if (p.ownership_tier) {
    const bucket = tierToBucket(p.ownership_tier)
    if (bucket === 'dso_pe_corporate' || bucket === 'institutional') return 'dead_end'
    // Dentist-owned multi-location: a deal would involve the network, not
    // this one site — keep it out of the single-site candidate set.
    if (p.ownership_tier === 'dentist_multi') return 'job_target'
    // T1 true_independent / T2 single_loc_group — the reviewed candidate set
    if (bucket !== 'unresolved') return 'acquisition_target'
  }
  // Not reviewed yet: the older automated classification may still rule a
  // row OUT (specialist / corporate / non-clinical), but never rules one IN.
  const ec = p.entity_classification ?? ''
  if (ec === 'specialist') return 'specialist'
  if (isCorporateClassification(ec) || ec === 'non_clinical') return 'dead_end'
  return 'unreviewed'
}

interface AnalyzedPractice extends Practice {
  category: BuyabilityCategory
  censusConfidence: string
}

// Hand-review confidence from the census (`ownership_confidence`), shown only
// for reviewed rows. Replaces the old star rating, which mixed two unrelated
// automated scores (classification_confidence, buyability_score) into a fake
// confidence signal.
function censusConfidenceLabel(p: Practice): string {
  if (!p.ownership_tier) return '\u2014'
  const c = p.ownership_confidence?.toLowerCase()
  if (c === 'high') return 'High'
  if (c === 'medium') return 'Medium'
  if (c === 'low') return 'Low'
  return 'Reviewed'
}

function analyzePractices(practices: Practice[]): AnalyzedPractice[] {
  return practices.map((p) => ({
    ...p,
    category: categorize(p),
    censusConfidence: censusConfidenceLabel(p),
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
  { label: 'Acquisition Leads (reviewed dentist-owned)', value: 'acquisition_target' },
  { label: 'Dead Ends', value: 'dead_end' },
  { label: 'Job Targets', value: 'job_target' },
  { label: 'Specialists', value: 'specialist' },
  { label: 'Needs Ownership Answer', value: 'unreviewed' },
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
    const unrev = analyzed.filter((p) => p.category === 'unreviewed').length
    return { acq, dead, job, spec, unrev }
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
      'Reviewed Ownership': p.ownership_tier ? BUCKET_META[tierToBucket(p.ownership_tier)].label : '',
      'Census Confidence': p.censusConfidence === '—' ? '' : p.censusConfidence,
      'Older Automated Classification': getEntityClassificationLabel(p.entity_classification),
      Category: p.category,
      'Legacy Buyability Score': p.buyability_score ?? '',
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
      case 'unreviewed':
        return 'text-[#6B7280]'
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
      case 'unreviewed':
        return 'Needs Answer'
    }
  }

  if (analyzed.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] p-6">
        <h1 className="font-sans font-bold text-2xl text-[#1A1A1A] mb-2">Acquisition Scout</h1>
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
          <h1 className="font-sans font-bold text-2xl text-[#1A1A1A]">Acquisition Scout</h1>
          <p className="text-[#6B6B60] text-sm mt-1 max-w-3xl">
            {analyzed.length} practices in the scout queue. Candidate lanes come from
            hand-reviewed ownership: solo owner-operated and dentist-owned single-location
            offices qualify, reviewed DSO/PE and institutional rows are dead ends, and
            not-reviewed rows stay quarantined until the census reaches them. The older
            automated score is a sort hint, not a verdict.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Canonical reviewed-leads headline (lib/census/headline-stats) — its
              tooltip names Home's high-score card by definition, never by count. */}
          <HeadlineKpiCard
            stat={acquisitionLeadsBroadStat(kpis.acq)}
            icon={<Target className="h-4 w-4" />}
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
          <KpiCard
            icon={<ShieldOff className="h-4 w-4" />}
            label="Needs Ownership Answer"
            value={kpis.unrev.toLocaleString()}
            accentColor="#6B7280"
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
                    Reviewed Ownership
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider"
                    title="Classification from the older automated importer — not the hand-reviewed census"
                  >
                    Older Auto Class
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A]"
                    onClick={() => handleSort('buyability_score')}
                    title="Older automated buyability score — a sort hint, not a verdict"
                  >
                    <span className="flex items-center gap-1">
                      Legacy Score <SortIcon field="buyability_score" />
                    </span>
                  </th>
                  <th
                    className="text-left px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wider"
                    title="Hand-review confidence from the ownership census (blank until a row is reviewed)"
                  >
                    Census Confidence
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
                        {p.doing_business_as ?? p.practice_name ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6B60] max-w-[180px] truncate text-xs">
                        {p.address ?? '--'}
                      </td>
                      <td className="px-4 py-2.5 text-[#6B6B60]">{p.city ?? '--'}</td>
                      <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">
                        {p.zip ?? '--'}
                      </td>
                      <td className="px-4 py-2.5">
                        <CensusBadge tier={p.ownership_tier} peBacked={p.pe_backed} compact />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6B6B60]">
                        {getEntityClassificationLabel(p.entity_classification)}
                      </td>
                      <td className="px-4 py-2.5 text-[#1A1A1A] font-mono font-bold tabular-nums">
                        {p.buyability_score ?? '--'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-xs font-medium ${
                          p.censusConfidence === 'High'
                            ? 'text-[#2D8B4E]'
                            : p.censusConfidence === '—'
                              ? 'text-[#9C9C90]'
                              : 'text-[#D4920B]'
                        }`}
                      >
                        {p.censusConfidence}
                      </td>
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
                                    : p.category === 'unreviewed'
                                      ? 'rgba(107,114,128,0.1)'
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
