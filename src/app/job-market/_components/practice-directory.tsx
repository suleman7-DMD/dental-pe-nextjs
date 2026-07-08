'use client'

import React from 'react'
import Link from 'next/link'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { SearchInput } from '@/components/filters/search-input'
import { FilterGroup, MultiSelect } from '@/components/filters/filter-bar'
import { DataTable } from '@/components/data-display/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PracticeDetailDrawer } from './practice-detail-drawer'
import { ArrowUpRight, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/utils/csv-export'
import { CensusBadge } from '@/components/data-display/census-badge'
import {
  BUCKET_META,
  HEADLINE_BUCKETS,
  OWNERSHIP_TIERS,
  TIER_CODE,
  TIER_META,
  formatNetworkId,
  tierToBucket,
} from '@/lib/census/ownership-truth'
import { displayName as practiceDisplayName } from '@/lib/census/display-name'
import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PracticeDirectoryProps {
  practices: Practice[]  // Already has job_opp_score computed
  allPractices: Practice[]  // For cross-reference (same-address lookup etc.)
}

type SortOption = 'job_score' | 'buyability' | 'employees' | 'year_est' | 'name'
type PracticeWithJobScore = Practice & { job_opp_score?: number | null }

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'job_score', label: 'Hiring signal \u2193' },
  { value: 'buyability', label: 'Acquisition lead score \u2193' },
  { value: 'employees', label: 'Staff size \u2193' },
  { value: 'year_est', label: 'Oldest first' },
  { value: 'name', label: 'Name A-Z' },
]

const PAGE_SIZE = 100

// Census filter options \u2014 labels derive from the ownership contract, and the
// Maps translate the displayed option string back to its census key.
const BUCKET_OPTIONS = HEADLINE_BUCKETS.map((b) => BUCKET_META[b].shortLabel)
const bucketByOption = new Map(HEADLINE_BUCKETS.map((b) => [BUCKET_META[b].shortLabel, b]))
const TIER_OPTIONS = OWNERSHIP_TIERS.map((t) => `${TIER_CODE[t]} ${TIER_META[t].shortLabel}`)
const tierByOption = new Map(OWNERSHIP_TIERS.map((t) => [`${TIER_CODE[t]} ${TIER_META[t].shortLabel}`, t]))
const CONFIDENCE_OPTIONS = ['High', 'Medium', 'Low', 'Not recorded']
const EVIDENCE_OPTIONS = ['Evidence on file', 'No evidence recorded']
const SPONSOR_OPTIONS = ['PE-backed', 'Not PE-backed']

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function isDataAxle(p: Practice): boolean {
  return p.data_axle_import_date != null && p.data_axle_import_date !== ''
}

function hasOwnershipEvidence(p: Practice): boolean {
  const basis = (p.ownership_evidence_basis ?? '').trim()
  const urls = (p.ownership_evidence_urls ?? '').trim()
  return basis !== '' || (urls !== '' && urls !== '[]')
}

function matchesSearch(p: Practice, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  return (
    (p.practice_name ?? '').toLowerCase().includes(t) ||
    (p.doing_business_as ?? '').toLowerCase().includes(t) ||
    (p.address ?? '').toLowerCase().includes(t) ||
    (p.city ?? '').toLowerCase().includes(t) ||
    (p.zip ?? '').toString().startsWith(term.trim()) ||
    (p.network_id ?? '').toLowerCase().includes(t) ||
    (p.network_id ? formatNetworkId(p.network_id).toLowerCase().includes(t) : false)
  )
}

function sortPractices<T extends Practice>(list: T[], sortBy: SortOption): T[] {
  const sorted = [...list]
  switch (sortBy) {
    case 'job_score':
      return sorted.sort(
        (a, b) =>
          ((b as PracticeWithJobScore).job_opp_score ?? 0) -
          ((a as PracticeWithJobScore).job_opp_score ?? 0)
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
        practiceDisplayName(a).localeCompare(practiceDisplayName(b))
      )
    default:
      return sorted
  }
}

/** Compute data-depth stars for a practice (provenance, not an ownership claim) */
function computeDataQuality(p: Practice): string {
  const isDA = p.data_axle_import_date != null && p.data_axle_import_date !== ''
  const censusReviewed = p.ownership_tier != null
  if (isDA) return '\u2605\u2605\u2605'
  if (censusReviewed) return '\u2605\u2605'
  return '\u2605'
}

