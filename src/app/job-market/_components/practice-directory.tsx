'use client'

import React from 'react'
import { useState, useMemo, useCallback } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { SearchInput } from '@/components/filters/search-input'
import { FilterGroup, MultiSelect } from '@/components/filters/filter-bar'
import { DataTable } from '@/components/data-display/data-table'
import { StatusBadge } from '@/components/data-display/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PracticeDetailDrawer } from './practice-detail-drawer'
import { exportToCsv } from '@/lib/utils/csv-export'
import { getEntityClassificationLabel } from '@/lib/constants/entity-classifications'
import { formatStatusLabel } from '@/lib/utils/formatting'

import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PracticeDirectoryProps {
  practices: Practice[]  // Already has job_opp_score computed
  allPractices: Practice[]  // For cross-reference (same-address lookup etc.)
}

type SortOption = 'job_score' | 'buyability' | 'employees' | 'year_est' | 'name'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'job_score', label: 'Job Opp Score \u2193' },
  { value: 'buyability', label: 'Buyability \u2193' },
  { value: 'employees', label: 'Employees \u2193' },
  { value: 'year_est', label: 'Year Est. \u2191' },
  { value: 'name', label: 'Name A-Z' },
]

const PAGE_SIZE = 100

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function isDataAxle(p: Practice): boolean {
  return (p.import_batch_id ?? '').startsWith('DA_')
}

function matchesSearch(p: Practice, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  return (
    (p.practice_name ?? '').toLowerCase().includes(t) ||
    (p.doing_business_as ?? '').toLowerCase().includes(t) ||
    (p.address ?? '').toLowerCase().includes(t) ||
    (p.city ?? '').toLowerCase().includes(t) ||
    (p.affiliated_dso ?? '').toLowerCase().includes(t)
  )
}

function sortPractices(list: Practice[], sortBy: SortOption): Practice[] {
  const sorted = [...list]
  switch (sortBy) {
    case 'job_score':
      return sorted.sort(
        (a, b) => ((b as any).job_opp_score ?? 0) - ((a as any).job_opp_score ?? 0)
      )
    case 'buyability':
      return sorted.sort(
        (a, b) => (Number(b.buyability_score) || 0) - (Number(a.buyability_score) || 0)
      )
    case 'employees':
      return sorted.sort(
        (a, b) => (Number(b.employee_count) || 0) - (Number(a.employee_count) || 0)
      )
    case 'year_est':
      return sorted.sort(
        (a, b) => (Number(a.year_established) || 9999) - (Number(b.year_established) || 9999)
      )
    case 'name':
      return sorted.sort((a, b) =>
        (a.practice_name ?? '').localeCompare(b.practice_name ?? '')
      )
    default:
      return sorted
  }
}

