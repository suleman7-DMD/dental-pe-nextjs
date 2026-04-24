'use client'

import { useState, useMemo, useCallback } from 'react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import { StickySectionNav } from '@/components/layout/sticky-section-nav'
import { WarroomCrossLink } from '@/components/layout/warroom-cross-link'
import { formatRelativeTime } from '@/lib/utils/formatting'
import { safeExternalUrl } from '@/lib/utils/safe-url'
import type { ZipQualitativeIntel, PracticeIntel, IntelStats } from '@/lib/types/intel'
import {
  MapPin,
  Globe,
  Stethoscope,
  Target,
  DollarSign,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface IntelligenceShellProps {
  initialZipIntel: ZipQualitativeIntel[]
  initialPracticeIntel: PracticeIntel[]
  stats: IntelStats
  watchedZipCount: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Safely parse a JSON string that might be an array. Returns an array or []. */
function safeParseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Truncate a string to maxLen characters, appending "..." if truncated. */
function truncate(value: string | null | undefined, maxLen: number): string {
  if (!value) return '\u2014'
  if (value.length <= maxLen) return value
  return value.slice(0, maxLen) + '...'
}

/** Format a cost as $X.XX or "--". */
function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return '\u2014'
  return `$${value.toFixed(2)}`
}

// ── Nav sections ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'zip-intel', label: 'ZIP Intelligence' },
  { id: 'practice-dossiers', label: 'Practice Dossiers' },
]

// ── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string | null | undefined }) {
  const c = (confidence ?? '').toLowerCase()
  let bg = 'bg-gray-500/10 text-[#9C9C90]'
  let label = confidence ?? '\u2014'
  if (c === 'high') {
    bg = 'bg-green-500/10 text-[#2D8B4E]'
    label = 'High'
  } else if (c === 'medium') {
    bg = 'bg-amber-500/10 text-[#D4920B]'
    label = 'Medium'
  } else if (c === 'low') {
    bg = 'bg-red-500/10 text-[#C23B3B]'
    label = 'Low'
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${bg}`}>
      {label}
    </span>
  )
}

// ── Readiness badge ──────────────────────────────────────────────────────────

function ReadinessBadge({ readiness }: { readiness: string | null | undefined }) {
  const r = (readiness ?? '').toLowerCase()
  let bg = 'bg-gray-500/10 text-[#9C9C90]'
  let label = readiness ?? '\u2014'
  if (r === 'high') {
    bg = 'bg-red-500/10 text-[#C23B3B]'
    label = 'High'
  } else if (r === 'medium') {
    bg = 'bg-amber-500/10 text-[#D4920B]'
    label = 'Medium'
  } else if (r === 'low') {
    bg = 'bg-green-500/10 text-[#2D8B4E]'
    label = 'Low'
  } else if (r === 'unlikely') {
    bg = 'bg-gray-500/10 text-[#9C9C90]'
    label = 'Unlikely'
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${bg}`}>
      {label}
    </span>
  )
}

// ── Signal card for detail panels ────────────────────────────────────────────

function SignalCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90] mb-2">
        {title}
      </h4>
      <div className="text-[13px] text-[#3D3D35] space-y-1">{children}</div>
    </div>
  )
}