/** Render gold-colored data-depth stars */
function renderDataQualityStars(v: string): React.ReactElement {
  const label =
    v === '\u2605\u2605\u2605'
      ? 'Business data'
      : v === '\u2605\u2605'
        ? 'Ownership reviewed'
        : 'Basic registry'
  return React.createElement('span', {
    className: 'text-xs text-[#6B6B60]',
    title: label,
  }, label)
}

function renderNetwork(v: string | null): string {
  return v ? formatNetworkId(v) : '--'
}

function renderCensusConfidence(v: string | null): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '--'
}

function renderPracticeLink(valueOrPractice: unknown): React.ReactElement {
  if (!valueOrPractice || typeof valueOrPractice !== 'object') {
    throw new Error('Practice row expected')
  }
  const p = valueOrPractice as Practice
  const name = practiceDisplayName(p)
  if (!p.location_id) {
    return React.createElement('span', { className: 'font-medium text-[#1A1A1A]' }, name)
  }
  return React.createElement(
    Link,
    {
      href: `/practice/${p.location_id}`,
      onClick: (event: React.MouseEvent) => event.stopPropagation(),
      className: 'inline-flex max-w-[260px] items-center gap-1.5 font-medium text-[#1A1A1A] hover:text-[#8B6508]',
      title: `Open ${name}`,
    },
    React.createElement('span', { className: 'truncate' }, name),
    React.createElement(ArrowUpRight, { className: 'h-3.5 w-3.5 shrink-0 text-[#B8860B]' })
  )
}