function classificationLabel(ec: unknown): string {
  if (ec == null || typeof ec !== 'string' || !ec) return '--'
  return ec.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

/** Compute data quality stars string for a practice */
function computeDataQuality(p: Practice): string {
  const isDA = (p.import_batch_id ?? '').startsWith('DA_')
  const hasEC = !!p.entity_classification && p.entity_classification.trim() !== ''
  if (isDA) return '\u2605\u2605\u2605'
  if (hasEC) return '\u2605\u2605'
  return '\u2605'
}

/** Render gold-colored confidence stars */
function renderDataQualityStars(v: string): React.ReactElement {
  return React.createElement('span', {
    style: { color: '#F59E0B', letterSpacing: '1px' },
    title: v === '\u2605\u2605\u2605' ? 'Data Axle enriched' : v === '\u2605\u2605' ? 'Entity classified' : 'NPPES only',
  }, v || '\u2605')
}

// ────────────────────────────────────────────────────────────────────────────
// Table columns
// ────────────────────────────────────────────────────────────────────────────

const EMPLOYMENT_COLUMNS = [
  { key: 'practice_name', header: 'Practice Name' },
  { key: 'address', header: 'Address' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  { key: 'city', header: 'City' },
  { key: 'employee_count', header: 'Employees', render: (v: number | null) => v ?? '--' },
  {
    key: 'entity_classification',
    header: 'Entity Type',
    render: (v: string) => classificationLabel(v),
  },
  { key: 'affiliated_dso', header: 'DSO', render: (v: string | null) => v || '--' },
  { key: 'job_opp_score', header: 'Job Score', render: (v: number | null) => v ?? '--' },
  { key: 'data_quality', header: 'Data', render: (v: string) => renderDataQualityStars(v) },
]

const OWNERSHIP_COLUMNS = [
  { key: 'practice_name', header: 'Practice Name' },
  { key: 'address', header: 'Address' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  { key: 'city', header: 'City' },
  {
    key: 'year_established',
    header: 'Year Est.',
    render: (v: number | null) => (v ? Math.floor(Number(v)) : '--'),
  },
  {
    key: 'buyability_score',
    header: 'Buyability',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  {
    key: 'classification_confidence',
    header: 'Confidence',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  {
    key: 'entity_classification',
    header: 'Classification',
    render: (v: string) => classificationLabel(v),
  },
  { key: 'data_quality', header: 'Data', render: (v: string) => renderDataQualityStars(v) },
]

const ENRICHED_COLUMNS = [
  { key: 'practice_name', header: 'Practice Name' },
  { key: 'address', header: 'Address' },
  { key: 'city', header: 'City' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  {
    key: 'entity_classification',
    header: 'Classification',
    render: (v: string) => classificationLabel(v),
  },
  { key: 'affiliated_dso', header: 'DSO', render: (v: string | null) => v || '--' },
  { key: 'employee_count', header: 'Employees', render: (v: number | null) => v ?? '--' },
  {
    key: 'estimated_revenue',
    header: 'Revenue',
    render: (v: number | null) =>
      v != null ? `$${Number(v).toLocaleString()}` : '--',
  },
  {
    key: 'year_established',
    header: 'Year Est.',
    render: (v: number | null) => (v ? Math.floor(Number(v)) : '--'),
  },
  {
    key: 'buyability_score',
    header: 'Buyability',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  { key: 'job_opp_score', header: 'Job Score', render: (v: number | null) => v ?? '--' },
  { key: 'website', header: 'Website', render: (v: string | null) => v || '--' },
  { key: 'data_quality', header: 'Data', render: (v: string) => renderDataQualityStars(v) },
]

const ALL_COLUMNS = [
  { key: 'practice_name', header: 'Practice Name' },
  { key: 'city', header: 'City' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  {
    key: 'entity_classification',
    header: 'Classification',
    render: (v: string) => classificationLabel(v),
  },
  { key: 'affiliated_dso', header: 'DSO', render: (v: string | null) => v || '--' },
  { key: 'employee_count', header: 'Employees', render: (v: number | null) => v ?? '--' },
  {
    key: 'year_established',
    header: 'Year Est.',
    render: (v: number | null) => (v ? Math.floor(Number(v)) : '--'),
  },
  {
    key: 'buyability_score',
    header: 'Buyability',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  { key: 'job_opp_score', header: 'Job Score', render: (v: number | null) => v ?? '--' },
  { key: 'data_quality', header: 'Data', render: (v: string) => renderDataQualityStars(v) },
]

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDirectory({ practices, allPractices }: PracticeDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>(['All'])
  const [sortBy, setSortBy] = useState<SortOption>('job_score')
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null)
  const [page, setPage] = useState(1)

  const totalPractices = practices.length
  const enrichedCount = useMemo(
    () => practices.filter(isDataAxle).length,
    [practices]
  )
  const enrichmentPct = totalPractices > 0 ? (enrichedCount / totalPractices) * 100 : 0

  // Get unique classification values for filter
  const classificationOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of practices) {
      set.add((p.entity_classification ?? '').trim().toLowerCase() || 'unknown')
    }
    return Array.from(set).sort()
  }, [practices])

  // Apply filters
  const filtered = useMemo(() => {
    let result = practices

    // Search
    if (searchTerm) {
      result = result.filter((p) => matchesSearch(p, searchTerm))
    }

    // Classification filter
    if (selectedStatuses.length > 0) {
      result = result.filter((p) =>
        selectedStatuses.includes((p.entity_classification ?? '').trim().toLowerCase() || 'unknown')
      )
    }

    // Source filter
    if (selectedSources.length > 0 && !selectedSources.includes('All')) {
      result = result.filter((p) => {
        if (selectedSources.includes('Data Axle (Enriched)') && isDataAxle(p)) return true
        if (selectedSources.includes('NPPES') && !isDataAxle(p)) return true
        return false
      })
    }

    // Sort
    result = sortPractices(result, sortBy)

    // Add data quality stars
    return result.map(p => ({
      ...p,
      data_quality: computeDataQuality(p),
    }))
  }, [practices, searchTerm, selectedStatuses, selectedSources, sortBy])

  const filteredEnriched = useMemo(
    () => filtered.filter(isDataAxle).length,
    [filtered]
  )

  // Tab-specific datasets
  const employmentPractices = useMemo(() => {
    return filtered.filter((p) => {
      const emp = Number(p.employee_count) || 0
      if (emp >= 10) return true
      const ec = p.entity_classification
      return ec === 'large_group' || ec === 'dso_national' || ec === 'dso_regional'
    }).sort((a, b) => (Number(b.employee_count) || 0) - (Number(a.employee_count) || 0))
  }, [filtered])

  const ownershipPractices = useMemo(() => {
    return filtered.filter((p) => {
      const ec = p.entity_classification
      const status = (p.ownership_status ?? 'unknown').trim().toLowerCase()
      return (
        (ec === 'solo_established' || ec === 'solo_high_volume' || ec === 'solo_inactive') &&
        (status === 'independent' || status === 'likely_independent')
      )
    }).sort((a, b) => (Number(b.buyability_score) || 0) - (Number(a.buyability_score) || 0))
  }, [filtered])

  const enrichedPractices = useMemo(
    () => filtered.filter(isDataAxle),
    [filtered]
  )

  const lowEnrichmentNote =
    enrichmentPct < 20
      ? 'Limited business data available for this area. Employee counts and revenue figures may be incomplete.'
      : null

  // Pagination
  const paginatedData = useCallback(
    (data: Practice[]) => {
      const start = (page - 1) * PAGE_SIZE
      return data.slice(start, start + PAGE_SIZE)
    },
    [page]
  )

  const handleRowClick = (practice: Practice) => {
    setSelectedPractice(practice)
  }

  const handleDownloadCsv = () => {
    const downloadCols = [
      'practice_name',
      'address',
      'city',
      'zip',
      'ownership_status',
      'affiliated_dso',
      'employee_count',
      'estimated_revenue',
      'year_established',
      'buyability_score',
      'job_opp_score',
      'parent_company',
      'website',
      'data_source',
    ]
    const headerMap: Record<string, string> = {
      practice_name: 'Practice Name',
      address: 'Address',
      city: 'City',
      zip: 'ZIP',
      ownership_status: 'Status',
      affiliated_dso: 'DSO',
      employee_count: 'Employees',
      estimated_revenue: 'Revenue',
      year_established: 'Year Est.',
      buyability_score: 'Buyability',
      job_opp_score: 'Job Score',
      parent_company: 'Parent Company',
      website: 'Website',
      data_source: 'Data Source',
    }

    exportToCsv(
      filtered as unknown as Record<string, unknown>[],
      downloadCols,
      headerMap,
      'practice_directory.csv'
    )
  }

  return (
    <div>
      <SectionHeader
        title="Practice Directory"
        helpText="Browse and search all practices in the commutable zone. Use the dual-lens tabs to focus on employment opportunities or ownership pipeline targets."
      />

      {/* Search & Filters */}
      <div className="mt-4 space-y-3">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by name, address, city, or DSO..."
          debounceMs={300}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterGroup label="Classification">
            <MultiSelect
              options={classificationOptions}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="All Statuses"
            />
          </FilterGroup>
          <FilterGroup label="Data Source">
            <MultiSelect
              options={['All', 'Data Axle (Enriched)', 'NPPES']}
              selected={selectedSources}
              onChange={setSelectedSources}
              placeholder="All Sources"
            />
          </FilterGroup>
          <div>
            <label className="text-xs font-medium text-[#94A3B8] block mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption)
                setPage(1)
              }}
              className="w-full rounded-md border border-[#1E293B] bg-[#0F1629] text-[#F8FAFC] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-[#7eb8e0]">
          Showing <strong>{filtered.length.toLocaleString()}</strong> of{' '}
          <strong>{totalPractices.toLocaleString()}</strong> practices |{' '}
          <strong>{filteredEnriched.toLocaleString()}</strong> enriched by Data Axle
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employment" className="mt-4">
        <TabsList className="bg-[#0F1629] border border-[#1E293B]">
          <TabsTrigger value="employment">Employment Opportunities</TabsTrigger>
          <TabsTrigger value="ownership">Ownership Pipeline</TabsTrigger>
          <TabsTrigger value="enriched">Enriched Practices (Data Axle)</TabsTrigger>
          <TabsTrigger value="all">All Practices</TabsTrigger>
        </TabsList>

        <TabsContent value="employment">
          <p className="text-sm text-[#94A3B8] mb-2">
            Practices with high patient volume that are likely hiring associates.
          </p>
          {lowEnrichmentNote && (
            <p className="text-xs text-[#F59E0B] mb-2">Warning: {lowEnrichmentNote}</p>
          )}
          {employmentPractices.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No practices matching employment opportunity criteria in the current filters.
            </div>
          ) : (
            <>
              <DataTable
                data={paginatedData(employmentPractices)}
                columns={EMPLOYMENT_COLUMNS}
                onRowClick={handleRowClick}
                rowKey="npi"
              />
              <p className="text-xs text-[#94A3B8] mt-2">
                {employmentPractices.length} practices match employment criteria
              </p>
              <Pagination
                total={employmentPractices.length}
                page={page}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="ownership">
          <p className="text-sm text-[#94A3B8] mb-2">
            Independent practices with indicators suggesting the owner may be approaching transition.
          </p>
          {lowEnrichmentNote && (
            <p className="text-xs text-[#F59E0B] mb-2">Warning: {lowEnrichmentNote}</p>
          )}
          {ownershipPractices.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No practices matching ownership pipeline criteria in the current filters.
            </div>
          ) : (
            <>
              <DataTable
                data={paginatedData(ownershipPractices)}
                columns={OWNERSHIP_COLUMNS}
                onRowClick={handleRowClick}
                rowKey="npi"
              />
              <p className="text-xs text-[#94A3B8] mt-2">
                {ownershipPractices.length} practices match ownership pipeline criteria
              </p>
              <Pagination
                total={ownershipPractices.length}
                page={page}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="enriched">
          {enrichedPractices.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No Data Axle-enriched practices match the current filters.
            </div>
          ) : (
            <>
              {enrichedPractices.length > 500 && (
                <p className="text-xs text-[#7eb8e0] mb-2">
                  Showing first 500 of {enrichedPractices.length.toLocaleString()} enriched
                  practices. Download CSV for full list.
                </p>
              )}
              <DataTable
                data={paginatedData(enrichedPractices)}
                columns={ENRICHED_COLUMNS}
                onRowClick={handleRowClick}
                rowKey="npi"
              />
              <Pagination
                total={enrichedPractices.length}
                page={page}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="all">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
              No practices match the current filters.
            </div>
          ) : (
            <>
              {filtered.length > 500 && (
                <p className="text-xs text-[#7eb8e0] mb-2">
                  Showing first 500 of {filtered.length.toLocaleString()} practices. Download CSV
                  for full list.
                </p>
              )}
              <DataTable
                data={paginatedData(filtered)}
                columns={ALL_COLUMNS}
                onRowClick={handleRowClick}
                rowKey="npi"
              />
              <Pagination
                total={filtered.length}
                page={page}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Download CSV */}
      <div className="mt-4">
        <button
          onClick={handleDownloadCsv}
          className="inline-flex items-center gap-2 rounded-md border border-[#1E293B] bg-[#0F1629] px-4 py-2 text-sm text-[#F8FAFC] hover:border-[#334155] hover:bg-[#1A2035] transition-colors"
        >
          <DownloadIcon />
          Download filtered practices (CSV)
        </button>
      </div>

      {/* Practice Detail Drawer */}
      <PracticeDetailDrawer
        practice={selectedPractice}
        allPractices={allPractices}
        onClose={() => setSelectedPractice(null)}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Pagination sub-component
// ────────────────────────────────────────────────────────────────────────────

function Pagination({
  total,
  page,
  pageSize,
  onChange,
}: {
  total: number
  page: number
  pageSize: number
  onChange: (page: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-3">
      <p className="text-xs text-[#94A3B8]">
        Page {page} of {totalPages} ({total.toLocaleString()} total)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded border border-[#1E293B] bg-[#0F1629] px-3 py-1 text-xs text-[#F8FAFC] disabled:opacity-40 hover:border-[#334155] transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded border border-[#1E293B] bg-[#0F1629] px-3 py-1 text-xs text-[#F8FAFC] disabled:opacity-40 hover:border-[#334155] transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Download icon
// ────────────────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 1v9m0 0l3-3m-3 3L5 7m-3 5v1a2 2 0 002 2h8a2 2 0 002-2v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