/** Render a signal value, showing em-dash for null/empty. */
function SignalValue({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-[#B5B5A8]">{'\u2014'}</span>
  }
  return <span>{String(value)}</span>
}

// ── Main component ───────────────────────────────────────────────────────────

export function IntelligenceShell({
  initialZipIntel,
  initialPracticeIntel,
  stats,
  watchedZipCount,
}: IntelligenceShellProps) {
  const [selectedZip, setSelectedZip] = useState<ZipQualitativeIntel | null>(null)
  const [selectedPractice, setSelectedPractice] = useState<PracticeIntel | null>(null)

  // ── KPI computations ────────────────────────────────────────────────────

  const totalResearchCost = useMemo(() => {
    // Sum actual costs from individual records when available
    let totalFromRecords = 0
    let hasAnyRecordCost = false
    for (const z of initialZipIntel) {
      if (z.cost_usd != null) {
        totalFromRecords += z.cost_usd
        hasAnyRecordCost = true
      }
    }
    for (const p of initialPracticeIntel) {
      if (p.cost_usd != null) {
        totalFromRecords += p.cost_usd
        hasAnyRecordCost = true
      }
    }
    if (hasAnyRecordCost) {
      return { value: totalFromRecords.toFixed(2), estimated: false }
    }
    // Fallback: estimate from average cost
    const avgCost = stats.avgCostUsd ?? 0
    const totalItems = stats.totalZipsResearched + stats.totalPracticesResearched
    return { value: (avgCost * totalItems).toFixed(2), estimated: true }
  }, [stats, initialZipIntel, initialPracticeIntel])

  const zipCoveragePct = useMemo(() => {
    if (watchedZipCount === 0) return '0.0'
    return ((stats.totalZipsResearched / watchedZipCount) * 100).toFixed(1)
  }, [stats.totalZipsResearched, watchedZipCount])

  const avgConfidenceLabel = useMemo(() => {
    if (initialZipIntel.length === 0) return '\u2014'
    let high = 0
    let medium = 0
    let low = 0
    for (const z of initialZipIntel) {
      const c = (z.confidence ?? '').toLowerCase()
      if (c === 'high') high++
      else if (c === 'medium') medium++
      else if (c === 'low') low++
    }
    if (high >= medium && high >= low) return 'High'
    if (medium >= high && medium >= low) return 'Medium'
    return 'Low'
  }, [initialZipIntel])

  // ── ZIP Intel table columns ─────────────────────────────────────────────

  const zipColumns = useMemo(
    () => [
      {
        key: 'zip_code',
        header: 'ZIP',
        render: (val: string | null) => val ?? '\u2014',
      },
      {
        key: 'confidence',
        header: 'Confidence',
        render: (val: string | null) => <ConfidenceBadge confidence={val} />,
      },
      {
        key: 'demand_outlook',
        header: 'Demand',
        render: (val: string | null) => truncate(val, 60),
      },
      {
        key: 'supply_outlook',
        header: 'Supply',
        render: (val: string | null) => truncate(val, 60),
      },
      {
        key: 'investment_thesis',
        header: 'Investment Thesis',
        render: (val: string | null) => truncate(val, 80),
      },
      {
        key: 'research_date',
        header: 'Researched',
        render: (val: string | null) => (val ? formatRelativeTime(val) : '\u2014'),
      },
      {
        key: 'cost_usd',
        header: 'Cost',
        render: (val: number | null) => formatCost(val),
        align: 'right' as const,
      },
    ],
    []
  )

  // ── Practice Intel table columns ────────────────────────────────────────

  const practiceColumns = useMemo(
    () => [
      {
        key: 'npi',
        header: 'NPI',
        render: (val: string | null) => val ?? '\u2014',
      },
      {
        key: 'acquisition_readiness',
        header: 'Readiness',
        render: (val: string | null) => <ReadinessBadge readiness={val} />,
      },
      {
        key: 'confidence',
        header: 'Confidence',
        render: (val: string | null) => <ConfidenceBadge confidence={val} />,
      },
      {
        key: 'google_rating',
        header: 'Google',
        render: (_val: number | null, row?: PracticeIntel) => {
          // When DataTable passes full row object via fallback
          if (row && typeof row === 'object' && 'google_rating' in row) {
            const rating = row.google_rating
            const count = row.google_review_count
            if (rating == null) return '\u2014'
            return `${rating.toFixed(1)}\u2605${count != null ? ` (${count})` : ''}`
          }
          // When DataTable passes just the cell value
          if (_val == null) return '\u2014'
          return `${_val.toFixed(1)}\u2605`
        },
      },
      {
        key: 'red_flags',
        header: 'Red Flags',
        render: (val: string | null) => {
          const flags = safeParseJsonArray(val)
          if (flags.length === 0) return <span className="text-[#B5B5A8]">0</span>
          return <span className="text-[#C23B3B] font-medium">{flags.length}</span>
        },
      },
      {
        key: 'green_flags',
        header: 'Green Flags',
        render: (val: string | null) => {
          const flags = safeParseJsonArray(val)
          if (flags.length === 0) return <span className="text-[#B5B5A8]">0</span>
          return <span className="text-[#2D8B4E] font-medium">{flags.length}</span>
        },
      },
      {
        key: 'escalated',
        header: 'Deep',
        render: (val: number | null) =>
          val === 1 ? (
            <CheckCircle2 className="h-4 w-4 text-[#B8860B]" />
          ) : (
            <span className="text-[#B5B5A8]">{'\u2014'}</span>
          ),
      },
      {
        key: 'research_date',
        header: 'Researched',
        render: (val: string | null) => (val ? formatRelativeTime(val) : '\u2014'),
      },
      {
        key: 'cost_usd',
        header: 'Cost',
        render: (val: number | null) => formatCost(val),
        align: 'right' as const,
      },
    ],
    []
  )

  // ── Row click handlers ──────────────────────────────────────────────────

  const handleZipClick = useCallback((row: ZipQualitativeIntel) => {
    setSelectedZip((prev) => (prev?.zip_code === row.zip_code ? null : row))
    setSelectedPractice(null)
  }, [])

  const handlePracticeClick = useCallback((row: PracticeIntel) => {
    setSelectedPractice((prev) => (prev?.npi === row.npi ? null : row))
    setSelectedZip(null)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
      <StickySectionNav sections={NAV_ITEMS} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligence</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">
            AI-powered qualitative research — ZIP-level market signals, practice-level
            due diligence, and acquisition readiness scoring.
          </p>
        </div>

        <WarroomCrossLink
          context="Intel disagreements, stealth DSO clusters, and signal co-occurrence in the Investigate view."
          hrefSuffix="?mode=investigate&lens=disagreement"
        />

        {/* ── Section 1: KPIs ─────────────────────────────────────────── */}
        <div id="kpis">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              icon={<MapPin className="h-4 w-4" />}
              label="ZIPs Researched"
              value={stats.totalZipsResearched}
              suffix={`/ ${watchedZipCount}`}
              accentColor="#B8860B"
            />
            <KpiCard
              icon={<Globe className="h-4 w-4" />}
              label="ZIP Coverage"
              value={zipCoveragePct}
              suffix="%"
              accentColor="#0D9488"
            />
            <KpiCard
              icon={<Stethoscope className="h-4 w-4" />}
              label="Practices Researched"
              value={stats.totalPracticesResearched}
              accentColor="#2D8B4E"
            />
            <KpiCard
              icon={<Target className="h-4 w-4" />}
              label="High Readiness"
              value={stats.highReadinessCount}
              accentColor="#C23B3B"
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Total Research Cost"
              value={`${totalResearchCost.estimated ? '~' : ''}$${totalResearchCost.value}`}
              accentColor="#D4920B"
            />
            <KpiCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Avg Confidence"
              value={avgConfidenceLabel}
              accentColor="#7C3AED"
            />
          </div>
        </div>

        {/* ── Section 2: ZIP Intelligence ─────────────────────────────── */}
        <div id="zip-intel">
          <SectionHeader
            title="ZIP Market Intelligence"
            description="AI-researched market signals for watched ZIP codes"
          />

          <div className="mt-4">
            <DataTable
              columns={zipColumns}
              data={initialZipIntel}
              searchable
              searchPlaceholder="Search ZIPs..."
              csvFileName="zip-intelligence.csv"
              pagination
              pageSize={20}
              rowKey="zip_code"
              onRowClick={handleZipClick}
              emptyMessage="No ZIP intelligence data available. Run the qualitative scout to generate research."
            />
          </div>

          {/* Selected ZIP detail panel */}
          {selectedZip && (
            <div className="mt-4 rounded-lg border border-[#E8E5DE] bg-[#F5F5F0] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1A1A1A]">
                  ZIP {selectedZip.zip_code} — Market Intelligence
                </h3>
                <button
                  onClick={() => setSelectedZip(null)}
                  className="text-[#9C9C90] hover:text-[#6B6B60] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Signal grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <SignalCard title="Housing">
                  <p><span className="text-[#6B6B60]">Status:</span> <SignalValue value={selectedZip.housing_status} /></p>
                  <p><span className="text-[#6B6B60]">Developments:</span> <SignalValue value={selectedZip.housing_developments} /></p>
                  <p><span className="text-[#6B6B60]">Summary:</span> <SignalValue value={selectedZip.housing_summary} /></p>
                </SignalCard>

                <SignalCard title="Schools">
                  <p><span className="text-[#6B6B60]">District:</span> <SignalValue value={selectedZip.school_district} /></p>
                  <p><span className="text-[#6B6B60]">Rating:</span> <SignalValue value={selectedZip.school_rating} /></p>
                  <p><span className="text-[#6B6B60]">Source:</span> <SignalValue value={selectedZip.school_source} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedZip.school_note} /></p>
                </SignalCard>

                <SignalCard title="Retail &amp; Income Signals">
                  <p><span className="text-[#6B6B60]">Premium:</span> <SignalValue value={selectedZip.retail_premium} /></p>
                  <p><span className="text-[#6B6B60]">Mass:</span> <SignalValue value={selectedZip.retail_mass} /></p>
                  <p><span className="text-[#6B6B60]">Income Signal:</span> <SignalValue value={selectedZip.retail_income_signal} /></p>
                </SignalCard>

                <SignalCard title="Commercial">
                  <p><span className="text-[#6B6B60]">Status:</span> <SignalValue value={selectedZip.commercial_status} /></p>
                  <p><span className="text-[#6B6B60]">Projects:</span> <SignalValue value={selectedZip.commercial_projects} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedZip.commercial_note} /></p>
                </SignalCard>

                <SignalCard title="Dental News">
                  <p><span className="text-[#6B6B60]">New Offices:</span> <SignalValue value={selectedZip.dental_new_offices} /></p>
                  <p><span className="text-[#6B6B60]">DSO Moves:</span> <SignalValue value={selectedZip.dental_dso_moves} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedZip.dental_note} /></p>
                </SignalCard>

                <SignalCard title="Real Estate">
                  <p>
                    <span className="text-[#6B6B60]">Median Home Price:</span>{' '}
                    {selectedZip.median_home_price != null ? (
                      <span className="font-mono">${selectedZip.median_home_price.toLocaleString()}</span>
                    ) : (
                      <span className="text-[#B5B5A8]">{'\u2014'}</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Trend:</span> <SignalValue value={selectedZip.home_price_trend} /></p>
                  <p>
                    <span className="text-[#6B6B60]">YoY Change:</span>{' '}
                    {selectedZip.home_price_yoy_pct != null ? (
                      <span className={selectedZip.home_price_yoy_pct >= 0 ? 'text-[#2D8B4E]' : 'text-[#C23B3B]'}>
                        {selectedZip.home_price_yoy_pct >= 0 ? '+' : ''}{selectedZip.home_price_yoy_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[#B5B5A8]">{'\u2014'}</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Source:</span> <SignalValue value={selectedZip.real_estate_source} /></p>
                </SignalCard>

                <SignalCard title="Zoning &amp; Planning">
                  <p><span className="text-[#6B6B60]">Items:</span> <SignalValue value={selectedZip.zoning_items} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedZip.zoning_note} /></p>
                </SignalCard>

                <SignalCard title="Population">
                  <p><span className="text-[#6B6B60]">Growth Signals:</span> <SignalValue value={selectedZip.pop_growth_signals} /></p>
                  <p><span className="text-[#6B6B60]">Demographics:</span> <SignalValue value={selectedZip.pop_demographics} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedZip.pop_note} /></p>
                </SignalCard>

                <SignalCard title="Employers &amp; Insurance">
                  <p><span className="text-[#6B6B60]">Major Employers:</span> <SignalValue value={selectedZip.major_employers} /></p>
                  <p><span className="text-[#6B6B60]">Insurance Signal:</span> <SignalValue value={selectedZip.insurance_signal} /></p>
                </SignalCard>

                <SignalCard title="Competitors">
                  <p><span className="text-[#6B6B60]">New:</span> <SignalValue value={selectedZip.competitor_new} /></p>
                  <p><span className="text-[#6B6B60]">Closures:</span> <SignalValue value={selectedZip.competitor_closures} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedZip.competitor_note} /></p>
                </SignalCard>
              </div>

              {/* Synthesis section */}
              <div className="space-y-4">
                <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60] mb-2">
                    Demand Outlook
                  </h4>
                  <p className="text-[13px] text-[#3D3D35]">
                    {selectedZip.demand_outlook || '\u2014'}
                  </p>
                </div>

                <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60] mb-2">
                    Supply Outlook
                  </h4>
                  <p className="text-[13px] text-[#3D3D35]">
                    {selectedZip.supply_outlook || '\u2014'}
                  </p>
                </div>

                <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60] mb-2">
                    Investment Thesis
                  </h4>
                  <p className="text-[13px] text-[#3D3D35]">
                    {selectedZip.investment_thesis || '\u2014'}
                  </p>
                </div>

                {/* Sources */}
                {selectedZip.sources && (
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60] mb-2">
                      Sources
                    </h4>
                    <ul className="text-[13px] text-[#3D3D35] space-y-1">
                      {safeParseJsonArray(selectedZip.sources).length > 0 ? (
                        safeParseJsonArray(selectedZip.sources).map((src, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <ExternalLink className="h-3 w-3 text-[#B5B5A8] flex-shrink-0" />
                            <span>{src}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[#3D3D35]">{selectedZip.sources}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="mt-4 flex items-center gap-4 text-[11px] text-[#9C9C90]">
                <span>Confidence: <ConfidenceBadge confidence={selectedZip.confidence} /></span>
                <span>Method: {selectedZip.research_method ?? '\u2014'}</span>
                <span>Model: {selectedZip.model_used ?? '\u2014'}</span>
                <span>Cost: {formatCost(selectedZip.cost_usd)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 3: Practice Dossiers ────────────────────────────── */}
        <div id="practice-dossiers">
          <SectionHeader
            title="Practice Due Diligence"
            description="AI-powered research on individual dental practices"
          />

          <div className="mt-4">
            <DataTable
              columns={practiceColumns}
              data={initialPracticeIntel}
              searchable
              searchPlaceholder="Search by NPI..."
              csvFileName="practice-dossiers.csv"
              pagination
              pageSize={20}
              rowKey="npi"
              onRowClick={handlePracticeClick}
              emptyMessage="No practice intelligence data available. Run the practice deep dive tool to generate dossiers."
            />
          </div>

          {/* Selected practice detail panel */}
          {selectedPractice && (
            <div className="mt-4 rounded-lg border border-[#E8E5DE] bg-[#F5F5F0] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  NPI {selectedPractice.npi} — Practice Dossier
                </h3>
                <button
                  onClick={() => setSelectedPractice(null)}
                  className="text-[#9C9C90] hover:text-[#6B6B60] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Signal grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <SignalCard title="Website Analysis">
                  <p>
                    <span className="text-[#6B6B60]">URL:</span>{' '}
                    {selectedPractice.website_url ? (
                      <a
                        href={safeExternalUrl(selectedPractice.website_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#B8860B] hover:underline"
                      >
                        {selectedPractice.website_url}
                      </a>
                    ) : (
                      <span className="text-[#B5B5A8]">{'\u2014'}</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Era:</span> <SignalValue value={selectedPractice.website_era} /></p>
                  <p><span className="text-[#6B6B60]">Last Update:</span> <SignalValue value={selectedPractice.website_last_update} /></p>
                  <p><span className="text-[#6B6B60]">Analysis:</span> <SignalValue value={selectedPractice.website_analysis} /></p>
                </SignalCard>

                <SignalCard title="Services">
                  <p><span className="text-[#6B6B60]">Listed:</span> <SignalValue value={selectedPractice.services_listed} /></p>
                  <p><span className="text-[#6B6B60]">High Revenue:</span> <SignalValue value={selectedPractice.services_high_rev} /></p>
                  <p><span className="text-[#6B6B60]">Note:</span> <SignalValue value={selectedPractice.services_note} /></p>
                </SignalCard>

                <SignalCard title="Technology">
                  <p><span className="text-[#6B6B60]">Listed:</span> <SignalValue value={selectedPractice.technology_listed} /></p>
                  <p><span className="text-[#6B6B60]">Level:</span> <SignalValue value={selectedPractice.technology_level} /></p>
                </SignalCard>

                <SignalCard title="Google Reviews">
                  <p>
                    <span className="text-[#6B6B60]">Rating:</span>{' '}
                    {selectedPractice.google_rating != null ? (
                      <span className="font-mono text-[#D4920B]">
                        {selectedPractice.google_rating.toFixed(1)}{'\u2605'}
                      </span>
                    ) : (
                      <span className="text-[#B5B5A8]">{'\u2014'}</span>
                    )}
                  </p>
                  <p>
                    <span className="text-[#6B6B60]">Reviews:</span>{' '}
                    {selectedPractice.google_review_count != null ? (
                      <span className="font-mono">{selectedPractice.google_review_count}</span>
                    ) : (
                      <span className="text-[#B5B5A8]">{'\u2014'}</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Recent Date:</span> <SignalValue value={selectedPractice.google_recent_date} /></p>
                  <p><span className="text-[#6B6B60]">Velocity:</span> <SignalValue value={selectedPractice.google_velocity} /></p>
                  <p><span className="text-[#6B6B60]">Sentiment:</span> <SignalValue value={selectedPractice.google_sentiment} /></p>
                </SignalCard>

                <SignalCard title="Hiring Signals">
                  <p>
                    <span className="text-[#6B6B60]">Active Hiring:</span>{' '}
                    {selectedPractice.hiring_active === 1 ? (
                      <span className="text-[#D4920B] font-medium">Yes</span>
                    ) : (
                      <span className="text-[#B5B5A8]">No</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Positions:</span> <SignalValue value={selectedPractice.hiring_positions} /></p>
                  <p><span className="text-[#6B6B60]">Source:</span> <SignalValue value={selectedPractice.hiring_source} /></p>
                </SignalCard>

                <SignalCard title="Acquisition News">
                  <p>
                    <span className="text-[#6B6B60]">Found:</span>{' '}
                    {selectedPractice.acquisition_found === 1 ? (
                      <span className="text-[#C23B3B] font-medium">Yes</span>
                    ) : (
                      <span className="text-[#B5B5A8]">No</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Details:</span> <SignalValue value={selectedPractice.acquisition_details} /></p>
                </SignalCard>

                <SignalCard title="Social Media">
                  <p><span className="text-[#6B6B60]">Facebook:</span> <SignalValue value={selectedPractice.social_facebook} /></p>
                  <p><span className="text-[#6B6B60]">Instagram:</span> <SignalValue value={selectedPractice.social_instagram} /></p>
                  <p><span className="text-[#6B6B60]">Other:</span> <SignalValue value={selectedPractice.social_other} /></p>
                </SignalCard>

                <SignalCard title="Provider Profile">
                  <p>
                    <span className="text-[#6B6B60]">Provider Count (Web):</span>{' '}
                    {selectedPractice.provider_count_web != null ? (
                      <span className="font-mono">{selectedPractice.provider_count_web}</span>
                    ) : (
                      <span className="text-[#B5B5A8]">{'\u2014'}</span>
                    )}
                  </p>
                  <p><span className="text-[#6B6B60]">Career Stage:</span> <SignalValue value={selectedPractice.owner_career_stage} /></p>
                  <p><span className="text-[#6B6B60]">Publications:</span> <SignalValue value={selectedPractice.doctor_publications} /></p>
                  <p><span className="text-[#6B6B60]">Speaking:</span> <SignalValue value={selectedPractice.doctor_speaking} /></p>
                  <p><span className="text-[#6B6B60]">Associations:</span> <SignalValue value={selectedPractice.doctor_associations} /></p>
                  <p><span className="text-[#6B6B60]">Notes:</span> <SignalValue value={selectedPractice.doctor_notes} /></p>
                </SignalCard>
              </div>

              {/* Red flags & green flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#C23B3B] mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Red Flags
                  </h4>
                  {safeParseJsonArray(selectedPractice.red_flags).length > 0 ? (
                    <ul className="text-[13px] text-[#C23B3B] space-y-1">
                      {safeParseJsonArray(selectedPractice.red_flags).map((flag, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#C23B3B] mt-0.5">&bull;</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-[#B5B5A8]">None identified</p>
                  )}
                </div>

                <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#2D8B4E] mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Green Flags
                  </h4>
                  {safeParseJsonArray(selectedPractice.green_flags).length > 0 ? (
                    <ul className="text-[13px] text-[#2D8B4E] space-y-1">
                      {safeParseJsonArray(selectedPractice.green_flags).map((flag, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#2D8B4E] mt-0.5">&bull;</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-[#B5B5A8]">None identified</p>
                  )}
                </div>
              </div>

              {/* Overall assessment */}
              <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4 mb-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60] mb-2">
                  Overall Assessment
                </h4>
                <p className="text-[13px] text-[#3D3D35]">
                  {selectedPractice.overall_assessment || '\u2014'}
                </p>
              </div>

              {/* Escalation findings */}
              {selectedPractice.escalated === 1 && selectedPractice.escalation_findings && (
                <div className="rounded-lg border border-[#B8860B]/30 bg-[#B8860B]/5 p-4 mb-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#B8860B] mb-2">
                    Escalation Findings (Sonnet Deep Dive)
                  </h4>
                  <p className="text-[13px] text-[#3D3D35]">
                    {selectedPractice.escalation_findings}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#9C9C90]">
                <span>
                  Readiness: <ReadinessBadge readiness={selectedPractice.acquisition_readiness} />
                </span>
                <span>
                  Confidence: <ConfidenceBadge confidence={selectedPractice.confidence} />
                </span>
                <span>Method: {selectedPractice.research_method ?? '\u2014'}</span>
                <span>Model: {selectedPractice.model_used ?? '\u2014'}</span>
                <span>Cost: {formatCost(selectedPractice.cost_usd)}</span>
                {selectedPractice.escalated === 1 && (
                  <span className="text-[#B8860B]">Two-pass escalated</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
