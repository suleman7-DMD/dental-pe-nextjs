"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArchiveRestore,
  ArrowUpRight,
  Briefcase,
  Building2,
  ExternalLink,
  FileCheck2,
  Network,
  ShieldCheck,
  Target,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PracticeLocationRecord } from "@/lib/supabase/queries/practice-locations"
import {
  CensusBadge,
  formatNetworkName,
  getOwnershipTierMeta,
} from "@/components/data-display/census-badge"
import {
  LEGACY_DETECTOR_CONTEXT_LABEL,
  SOURCE_CLASS_META,
  getOwnershipRecord,
  formatNetworkId,
  type OwnershipRecord,
} from "@/lib/census/ownership-truth"
import { getEntityClassificationLabel } from "@/lib/constants/entity-classifications"
import {
  acquisitionVerdict,
  displayName,
  formatCurrency,
  formatTitle,
  narrowReviewStatus,
  normalizeUrl,
  parseStringList,
} from "./format"

/** Serializable sibling projection built server-side (keeps the payload light). */
export interface NetworkSiblingSummary {
  locationId: string
  name: string
  city: string | null
  zip: string | null
  ownershipTier: string | null
  peBacked: boolean | null
}

interface PracticeTabsProps {
  row: PracticeLocationRecord
  siblings: NetworkSiblingSummary[]
}

// ────────────────────────────────────────────────────────────────────────────
// Ownership tree nodes — census truth only. The legacy detector's
// affiliated_dso / parent_company / affiliated_pe_sponsor never appear here;
// they live in the Raw source audit tab, labeled as detector context.
// ────────────────────────────────────────────────────────────────────────────

function ownershipNode(row: PracticeLocationRecord): string {
  const tier = row.ownership_tier
  if (!tier) return "Awaiting review"
  if (tier === "true_independent") return "True independent"
  if (tier === "single_loc_group") return "Dentist-owned group"
  if (tier === "institutional") return "Institutional clinic"
  return formatNetworkName(row.network_id) ?? getOwnershipTierMeta(tier).label
}

function sponsorNode(row: PracticeLocationRecord): string {
  if (row.pe_backed) return "PE-backed"
  if (!row.ownership_tier) return "Awaiting review"
  if (row.ownership_tier === "stealth_dso" || row.ownership_tier === "branded_dso") {
    return "No PE sponsor cited"
  }
  return "No PE sponsor"
}

// ────────────────────────────────────────────────────────────────────────────
// Shared blocks
// ────────────────────────────────────────────────────────────────────────────

function detailValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "Not available"
  return String(value)
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[#1A1A1A]">{detailValue(value)}</dd>
    </div>
  )
}

