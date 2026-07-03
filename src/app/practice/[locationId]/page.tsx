import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  DollarSign,
  ExternalLink,
  FileCheck2,
  Globe2,
  MapPin,
  Network,
  Phone,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import {
  fetchPracticeLocationById,
  type PracticeLocationRecord,
} from "@/lib/supabase/queries/practice-locations"
import {
  CensusBadge,
  ReviewStatusBadge,
  formatNetworkName,
  getOwnershipTierMeta,
  getReviewStatus,
} from "@/components/data-display/census-badge"
import { getEntityClassificationLabel } from "@/lib/constants/entity-classifications"

export const dynamic = "force-dynamic"
export const revalidate = 0

function displayName(row: PracticeLocationRecord): string {
  return row.doing_business_as ?? row.practice_name ?? "Unnamed practice"
}

function formatTitle(value: string | null | undefined): string {
  if (!value) return "Not available"
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCurrency(value: number | null): string {
  if (value == null) return "Not available"
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${Math.round(value / 1000).toLocaleString()}K`
  return `$${value.toLocaleString()}`
}

function parseStringList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  } catch {
    // Fall through to comma/newline parsing.
  }
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return null
}

function websiteHref(value: string | null): string | null {
  if (!value) return null
  return normalizeUrl(value) ?? `https://${value}`
}

function ownershipNode(row: PracticeLocationRecord): string {
  const tier = row.ownership_tier
  if (!tier) return "Awaiting review"
  if (tier === "true_independent") return "Independent operator"
  if (tier === "single_loc_group") return "Single-site group"
  if (tier === "institutional") return "Institutional clinic"
  return (
    formatNetworkName(row.network_id) ??
    row.affiliated_dso ??
    row.parent_company ??
    getOwnershipTierMeta(tier).label
  )
}

function sponsorNode(row: PracticeLocationRecord): string {
  if (row.affiliated_pe_sponsor) return row.affiliated_pe_sponsor
  if (row.pe_backed) return "PE-backed sponsor cited"
  if (row.ownership_tier === "stealth_dso" || row.ownership_tier === "branded_dso") {
    return "Sponsor not cited"
  }
  return "No PE sponsor"
}

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

function MetricBlock({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-xl font-bold text-[#1A1A1A]">{value}</div>
      <p className="mt-1 text-xs leading-5 text-[#6B6B60]">{note}</p>
    </div>
  )
}

function OwnershipTree({ row }: { row: PracticeLocationRecord }) {
  const nodes = [
    { label: "Practice", value: displayName(row), icon: Building2 },
    { label: "Owner / network", value: ownershipNode(row), icon: Network },
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

function getUseCaseText(row: PracticeLocationRecord) {
  const reviewed = getReviewStatus(row.ownership_tier) !== "not_reviewed"
  const providerCount = row.provider_count ?? 0
  const employeeCount = row.employee_count ?? 0
  const jobValue =
    providerCount >= 4 || employeeCount >= 10
      ? "Strong hiring signal"
      : reviewed
        ? "Review in Job Hunt"
        : "Wait for review"
  const acquisitionValue =
    row.buyability_score != null
      ? `${Math.round(row.buyability_score)} / 100`
      : row.ownership_tier === "true_independent" || row.ownership_tier === "single_loc_group"
        ? "Needs scoring"
        : "Low priority"

  return { jobValue, acquisitionValue }
}

export default async function PracticePage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const supabase = await createServerClient()
  const row = await fetchPracticeLocationById(supabase, locationId)

  if (!row) notFound()

  const name = displayName(row)
  const addressLine = [row.normalized_address, row.city, row.state, row.zip]
    .filter(Boolean)
    .join(", ")
  const providerNpis = parseStringList(row.provider_npis)
  const evidenceUrls = parseStringList(row.ownership_evidence_urls)
  const practiceWebsite = websiteHref(row.website)
  const { jobValue, acquisitionValue } = getUseCaseText(row)
  const reviewStatus = getReviewStatus(row.ownership_tier)

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/job-market"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6B6B60] hover:text-[#1A1A1A]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>

        <section className="mt-5 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ReviewStatusBadge tier={row.ownership_tier} />
                <CensusBadge tier={row.ownership_tier} peBacked={row.pe_backed} />
              </div>
              <h1 className="mt-4 font-sans text-3xl font-bold leading-tight text-[#1A1A1A]">
                {name}
              </h1>
              {row.practice_name && row.practice_name !== name ? (
                <p className="mt-1 text-sm text-[#6B6B60]">{row.practice_name}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6B6B60]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#B8860B]" />
                  {addressLine || "Address not available"}
                </span>
                {row.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-[#B8860B]" />
                    {row.phone}
                  </span>
                ) : null}
                {practiceWebsite ? (
                  <a
                    href={practiceWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#8B6508] hover:text-[#1A1A1A]"
                  >
                    <Globe2 className="h-4 w-4" />
                    Website
                  </a>
                ) : null}
              </div>
            </div>

            <div className="grid w-full gap-2 rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4 text-sm lg:w-[300px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Review state</span>
                <span className="font-medium text-[#1A1A1A]">{formatTitle(reviewStatus)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Confidence</span>
                <span className="font-medium text-[#1A1A1A]">
                  {formatTitle(row.ownership_confidence)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Network</span>
                <span className="text-right font-medium text-[#1A1A1A]">
                  {formatNetworkName(row.network_id) ?? "Not assigned"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricBlock
            icon={<Users className="h-3.5 w-3.5" />}
            label="Practice Shape"
            value={getEntityClassificationLabel(row.entity_classification)}
            note="Legacy detector class, kept as context below the hand-reviewed census tier."
          />
          <MetricBlock
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Job Hunt"
            value={jobValue}
            note="Uses provider count, staff size, and ownership context as a first-pass career signal."
          />
          <MetricBlock
            icon={<Target className="h-3.5 w-3.5" />}
            label="Acquisition Scout"
            value={acquisitionValue}
            note="Existing buyability score remains a lead filter until census evidence is complete."
          />
        </section>

        <section className="mt-6 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Network className="h-4 w-4 text-[#B8860B]" />
            <h2 className="text-base font-semibold text-[#1A1A1A]">Ownership Tree</h2>
          </div>
          <OwnershipTree row={row} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[#B8860B]" />
              <h2 className="text-base font-semibold text-[#1A1A1A]">Evidence</h2>
            </div>
            <p className="text-sm leading-6 text-[#3D3D35]">
              {row.ownership_evidence_basis ??
                "No ownership reasoning is synced for this row yet. It will appear here after the research batch is merged."}
            </p>
            <div className="mt-4">
              <EvidenceLinks urls={evidenceUrls} />
            </div>
          </div>

          <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#B8860B]" />
              <h2 className="text-base font-semibold text-[#1A1A1A]">Practice Details</h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              <DetailItem label="Providers" value={row.provider_count} />
              <DetailItem label="Provider NPIs" value={providerNpis.length || null} />
              <DetailItem label="Employees" value={row.employee_count} />
              <DetailItem label="Est. Revenue" value={formatCurrency(row.estimated_revenue)} />
              <DetailItem label="Established" value={row.year_established} />
              <DetailItem label="Buyability" value={row.buyability_score == null ? null : Math.round(row.buyability_score)} />
              <DetailItem label="Primary NPI" value={row.primary_npi} />
              <DetailItem label="ZIP" value={row.zip} />
            </dl>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#B8860B]" />
            <h2 className="text-base font-semibold text-[#1A1A1A]">Use This Record</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Link
              href={`/launchpad?practice=${encodeURIComponent(row.location_id)}`}
              className="rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4 hover:border-[#D4D0C8] hover:bg-[#F0EEE8]"
            >
              <Briefcase className="h-4 w-4 text-[#7C3AED]" />
              <div className="mt-3 text-sm font-semibold text-[#1A1A1A]">Job Hunt</div>
              <p className="mt-1 text-xs leading-5 text-[#6B6B60]">
                Evaluate associate fit, practice pace, and ownership risk.
              </p>
            </Link>
            <Link
              href={`/buyability?practice=${encodeURIComponent(row.location_id)}`}
              className="rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4 hover:border-[#D4D0C8] hover:bg-[#F0EEE8]"
            >
              <DollarSign className="h-4 w-4 text-[#D4920B]" />
              <div className="mt-3 text-sm font-semibold text-[#1A1A1A]">Acquisition Scout</div>
              <p className="mt-1 text-xs leading-5 text-[#6B6B60]">
                Check succession, staffing, revenue, and independence signals.
              </p>
            </Link>
            <Link
              href={`/market-intel?zip=${encodeURIComponent(row.zip ?? "")}`}
              className="rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4 hover:border-[#D4D0C8] hover:bg-[#F0EEE8]"
            >
              <MapPin className="h-4 w-4 text-[#2D8B4E]" />
              <div className="mt-3 text-sm font-semibold text-[#1A1A1A]">Market View</div>
              <p className="mt-1 text-xs leading-5 text-[#6B6B60]">
                Compare this location against its ZIP and nearby ownership mix.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