function renderCensusBadge(valueOrPractice: unknown): React.ReactElement {
  if (!valueOrPractice || typeof valueOrPractice !== 'object') {
    throw new Error('Practice row expected')
  }
  const p = valueOrPractice as Practice
  return React.createElement(CensusBadge, {
    tier: p.ownership_tier,
    peBacked: p.pe_backed,
    compact: true,
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Table columns — census ownership only. The detector Entity Type /
// Classification / DSO columns were removed, not relabeled: ownership in the
// directory comes exclusively from the reviewed census (tier badge, network,
// confidence). Buyability is a legacy heuristic and is labeled as such.
// ────────────────────────────────────────────────────────────────────────────

const EMPLOYMENT_COLUMNS = [
  { key: 'display_name', header: 'Practice Name', render: renderPracticeLink },
  { key: 'ownership_tier', header: 'Ownership', render: renderCensusBadge },
  { key: 'address', header: 'Address' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  { key: 'city', header: 'City' },
  { key: 'employee_count', header: 'Employees', render: (v: number | null) => v ?? '--' },
  { key: 'network_id', header: 'Owner / Group', render: renderNetwork },
  { key: 'job_opp_score', header: 'Hiring Signal', render: (v: number | null) => v ?? '--' },
  { key: 'data_quality', header: 'Source', render: (v: string) => renderDataQualityStars(v) },
]

const OWNERSHIP_COLUMNS = [
  { key: 'display_name', header: 'Practice Name', render: renderPracticeLink },
  { key: 'ownership_tier', header: 'Ownership', render: renderCensusBadge },
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
    header: 'Lead Score',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  { key: 'ownership_confidence', header: 'Confidence', render: renderCensusConfidence },
  { key: 'data_quality', header: 'Source', render: (v: string) => renderDataQualityStars(v) },
]

const ENRICHED_COLUMNS = [
  { key: 'display_name', header: 'Practice Name', render: renderPracticeLink },
  { key: 'ownership_tier', header: 'Ownership', render: renderCensusBadge },
  { key: 'address', header: 'Address' },
  { key: 'city', header: 'City' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  { key: 'network_id', header: 'Owner / Group', render: renderNetwork },
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
    header: 'Lead Score',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  { key: 'job_opp_score', header: 'Hiring Signal', render: (v: number | null) => v ?? '--' },
  { key: 'website', header: 'Website', render: (v: string | null) => v || '--' },
  { key: 'data_quality', header: 'Source', render: (v: string) => renderDataQualityStars(v) },
]

const ALL_COLUMNS = [
  { key: 'display_name', header: 'Practice Name', render: renderPracticeLink },
  { key: 'ownership_tier', header: 'Ownership', render: renderCensusBadge },
  { key: 'city', header: 'City' },
  { key: 'zip', header: 'ZIP', render: (v: string) => (v ?? '').toString().slice(0, 5) },
  { key: 'network_id', header: 'Owner / Group', render: renderNetwork },
  { key: 'employee_count', header: 'Employees', render: (v: number | null) => v ?? '--' },
  {
    key: 'year_established',
    header: 'Year Est.',
    render: (v: number | null) => (v ? Math.floor(Number(v)) : '--'),
  },
  {
    key: 'buyability_score',
    header: 'Lead Score',
    render: (v: number | null) => (v != null ? Number(v).toFixed(0) : '--'),
  },
  { key: 'job_opp_score', header: 'Hiring Signal', render: (v: number | null) => v ?? '--' },
  { key: 'data_quality', header: 'Source', render: (v: string) => renderDataQualityStars(v) },
]

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDirectory({ practices, allPractices }: PracticeDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([])
  const [selectedTiers, setSelectedTiers] = useState<string[]>([])
  const [selectedConfidence, setSelectedConfidence] = useState<string[]>([])
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([])
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([])
  const [selectedSponsor, setSelectedSponsor] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>(['All'])
  const [sortBy, setSortBy] = useState<SortOption>('job_score')
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null)
  const [page, setPage] = useState(1)
  const [activeView, setActiveView] = useState('employment')

  // Reset filters when location changes (practices prop changes)
  useEffect(() => {
    setPage(1)
    setSearchTerm('')
    setSelectedBuckets([])
    setSelectedTiers([])
    setSelectedConfidence([])
    setSelectedEvidence([])
    setSelectedNetworks([])
    setSelectedSponsor([])
    setSelectedSources(['All'])
  }, [practices.length])

  useEffect(() => {
    setPage(1)
  }, [activeView, searchTerm, selectedBuckets, selectedTiers, selectedConfidence, selectedEvidence, selectedNetworks, selectedSponsor, selectedSources, sortBy])

  const withDisplayName = useMemo(
    () =>
      practices.map((p) => ({
        ...p,
        display_name: practiceDisplayName(p),
      })),
    [practices]
  )

  const totalPractices = withDisplayName.length
  const enrichedCount = useMemo(
    () => withDisplayName.filter(isDataAxle).length,
    [withDisplayName]
  )
  const enrichmentPct = totalPractices > 0 ? (enrichedCount / totalPractices) * 100 : 0

  // Networks present in the current location (census network_id only)
  const networkOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of withDisplayName) {
      if (p.network_id) set.add(formatNetworkId(p.network_id))
    }
    return Array.from(set).sort()
  }, [withDisplayName])

  // Apply filters
  const filtered = useMemo(() => {
    let result = withDisplayName

    // Search
    if (searchTerm) {
      result = result.filter((p) => matchesSearch(p, searchTerm))
    }

    // Census bucket filter (unresolved = no reviewed conclusion yet)
    if (selectedBuckets.length > 0) {
      const buckets = new Set(selectedBuckets.map((o) => bucketByOption.get(o)))
      result = result.filter((p) => buckets.has(tierToBucket(p.ownership_tier ?? null)))
    }

    // Census tier filter (T1–T6; unreviewed rows have no tier)
    if (selectedTiers.length > 0) {
      const tiers = new Set<string>(
        selectedTiers.flatMap((o) => {
          const t = tierByOption.get(o)
          return t ? [t] : []
        })
      )
      result = result.filter((p) => p.ownership_tier != null && tiers.has(p.ownership_tier))
    }

    // Census review confidence
    if (selectedConfidence.length > 0) {
      result = result.filter((p) => {
        const conf = (p.ownership_confidence ?? '').trim().toLowerCase()
        if (conf === '') return selectedConfidence.includes('Not recorded')
        return selectedConfidence.includes(conf.charAt(0).toUpperCase() + conf.slice(1))
      })
    }

    // Evidence status
    if (selectedEvidence.length > 0) {
      result = result.filter((p) => {
        const has = hasOwnershipEvidence(p)
        return (
          (has && selectedEvidence.includes('Evidence on file')) ||
          (!has && selectedEvidence.includes('No evidence recorded'))
        )
      })
    }

    // Network (census network_id)
    if (selectedNetworks.length > 0) {
      result = result.filter(
        (p) => p.network_id != null && selectedNetworks.includes(formatNetworkId(p.network_id))
      )
    }

    // PE sponsor status (census pe_backed only — never detector attribution)
    if (selectedSponsor.length > 0) {
      result = result.filter((p) => {
        const confirmed = p.pe_backed === true
        return (
          (confirmed && selectedSponsor.includes('PE-backed')) ||
          (!confirmed && selectedSponsor.includes('Not PE-backed'))
        )
      })
    }

    // Source filter
    if (selectedSources.length > 0 && !selectedSources.includes('All')) {
      result = result.filter((p) => {
        if (selectedSources.includes('Business details available') && isDataAxle(p)) return true
        if (selectedSources.includes('Basic registry only') && !isDataAxle(p)) return true
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
  }, [withDisplayName, searchTerm, selectedBuckets, selectedTiers, selectedConfidence, selectedEvidence, selectedNetworks, selectedSponsor, selectedSources, sortBy])

  const filteredEnriched = useMemo(
    () => filtered.filter(isDataAxle).length,
    [filtered]
  )

  // Tab-specific datasets — census criteria only. Employment = high staffing
  // or census-confirmed DSO/PE corporate; Acquisition = census-confirmed solo
  // owner-operated. Detector entity_classification no longer selects rows.
  const employmentPractices = useMemo(() => {
    return filtered.filter((p) => {
      const emp = Number(p.employee_count) || 0
      if (emp >= 10) return true
      return tierToBucket(p.ownership_tier ?? null) === 'dso_pe_corporate'
    }).sort((a, b) => (Number(b.employee_count) || 0) - (Number(a.employee_count) || 0))
  }, [filtered])

  const ownershipPractices = useMemo(() => {
    return filtered
      .filter((p) => tierToBucket(p.ownership_tier ?? null) === 'true_solo_owner_operated')
      .sort((a, b) => (Number(b.buyability_score) || 0) - (Number(a.buyability_score) || 0))
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
      'display_name',
      'address',
      'city',
      'zip',
      'ownership_tier',
      'ownership_confidence',
      'ownership_evidence_basis',
      'pe_backed',
      'network_id',
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
      display_name: 'Practice Name',
      address: 'Address',
      city: 'City',
      zip: 'ZIP',
      ownership_tier: 'Ownership Type',
      ownership_confidence: 'Review Confidence',
      ownership_evidence_basis: 'Ownership Evidence',
      pe_backed: 'PE Backed (census)',
      network_id: 'Network',
      employee_count: 'Employees',
      estimated_revenue: 'Revenue',
      year_established: 'Year Est.',
      buyability_score: 'Acquisition Lead Score',
      job_opp_score: 'Hiring Signal',
      parent_company: 'Imported Parent Company',
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
        title="Chicagoland Practice Directory"
        helpText="Search every general-dentistry office by name, city, ZIP, owner, or group. The Ownership column is the reviewed answer when we have one; rows marked Not Reviewed still need research."
      />

      {/* Search & Filters */}
      <div className="mt-4 space-y-3">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by name, address, city, ZIP, or network..."
          debounceMs={300}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterGroup label="Ownership group">
            <MultiSelect
              options={BUCKET_OPTIONS}
              selected={selectedBuckets}
              onChange={setSelectedBuckets}
              placeholder="All groups"
            />
          </FilterGroup>
          <FilterGroup label="Detailed type">
            <MultiSelect
              options={TIER_OPTIONS}
              selected={selectedTiers}
              onChange={setSelectedTiers}
              placeholder="All types"
            />
          </FilterGroup>
          <FilterGroup label="Confidence">
            <MultiSelect
              options={CONFIDENCE_OPTIONS}
              selected={selectedConfidence}
              onChange={setSelectedConfidence}
              placeholder="All Confidence"
            />
          </FilterGroup>
          <FilterGroup label="Evidence">
            <MultiSelect
              options={EVIDENCE_OPTIONS}
              selected={selectedEvidence}
              onChange={setSelectedEvidence}
              placeholder="All Evidence"
            />
          </FilterGroup>
          <FilterGroup label="Owner / group">
            <MultiSelect
              options={networkOptions}
              selected={selectedNetworks}
              onChange={setSelectedNetworks}
              placeholder="All owners/groups"
            />
          </FilterGroup>
          <FilterGroup label="PE-backed">
            <MultiSelect
              options={SPONSOR_OPTIONS}
              selected={selectedSponsor}
              onChange={setSelectedSponsor}
              placeholder="All"
            />
          </FilterGroup>
          <FilterGroup label="Business data">
            <MultiSelect
              options={['All', 'Business details available', 'Basic registry only']}
              selected={selectedSources}
              onChange={setSelectedSources}
              placeholder="All Sources"
            />
          </FilterGroup>
          <div>
            <label className="text-xs font-medium text-[#6B6B60] block mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption)
                setPage(1)
              }}
              className="w-full rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-[#1A1A1A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
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
        <div className="text-sm text-[#B8860B]">
          Showing <strong>{filtered.length.toLocaleString()}</strong> of{' '}
          <strong>{totalPractices.toLocaleString()}</strong> GP offices |{' '}
          <strong>{filteredEnriched.toLocaleString()}</strong> with business details
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="mt-4">
        <TabsList className="bg-[#FFFFFF] border border-[#E8E5DE]">
          <TabsTrigger value="employment">Hiring leads</TabsTrigger>
          <TabsTrigger value="ownership">Acquisition Leads</TabsTrigger>
          <TabsTrigger value="enriched">Business details</TabsTrigger>
          <TabsTrigger value="all">All practices</TabsTrigger>
        </TabsList>

        <TabsContent value="employment">
          <p className="text-sm text-[#6B6B60] mb-2">
            Offices most likely to need an associate: larger staff counts or reviewed DSO/PE ownership.
            Treat this as a lead list and verify the role before applying.
          </p>
          {lowEnrichmentNote && (
            <p className="text-xs text-[#D4920B] mb-2">Warning: {lowEnrichmentNote}</p>
          )}
          {employmentPractices.length === 0 ? (
            <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
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
              <p className="text-xs text-[#6B6B60] mt-2">
              {employmentPractices.length} offices match the hiring-lead criteria
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
          <p className="text-sm text-[#6B6B60] mb-2">
            Reviewed true independent offices, sorted by an early acquisition lead score. This is
            a screening list, not a final acquisition recommendation.
          </p>
          {lowEnrichmentNote && (
            <p className="text-xs text-[#D4920B] mb-2">Warning: {lowEnrichmentNote}</p>
          )}
          {ownershipPractices.length === 0 ? (
            <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
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
              <p className="text-xs text-[#6B6B60] mt-2">
              {ownershipPractices.length} offices match the acquisition-lead criteria
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
            <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
              No offices with added business details match the current filters.
            </div>
          ) : (
            <>
              {enrichedPractices.length > 500 && (
                <p className="text-xs text-[#B8860B] mb-2">
                  Showing page {page} of {Math.ceil(enrichedPractices.length / PAGE_SIZE)} for{' '}
                  {enrichedPractices.length.toLocaleString()} offices with business details. Download CSV for full list.
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
            <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
              No offices match the current filters.
            </div>
          ) : (
            <>
              {filtered.length > 500 && (
                <p className="text-xs text-[#B8860B] mb-2">
                  Showing page {page} of {Math.ceil(filtered.length / PAGE_SIZE)} for{' '}
                  {filtered.length.toLocaleString()} offices. Download CSV for full list.
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
          className="inline-flex items-center gap-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-4 py-2 text-sm text-[#1A1A1A] hover:border-[#D4D0C8] hover:bg-[#F7F7F4] transition-colors"
        >
          <Download className="h-4 w-4" />
          Download filtered offices (CSV)
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
      <p className="text-xs text-[#6B6B60]">
        Page {page} of {totalPages} ({total.toLocaleString()} total)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-1 text-xs text-[#1A1A1A] disabled:opacity-40 hover:border-[#D4D0C8] transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-1 text-xs text-[#1A1A1A] disabled:opacity-40 hover:border-[#D4D0C8] transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