function Panel({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function SourceClassChip({ record }: { record: OwnershipRecord }) {
  const meta = SOURCE_CLASS_META[record.statusClass]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[#6B6B60]"
      title={meta.description}
    >
      {meta.label}
    </span>
  )
}

function OwnershipTree({ row }: { row: PracticeLocationRecord }) {
  const nodes = [
    { label: "Practice", value: displayName(row), icon: Building2 },
    { label: "Owner / group", value: ownershipNode(row), icon: Network },
    { label: "Sponsor", value: sponsorNode(row), icon: ShieldCheck },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {nodes.map((node, index) => {
        const Icon = node.icon
        return (
          <div key={node.label} className="relative rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4">
            {index < nodes.length - 1 ? (
              <div className="absolute right-[-16px] top-1/2 hidden h-px w-8 bg-[#D4D0C8] md:block" />
            ) : null}
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
              <Icon className="h-3.5 w-3.5" />
              {node.label}
            </div>
            <div className="mt-3 text-sm font-semibold leading-5 text-[#1A1A1A]">
              {node.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EvidenceLinks({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return (
      <p className="text-sm leading-6 text-[#6B6B60]">
        Evidence URLs are not synced for this row yet.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url) => {
        const normalized = normalizeUrl(url)
        if (!normalized) return null
        let host = normalized
        try {
          host = new URL(normalized).hostname.replace(/^www\./, "")
        } catch {
          return null
        }
        return (
          <a
            key={normalized}
            href={normalized}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-1.5 text-xs font-medium text-[#1A1A1A] hover:border-[#D4D0C8] hover:bg-[#F0EEE8]"
          >
            {host}
            <ExternalLink className="h-3 w-3 text-[#8F8E82]" />
          </a>
        )
      })}
    </div>
  )
}

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-2 text-sm font-medium text-[#1A1A1A] hover:border-[#D4D0C8] hover:bg-[#F0EEE8]"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 text-[#8F8E82]" />
    </Link>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Per-tab honest context lines (census tier drives every claim)
// ────────────────────────────────────────────────────────────────────────────

function jobHuntContext(row: PracticeLocationRecord): string {
  switch (row.ownership_tier) {
    case "stealth_dso":
    case "branded_dso":
      return row.pe_backed
        ? "DSO employment with reviewed PE ownership — associate roles here are corporate employment. Check the network's reputation before applying."
        : "DSO employment — associate roles here are corporate employment. Check the network's reputation before applying."
    case "institutional":
      return "Institutional setting (hospital / university / public health) — employment terms differ from private practice."
    case "true_independent":
      return "Solo owner-operator — associate demand is rare here; openings usually mean growth or succession."
    case "single_loc_group":
    case "dentist_multi":
      return "Dentist-owned group — plausible associate hiring without corporate employment terms."
    default:
      return "Ownership unresolved — treat the employment context as unknown until this location is reviewed."
  }
}

function acquisitionContext(row: PracticeLocationRecord): string {
  switch (row.ownership_tier) {
    case "true_independent":
    case "single_loc_group":
      return "Reviewed dentist-owned single-location office. Succession signals below are worth reading."
    case "dentist_multi":
      return "Dentist-owned multi-location network — an acquisition would involve the network, not just this site."
    case "stealth_dso":
    case "branded_dso":
      return "Not an acquisition target — reviewed as DSO/corporate controlled."
    case "institutional":
      return "Not an acquisition target — institutional setting."
    default:
      return "Not reviewed yet — this location cannot be qualified as a candidate until ownership is resolved."
  }
}

function hiringSignal(row: PracticeLocationRecord): string {
  const providerCount = row.provider_count ?? 0
  const employeeCount = row.employee_count ?? 0
  if (providerCount >= 4 || employeeCount >= 10) return "Strong hiring signal"
  return row.ownership_tier ? "Moderate — review in Job Hunt" : "Unknown — awaiting census review"
}

// ────────────────────────────────────────────────────────────────────────────
// The five tabs (SPEC_TRUTH_APP_ROUTES_20260704.md §6)
// ────────────────────────────────────────────────────────────────────────────

export function PracticeTabs({ row, siblings }: PracticeTabsProps) {
  const record = getOwnershipRecord(row, narrowReviewStatus(row.census_review_status))
  const evidenceUrls = parseStringList(row.ownership_evidence_urls)
  const providerNpis = parseStringList(row.provider_npis)
  const dataSources = parseStringList(row.data_sources)
  const taxonomyCodes = parseStringList(row.taxonomy_codes)
  const networkLabel = row.network_id ? formatNetworkId(row.network_id) : null
  const practiceAge =
    row.year_established != null && row.year_established > 1900
      ? new Date().getFullYear() - row.year_established
      : null

  return (
    <Tabs defaultValue="ownership" className="mt-6">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-[#FFFFFF] border border-[#E8E5DE] p-1">
        <TabsTrigger value="ownership" className="px-3 py-1.5">
          Ownership
        </TabsTrigger>
        <TabsTrigger value="job-hunt" className="px-3 py-1.5">
          Job Hunt
        </TabsTrigger>
        <TabsTrigger value="acquisition" className="px-3 py-1.5">
          Acquisition &amp; succession
        </TabsTrigger>
        <TabsTrigger value="network" className="px-3 py-1.5">
          Related Offices
          {siblings.length > 0 ? (
            <span className="ml-1 rounded-full bg-[#F7F7F4] px-1.5 py-0.5 text-[10px] font-medium text-[#6B6B60]">
              {siblings.length}
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="raw-audit" className="px-3 py-1.5">
          Older data
        </TabsTrigger>
      </TabsList>

      {/* ── 1 · Ownership & evidence ──────────────────────────────────────── */}
      <TabsContent value="ownership" className="mt-4 space-y-4">
        <Panel icon={<Network className="h-4 w-4 text-[#B8860B]" />} title="Reviewed Ownership">
          <div className="flex flex-wrap items-center gap-2">
            <CensusBadge tier={row.ownership_tier} peBacked={row.pe_backed} />
            <SourceClassChip record={record} />
            {record.tierCode ? (
              <span className="rounded-full border border-[#E8E5DE] bg-[#FAFAF7] px-2.5 py-1 text-[11px] font-medium text-[#6B6B60]">
                {record.tierCode}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-[#3D3D35]">
            {record.tier
              ? getOwnershipTierMeta(record.tier).description
              : SOURCE_CLASS_META[record.statusClass].description}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
            <DetailItem label="Review state" value={SOURCE_CLASS_META[record.statusClass].label} />
            <DetailItem
              label="Confidence"
              value={record.confidence ? formatTitle(record.confidence) : "Not stated"}
            />
            <DetailItem label="Owner / group" value={networkLabel ?? "Not assigned"} />
            <DetailItem label="PE-backed" value={record.peBacked ? "Yes" : "No"} />
          </dl>
          <div className="mt-5">
            <OwnershipTree row={row} />
          </div>
        </Panel>

        <Panel icon={<FileCheck2 className="h-4 w-4 text-[#B8860B]" />} title="Why we believe this">
          <p className="text-sm leading-6 text-[#3D3D35]">
            {row.ownership_evidence_basis ??
              "No ownership reasoning is synced for this row yet. It will appear here after the research batch is merged."}
          </p>
          <div className="mt-4">
            <EvidenceLinks urls={evidenceUrls} />
          </div>
        </Panel>
      </TabsContent>

      {/* ── 2 · Job-hunt intel ────────────────────────────────────────────── */}
      <TabsContent value="job-hunt" className="mt-4">
        <Panel icon={<Briefcase className="h-4 w-4 text-[#B8860B]" />} title="Job-Hunt Intel">
          <p className="text-sm leading-6 text-[#3D3D35]">{jobHuntContext(row)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
            <DetailItem label="Hiring signal" value={hiringSignal(row)} />
            <DetailItem label="Providers" value={row.provider_count} />
            <DetailItem label="Employees" value={row.employee_count} />
            <DetailItem label="Phone" value={row.phone} />
          </dl>
          <div className="mt-5">
            <CtaLink
              href={`/launchpad?practice=${encodeURIComponent(row.location_id)}`}
              label="Open in Job Hunt"
            />
          </div>
        </Panel>
      </TabsContent>

      {/* ── 3 · Acquisition & succession ──────────────────────────────────── */}
      <TabsContent value="acquisition" className="mt-4">
        <Panel icon={<Target className="h-4 w-4 text-[#B8860B]" />} title="Acquisition & Succession">
          <p className="text-sm leading-6 text-[#3D3D35]">{acquisitionContext(row)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
            <DetailItem
              label="Established"
              value={
                row.year_established != null
                  ? practiceAge != null
                    ? `${row.year_established} (${practiceAge} yrs)`
                    : row.year_established
                  : null
              }
            />
            <DetailItem label="Employees" value={row.employee_count} />
            <DetailItem label="Est. revenue" value={formatCurrency(row.estimated_revenue)} />
            <DetailItem label="Acquisition verdict" value={acquisitionVerdict(row)} />
          </dl>
          <p className="mt-3 text-xs leading-5 text-[#8F8E82]">
            This is an early lead score. A real acquisition target still needs current
            ownership and succession review.
          </p>
          <div className="mt-4">
            <CtaLink
              href={`/buyability?practice=${encodeURIComponent(row.location_id)}`}
              label="Open in Acquisition Scout"
            />
          </div>
        </Panel>
      </TabsContent>

      {/* ── 4 · Network siblings ──────────────────────────────────────────── */}
      <TabsContent value="network" className="mt-4">
        <Panel icon={<Building2 className="h-4 w-4 text-[#B8860B]" />} title="Related Offices">
          {row.network_id ? (
            <>
              <p className="text-sm leading-6 text-[#3D3D35]">
                Reviewed group <span className="font-semibold">{networkLabel}</span>
                {" — "}
                {siblings.length > 0
                  ? `${siblings.length} other reviewed location${siblings.length === 1 ? "" : "s"} share this network assignment.`
                  : "no other locations are recorded in this network yet."}
              </p>
              {siblings.length > 0 ? (
                <ul className="mt-4 divide-y divide-[#E8E5DE] rounded-lg border border-[#E8E5DE]">
                  {siblings.map((sibling) => (
                    <li key={sibling.locationId}>
                      <Link
                        href={`/practice/${encodeURIComponent(sibling.locationId)}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[#FAFAF7]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[#1A1A1A]">
                            {sibling.name}
                          </span>
                          <span className="block text-xs text-[#6B6B60]">
                            {[sibling.city, sibling.zip].filter(Boolean).join(" · ") ||
                              "Location details not synced"}
                          </span>
                        </span>
                        <CensusBadge
                          tier={sibling.ownershipTier}
                          peBacked={sibling.peBacked}
                          compact
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-6 text-[#6B6B60]">
              {row.ownership_tier
                ? "No related offices are assigned — this location is not recorded as part of a multi-location group."
                : "Not reviewed yet — related-office membership is unknown until review."}
            </p>
          )}
        </Panel>
      </TabsContent>

      {/* ── 5 · Raw source audit ──────────────────────────────────────────── */}
      <TabsContent value="raw-audit" className="mt-4 space-y-4">
        <div className="rounded-lg border border-[#D4920B]/40 bg-[#D4920B]/5 p-4">
          <p className="text-sm font-semibold text-[#8B6508]">
            {LEGACY_DETECTOR_CONTEXT_LABEL}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#6B6B60]">
            These are older automated inputs and registry fields. They are useful for auditing
            data problems, but they are not the ownership answer. Use the reviewed ownership
            section above.{" "}
            <Link href="/data-breakdown" className="font-medium text-[#8B6508] underline hover:text-[#1A1A1A]">
              How the detector worked → Methodology
            </Link>
          </p>
        </div>

        <Panel
          icon={<ArchiveRestore className="h-4 w-4 text-[#B8860B]" />}
          title="Older Automated Estimate"
        >
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-3">
            <DetailItem
              label="Old automated class"
              value={getEntityClassificationLabel(row.entity_classification)}
            />
            <DetailItem label="Old ownership guess" value={formatTitle(row.ownership_status)} />
            <DetailItem
              label="Old confidence"
              value={row.classification_confidence == null ? null : `${Math.round(row.classification_confidence)} / 100`}
            />
            <DetailItem label="Old DSO guess" value={row.affiliated_dso} />
            <DetailItem label="Old PE sponsor guess" value={row.affiliated_pe_sponsor} />
            <DetailItem label="Imported parent company" value={row.parent_company} />
          </dl>
          {row.classification_reasoning ? (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
                Old automated reasoning
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 font-mono text-xs leading-5 text-[#3D3D35]">
                {row.classification_reasoning}
              </pre>
            </div>
          ) : null}
        </Panel>

        <Panel icon={<Building2 className="h-4 w-4 text-[#B8860B]" />} title="Registry & Source Rows">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-3">
            <DetailItem label="Primary NPI" value={row.primary_npi} />
            <DetailItem label="Provider NPIs" value={providerNpis.length || null} />
            <DetailItem label="EIN" value={row.ein} />
            <DetailItem
              label="Business details"
              value={row.data_axle_enriched == null ? null : row.data_axle_enriched ? "Yes" : "No"}
            />
            <DetailItem label="Data sources" value={dataSources.join(", ") || null} />
            <DetailItem
              label="Row updated"
              value={row.updated_at ? row.updated_at.slice(0, 10) : null}
            />
          </dl>
          {providerNpis.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
                Provider NPIs at this location
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {providerNpis.slice(0, 24).map((npi) => (
                  <span
                    key={npi}
                    className="rounded border border-[#E8E5DE] bg-[#FAFAF7] px-2 py-0.5 font-mono text-[11px] text-[#3D3D35]"
                  >
                    {npi}
                  </span>
                ))}
                {providerNpis.length > 24 ? (
                  <span className="px-1 py-0.5 text-[11px] text-[#8F8E82]">
                    +{providerNpis.length - 24} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {taxonomyCodes.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
                Taxonomy codes
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {taxonomyCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded border border-[#E8E5DE] bg-[#FAFAF7] px-2 py-0.5 font-mono text-[11px] text-[#3D3D35]"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </TabsContent>
    </Tabs>
  )
}
