import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import {
  ArrowLeft,
  Briefcase,
  DollarSign,
  Globe2,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
} from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import {
  fetchNetworkSiblings,
  fetchPracticeLocationById,
  type PracticeLocationRecord,
} from "@/lib/supabase/queries/practice-locations"
import {
  CensusBadge,
  ReviewStatusBadge,
  formatNetworkName,
  getOwnershipTierMeta,
} from "@/components/data-display/census-badge"
import {
  SOURCE_CLASS_META,
  deriveSourceClass,
} from "@/lib/census/ownership-truth"
import {
  displayName,
  formatTitle,
  narrowReviewStatus,
  websiteHref,
} from "./_components/format"
import {
  PracticeTabs,
  type NetworkSiblingSummary,
} from "./_components/practice-tabs"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

function getUseCaseText(row: PracticeLocationRecord) {
  const reviewed = row.ownership_tier != null
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

  const siblings: NetworkSiblingSummary[] = row.network_id
    ? (await fetchNetworkSiblings(supabase, row.network_id, row.location_id)).map(
        (sibling) => ({
          locationId: sibling.location_id,
          name: displayName(sibling),
          city: sibling.city,
          zip: sibling.zip,
          ownershipTier: sibling.ownership_tier,
          peBacked: sibling.pe_backed,
        })
      )
    : []

  const name = displayName(row)
  const addressLine = [row.normalized_address, row.city, row.state, row.zip]
    .filter(Boolean)
    .join(", ")
  const practiceWebsite = websiteHref(row.website)
  const { jobValue, acquisitionValue } = getUseCaseText(row)
  const sourceClass = deriveSourceClass(
    row.ownership_tier,
    narrowReviewStatus(row.census_review_status)
  )

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
                <span className="text-right font-medium text-[#1A1A1A]">
                  {SOURCE_CLASS_META[sourceClass].label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Confidence</span>
                <span className="font-medium text-[#1A1A1A]">
                  {row.ownership_tier ? formatTitle(row.ownership_confidence) : "—"}
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
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Census Ownership"
            value={
              row.ownership_tier
                ? getOwnershipTierMeta(row.ownership_tier).label
                : "Unresolved"
            }
            note={SOURCE_CLASS_META[sourceClass].description}
          />
          <MetricBlock
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Job Hunt"
            value={jobValue}
            note="Uses provider count, staff size, and the census ownership record as a first-pass career signal."
          />
          <MetricBlock
            icon={<Target className="h-3.5 w-3.5" />}
            label="Acquisition Scout"
            value={acquisitionValue}
            note="Lead-filter score only — candidacy is gated on the census tier (dentist-owned T1/T2)."
          />
        </section>

        <PracticeTabs row={row} siblings={siblings} />

        <section className="mt-6 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#B8860B]" />
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
