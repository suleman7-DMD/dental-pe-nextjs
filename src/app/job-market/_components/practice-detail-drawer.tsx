'use client'

import { useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/data-display/status-badge'
import { Badge } from '@/components/ui/badge'
import { formatStatus } from '@/lib/utils/formatting'

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
      'Limited business data -- NPPES registration data only. Employee count, revenue, and year established not available.'
    )
  }

  return observations
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function classificationLabel(ec: unknown): string {
  if (ec == null || typeof ec !== 'string' || !ec) return 'Not classified'
  return ec.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

function entityTypeLabel(et: string | null | undefined): string {
  if (et === '1') return 'Individual'
  if (et === '2') return 'Organization'
  return '--'
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

  // Multi-ZIP presence
  const otherZipCount = useMemo(() => {
    if (!p?.practice_name) return 0
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
    return otherZips.size
  }, [p, allPractices])

  if (!p) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent className="bg-[#0B1121] border-[#1E2A3A]" />
      </Sheet>
    )
  }

  const hasDa = p.data_axle_import_date != null && p.data_axle_import_date !== ''
  const reasoning = p.classification_reasoning
  const observations = !reasoning ? generateBasicObservations(p) : []

  return (
    <Sheet open={isOpen} onOpenChange={() => onClose()}>
      <SheetContent
        className="bg-[#0B1121] border-[#1E2A3A] w-full sm:max-w-lg overflow-y-auto"
        side="right"
      >
        <SheetHeader>
          <SheetTitle className="text-[#E8ECF1] font-['DM_Sans'] font-bold text-lg">
            {p.practice_name ?? 'Unknown Practice'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Enrichment badge */}
          <div>
            {hasDa ? (
              <Badge className="bg-[#4CAF50] text-white text-xs">
                Fully enriched (Data Axle + NPPES)
              </Badge>
            ) : (
              <Badge className="bg-[#FFB300] text-white text-xs">NPPES-only data</Badge>
            )}
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Basic Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#8892A0] uppercase tracking-wider">
                Basic Information
              </h4>
              <InfoRow label="Name" value={p.practice_name} />
              <InfoRow label="Address" value={p.address} />
              <InfoRow
                label="City/ZIP"
                value={`${p.city ?? '--'}, ${p.state ?? '--'} ${(p.zip ?? '').toString().slice(0, 5)}`}
              />
              <InfoRow label="Phone" value={p.phone} />
              <InfoRow label="Entity Type" value={entityTypeLabel(p.entity_type)} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8892A0]">Ownership:</span>
                <StatusBadge status={p.ownership_status ?? 'unknown'} />
              </div>
            </div>

            {/* Right: Classification & Scoring */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#8892A0] uppercase tracking-wider">
                Classification & Scoring
              </h4>
              <InfoRow
                label="Entity Classification"
                value={classificationLabel(p.entity_classification)}
              />
              <InfoRow
                label="Buyability Score"
                value={
                  p.buyability_score != null
                    ? Number(p.buyability_score).toFixed(0)
                    : '--'
                }
              />
              {hasDa && (
                <>
                  <InfoRow
                    label="Year Established"
                    value={
                      p.year_established != null
                        ? Math.floor(Number(p.year_established)).toString()
                        : '--'
                    }
                  />
                  <InfoRow
                    label="Employee Count"
                    value={
                      p.employee_count != null
                        ? Math.floor(Number(p.employee_count)).toString()
                        : '--'
                    }
                  />
                  <InfoRow
                    label="Est. Revenue"
                    value={
                      p.estimated_revenue != null
                        ? `$${Number(p.estimated_revenue).toLocaleString()}`
                        : '--'
                    }
                  />
                  <InfoRow label="Parent Company" value={p.parent_company} />
                </>
              )}
            </div>
          </div>

          {/* Classification Reasoning */}
          <div>
            <h4 className="text-xs font-semibold text-[#8892A0] uppercase tracking-wider mb-2">
              Classification Reasoning
            </h4>
            {reasoning ? (
              <div className="bg-[#141922] border border-[#1E2A3A] rounded-md p-3 text-sm text-[#c8d6e5] leading-relaxed">
                {reasoning}
              </div>
            ) : observations.length > 0 ? (
              <div className="bg-[#141922] border border-[#1E2A3A] rounded-md p-3 text-sm text-[#c8d6e5] leading-relaxed">
                <p className="italic text-[#8892A0] mb-1 text-xs">
                  Auto-generated observations (no stored reasoning):
                </p>
                <ul className="space-y-1">
                  {observations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="shrink-0 text-[#8892A0]">&bull;</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-[#8892A0]">No reasoning available.</p>
            )}
          </div>

          {/* Providers at same address */}
          {sameAddress.length > 0 && (
            <div>
              <p className="text-sm text-[#E8ECF1]">
                <strong>Other providers at this address:</strong> {sameAddress.length}
              </p>

              {sharedLastNames && (
                <p className="text-sm text-[#E8ECF1] mt-1">
                  <strong>Family indicator:</strong> Shared last names: {sharedLastNames}
                </p>
              )}
            </div>
          )}

          {/* Multi-ZIP presence */}
          {otherZipCount > 0 && (
            <p className="text-sm text-[#E8ECF1]">
              <strong>Multi-location:</strong> This practice name appears in {otherZipCount}{' '}
              other ZIP(s)
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div>
      <span className="text-xs text-[#8892A0]">{label}:</span>{' '}
      <span className="text-sm text-[#E8ECF1]">{value ?? '--'}</span>
    </div>
  )
}
