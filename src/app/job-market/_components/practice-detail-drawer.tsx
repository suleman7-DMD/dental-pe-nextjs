'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ENTITY_CLASSIFICATION_COLORS } from '@/lib/constants/colors'
import { getEntityClassificationLabel } from '@/lib/constants/entity-classifications'
import { ownershipLabel, ownershipColor } from '@/lib/constants/design-tokens'
import {
  CensusBadge,
  formatNetworkName,
} from '@/components/data-display/census-badge'
import { ManualCorrectionPanel } from '@/components/data-display/manual-correction-panel'
import { LEGACY_DETECTOR_CONTEXT_LABEL } from '@/lib/census/ownership-truth'
import { displayName } from '@/lib/census/display-name'

import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PracticeDetailDrawerProps {
  practice: Practice | null
  allPractices: Practice[]
  onClose: () => void
}

// ────────────────────────────────────────────────────────────────────────────
// Observation generator (port of generate_basic_observations from app.py)
// ────────────────────────────────────────────────────────────────────────────

function generateBasicObservations(row: Practice): string[] {
  const observations: string[] = []
  const currentYear = new Date().getFullYear()

  // Entity type
  const entityType = row.entity_type
  if (entityType === '1') {
    observations.push(
      'Individual provider registration -- likely a solo practitioner or associate'
    )
  } else if (entityType === '2') {
    observations.push('Organization registration -- incorporated practice entity')
  }

  // Year established
  const yr = row.year_established != null ? Number(row.year_established) : NaN
  if (!isNaN(yr) && yr > 0) {
    const age = currentYear - yr
    if (age >= 30) {
      observations.push(
        `Established ${age} years ago (${yr}) -- owner likely in late career`
      )
    } else if (age >= 20) {
      observations.push(`Established ${age} years ago (${yr}) -- mature practice`)
    } else if (age <= 5) {
      observations.push(
        `Established only ${age} years ago (${yr}) -- relatively new`
      )
    }
  }

  // Employee count
  const emp = row.employee_count != null ? Number(row.employee_count) : NaN
  if (!isNaN(emp) && emp > 0) {
    if (emp >= 10) {
      observations.push(
        `${emp} employees -- large enough to likely hire associates`
      )
    } else if (emp >= 5) {
      observations.push(`${emp} employees -- moderate-sized practice`)
    } else {
      observations.push(`${emp} employees -- small practice`)
    }
  }

  // Revenue
  const rev = row.estimated_revenue != null ? Number(row.estimated_revenue) : NaN
  if (!isNaN(rev) && rev > 0) {
    if (rev >= 1000000) {
      observations.push(
        `Estimated revenue $${rev.toLocaleString()} -- high-volume production`
      )
    } else if (rev >= 500000) {
      observations.push(
        `Estimated revenue $${rev.toLocaleString()} -- solid production`
      )
    }
  }

  // Data source check
  const hasDa = row.data_axle_import_date != null && row.data_axle_import_date !== ''
  if (!hasDa) {
    observations.push(
      'Limited business data -- basic registry data only. Employee count, revenue, and year established may be missing.'
    )
  }

  return observations
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function entityTypeLabel(et: string | null | undefined): string {
  if (et === '1') return 'Individual'
  if (et === '2') return 'Organization'
  return '\u2014'
}

function confidenceStarsInline(confidence: number | null | undefined): string {
  if (confidence == null) return ''
  const n = Number(confidence)
  if (n >= 80) return '\u2605\u2605\u2605'
  if (n >= 50) return '\u2605\u2605'
  if (n > 0) return '\u2605'
  return ''
}

function displayValue(v: string | number | null | undefined): string {
  if (v == null || v === '') return '\u2014'
  return String(v)
}

function drawerPracticeName(p: Practice): string {
  return displayName(p)
}

function formatReliableRevenue(value: number | null | undefined): string | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 10000) return 'Not reliable'
  return `$${n.toLocaleString()}`
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDetailDrawer({
  practice,
  allPractices,
  onClose,
}: PracticeDetailDrawerProps) {
  const isOpen = practice !== null
  const p = practice

  // Find providers at same address
  const sameAddress = useMemo(() => {
    if (!p) return []
    const addr = (p.address ?? '').toUpperCase().trim()
    const zip5 = (p.zip ?? '').toString().slice(0, 5)
    if (!addr || !zip5) return []

    return allPractices.filter(
      (other) =>
        other.npi !== p.npi &&
        (other.address ?? '').toUpperCase().trim() === addr &&
        (other.zip ?? '').toString().slice(0, 5) === zip5
    )
  }, [p, allPractices])

  // Check for shared last names (family indicator)
  const sharedLastNames = useMemo(() => {
    if (sameAddress.length === 0 || !p) return null

    // Combine current practice + same-address practices
    const allAtAddress = [p, ...sameAddress]
    const lastNames: string[] = []

    for (const pr of allAtAddress) {
      // Extract last name from practice name heuristically
      const name = pr.practice_name ?? ''
      const parts = name.split(/[,\s]+/).filter(Boolean)
      if (parts.length > 0) {
        const lastName = parts[0].toUpperCase().trim()
        // Exclude common suffixes that aren't names
        const exclude = new Set([
          '', 'DDS', 'DMD', 'PC', 'LTD', 'INC', 'LLC', 'DR', 'DOCTOR',
          'DENTAL', 'DENTISTRY', 'FAMILY', 'GENERAL', 'PEDIATRIC',
        ])
        if (!exclude.has(lastName)) {
          lastNames.push(lastName)
        }
      }
    }

    // Count duplicates
    const counts: Record<string, number> = {}
    for (const n of lastNames) {
      counts[n] = (counts[n] ?? 0) + 1
    }

    const shared = Object.entries(counts).filter(([, c]) => c >= 2)
    if (shared.length === 0) return null

    return shared.map(([name, count]) => `${name} (${count}x)`).join(', ')
  }, [p, sameAddress])

  // Multi-ZIP presence — returns both count and the list of ZIPs
  const multiZipData = useMemo(() => {
    if (!p?.practice_name) return { count: 0, zips: [] as string[] }
    const name = p.practice_name.toUpperCase()
    const myZip = (p.zip ?? '').toString().slice(0, 5)

    const otherZips = new Set<string>()
    for (const other of allPractices) {
      if (
        (other.practice_name ?? '').toUpperCase() === name &&
        (other.zip ?? '').toString().slice(0, 5) !== myZip
      ) {
        otherZips.add((other.zip ?? '').toString().slice(0, 5))
      }
    }
    return { count: otherZips.size, zips: Array.from(otherZips).sort() }
  }, [p, allPractices])

  if (!p) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent className="bg-[#FFFFFF] border-[#E8E5DE]" />
      </Sheet>
    )
  }

  const hasDa = p.data_axle_import_date != null && p.data_axle_import_date !== ''
  const isDaEnriched = hasDa && (p.import_batch_id ?? '').startsWith('DA_')
  const reasoning = p.classification_reasoning
  const observations = !reasoning ? generateBasicObservations(p) : []
  const ecColor = ENTITY_CLASSIFICATION_COLORS[p.entity_classification ?? 'unknown'] ?? '#B5B5A8'
  const osColor = ownershipColor(p.ownership_status)
  const totalZips = multiZipData.count + 1 // current ZIP + others

  return (
    <Sheet open={isOpen} onOpenChange={() => onClose()}>
      <SheetContent
        className="bg-[#FFFFFF] border-[#E8E5DE] w-full sm:max-w-[480px] overflow-y-auto backdrop-blur-sm"
        side="right"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <SheetHeader className="relative pr-12">
          <SheetTitle className="text-[#1A1A1A] font-bold text-lg leading-tight">
            {drawerPracticeName(p)}
          </SheetTitle>
          <p className="text-[13px] text-[#6B6B60] mt-0.5">
            {[p.address, p.city, p.state ? `${p.state} ${(p.zip ?? '').toString().slice(0, 5)}` : null]
              .filter(Boolean)
              .join(', ') || '\u2014'}
          </p>

          {/* Enrichment badge — top-right */}
          <div className="absolute top-0 right-0">
            {isDaEnriched ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-[rgba(45,139,78,0.1)] text-[#2D8B4E] border border-[rgba(45,139,78,0.2)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2D8B4E]" />
                Business data available
                {p.classification_confidence != null && (
                  <span className="ml-0.5 text-[10px]">{confidenceStarsInline(p.classification_confidence)}</span>
                )}
              </span>
            ) : hasDa ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-[rgba(45,139,78,0.1)] text-[#2D8B4E] border border-[rgba(45,139,78,0.2)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2D8B4E]" />
                Business data available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-[rgba(156,156,144,0.1)] text-[#6B6B60] border border-[rgba(156,156,144,0.2)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9C9C90]" />
                Basic registry only
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-0">
          {/* ── Census Ownership (the truth record — always first) ── */}
          <div className="px-4 pb-4">
            <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <CensusBadge tier={p.ownership_tier ?? null} peBacked={p.pe_backed ?? null} />
                {p.network_id ? (
                  <span className="text-[11px] font-medium text-[#6B6B60]">
                    {formatNetworkName(p.network_id)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#6B6B60]">
                {p.ownership_tier
                  ? p.ownership_evidence_basis ??
                    'Reviewed ownership answer; evidence detail is on the full practice page.'
                  : 'No ownership answer yet — ownership is unknown. Nothing below is an ownership conclusion.'}
              </p>
              {p.location_id ? (
                <Link
                  href={`/practice/${encodeURIComponent(p.location_id)}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#8B6508] hover:text-[#1A1A1A]"
                >
                  Open full practice page
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </div>

          {/* ── Two-Column Info Grid (business facts, no ownership) ── */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-4 pb-5">
            <DossierField label="Phone" value={p.phone} />
            <DossierField label="Entity Type" value={entityTypeLabel(p.entity_type)} />

            <DossierField
              label="Year Established"
              value={
                p.year_established != null
                  ? Math.floor(Number(p.year_established)).toString()
                  : null
              }
            />
            <DossierField
              label="Employees"
              value={
                p.employee_count != null
                  ? Math.floor(Number(p.employee_count)).toString()
                  : null
              }
            />

            <DossierField
              label="Revenue"
              value={formatReliableRevenue(p.estimated_revenue)}
            />
            <DossierField
              label="Lead Score"
              value={
                p.buyability_score != null
                  ? Number(p.buyability_score).toFixed(0)
                  : null
              }
            />

            <DossierField label="NPI" value={p.npi} />
            <DossierField
              label="Review Confidence"
              value={p.ownership_tier ? p.ownership_confidence ?? 'Not stated' : null}
            />
          </div>

          <div className="border-t border-[#E8E5DE]" />

          <div className="px-4 py-4">
            <ManualCorrectionPanel
              compact
              locationId={p.location_id}
              npi={p.npi}
              practiceName={drawerPracticeName(p)}
              fields={[
                {
                  key: 'practice_name',
                  label: 'Current practice name',
                  currentValue: drawerPracticeName(p),
                  placeholder: 'Name shown on the practice website',
                },
                {
                  key: 'owner_doctor_or_group',
                  label: 'Owner doctor / group',
                  currentValue: p.network_id ? formatNetworkName(p.network_id) : null,
                  placeholder: 'Example: Dr. Jane Smith, DDS',
                },
                {
                  key: 'operating_doctors',
                  label: 'Doctors currently shown on website',
                  currentValue: null,
                  placeholder: 'Example: Dr. A; Dr. B; Dr. C',
                },
                {
                  key: 'provider_count',
                  label: 'Provider count',
                  currentValue: p.num_providers,
                  inputMode: 'numeric',
                },
                {
                  key: 'employee_count',
                  label: 'Employee count',
                  currentValue: p.employee_count,
                  inputMode: 'numeric',
                },
                {
                  key: 'website',
                  label: 'Website',
                  currentValue: p.website,
                },
              ]}
            />
          </div>

          {/* ── Divider ──────────────────────────────────────────── */}
          <div className="border-t border-[#E8E5DE]" />

          {/* ── Raw Source Audit — legacy detector (context only) ── */}
          <div className="px-4 py-4">
            <h4 className="text-[11px] uppercase tracking-wider text-[#707064] font-medium mb-1">
              Older automated data
            </h4>
            <p className="text-[11px] leading-4 text-[#9C9C90] mb-3">
              {LEGACY_DETECTOR_CONTEXT_LABEL}. These fields are kept only so you can audit
              older inputs. The reviewed ownership box above is the answer to use.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-3">
              <DossierField
                label="Old automated class"
                value={getEntityClassificationLabel(p.entity_classification ?? null)}
                dotColor={ecColor}
              />
              <DossierField
                label="Old ownership guess"
                value={ownershipLabel(p.ownership_status)}
                dotColor={osColor}
              />
              <DossierField label="Old DSO guess" value={p.affiliated_dso} />
              <DossierField label="Imported parent company" value={p.parent_company} />
            </div>
            {reasoning ? (
              <div
                className="bg-[#FAFAF7] rounded-md p-3 font-mono text-xs text-[#1A1A1A] leading-relaxed whitespace-pre-wrap border-l-2"
                style={{ borderLeftColor: ecColor }}
              >
                {reasoning}
              </div>
            ) : observations.length > 0 ? (
              <div
                className="bg-[#FAFAF7] rounded-md p-3 font-mono text-xs text-[#1A1A1A] leading-relaxed border-l-2"
                style={{ borderLeftColor: ecColor }}
              >
                <p className="italic text-[#707064] mb-2 text-[11px] font-sans">
                  Auto-generated observations (no stored detector reasoning):
                </p>
                <ul className="space-y-1">
                  {observations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="shrink-0 text-[#8F8E82] mt-0.5">&bull;</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div
                className="bg-[#FAFAF7] rounded-md p-3 font-mono text-xs text-[#8F8E82] leading-relaxed border-l-2 border-l-[#B5B5A8]"
              >
                No detector reasoning available.
              </div>
            )}
          </div>

          {/* ── Family Indicators ────────────────────────────────── */}
          {sharedLastNames && (
            <>
              <div className="border-t border-[#E8E5DE]" />
              <div className="px-4 py-4">
                <h4 className="text-[11px] uppercase tracking-wider text-[#707064] font-medium mb-2">
                  Family Indicators
                </h4>
                <div className="bg-[#FAFAF7] rounded-md p-3 border-l-2 border-l-[#D4920B]">
                  <p className="text-[13px] text-[#1A1A1A]">
                    Shared last names at address: <span className="font-medium text-[#D4920B]">{sharedLastNames}</span>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Providers at Address ─────────────────────────────── */}
          {sameAddress.length > 0 && (
            <>
              <div className="border-t border-[#E8E5DE]" />
              <div className="px-4 py-4">
                <h4 className="text-[11px] uppercase tracking-wider text-[#707064] font-medium mb-2">
                  Providers at Address
                </h4>
                <div className="bg-[#FAFAF7] rounded-md p-3 border-l-2 border-l-[#B8860B]">
                  <p className="text-[13px] text-[#1A1A1A] mb-2">
                    <span className="font-medium text-[#B8860B]">{sameAddress.length}</span>{' '}
                    other provider{sameAddress.length !== 1 ? 's' : ''} at this address
                  </p>
                  <ul className="space-y-0.5">
                    {sameAddress.slice(0, 10).map((pr) => (
                      <li key={pr.npi} className="text-xs text-[#6B6B60] font-mono truncate">
                        {displayValue(pr.practice_name)}
                      </li>
                    ))}
                    {sameAddress.length > 10 && (
                      <li className="text-xs text-[#8F8E82]">
                        +{sameAddress.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* ── Multi-ZIP Presence ───────────────────────────────── */}
          {totalZips >= 3 && multiZipData.count > 0 && (
            <>
              <div className="border-t border-[#E8E5DE]" />
              <div className="px-4 py-4">
                <h4 className="text-[11px] uppercase tracking-wider text-[#707064] font-medium mb-2">
                  Multi-ZIP Presence
                </h4>
                <div className="bg-[#FAFAF7] rounded-md p-3 border-l-2 border-l-[#C23B3B]">
                  <p className="text-[13px] text-[#1A1A1A] mb-2">
                    This practice name appears in{' '}
                    <span className="font-medium text-[#C23B3B]">{totalZips}</span>{' '}
                    ZIPs — a name-match signal only; the census network assignment
                    above is the ownership truth
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {multiZipData.zips.slice(0, 20).map((z) => (
                      <span
                        key={z}
                        className="inline-block rounded bg-[rgba(194,59,59,0.08)] px-2 py-0.5 text-[11px] font-mono text-[#C23B3B]"
                      >
                        {z}
                      </span>
                    ))}
                    {multiZipData.zips.length > 20 && (
                      <span className="text-[11px] text-[#8F8E82]">
                        +{multiZipData.zips.length - 20} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* bottom spacing */}
          <div className="h-4" />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function DossierField({
  label,
  value,
  dotColor,
}: {
  label: string
  value: string | number | null | undefined
  dotColor?: string
}) {
  const isEmpty = value == null || value === '' || value === '\u2014'
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-[#707064] font-medium mb-0.5">
        {label}
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        {dotColor && (
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className={`text-[14px] truncate ${isEmpty ? 'text-[#8F8E82]' : 'text-[#1A1A1A]'}`}
        >
          {isEmpty ? '\u2014' : String(value)}
        </span>
      </div>
    </div>
  )
}
