import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Globe2, MapPin, Phone } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import {
  fetchNetworkSiblings,
  fetchPracticeLocationById,
} from "@/lib/supabase/queries/practice-locations"
import {
  CensusBadge,
  ReviewStatusBadge,
  formatNetworkName,
} from "@/components/data-display/census-badge"
import {
  SOURCE_CLASS_META,
  deriveSourceClass,
} from "@/lib/census/ownership-truth"
import { deriveJobLane } from "@/lib/census/job-lane"
import { ManualCorrectionPanel } from "@/components/data-display/manual-correction-panel"
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
import { UsePracticeCard } from "./_components/use-practice-card"

export const dynamic = "force-dynamic"
export const revalidate = 0

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
  const sourceClass = deriveSourceClass(
    row.ownership_tier,
    narrowReviewStatus(row.census_review_status)
  )
  const lane = deriveJobLane(row)

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/directory"
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

            <div className="grid w-full gap-2 rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4 text-sm lg:w-[340px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Job-hunt lane</span>
                <span
                  className="text-right font-semibold"
                  style={{ color: lane.color }}
                >
                  {lane.label}
                </span>
              </div>
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
                <span className="text-[#6B6B60]">Owner on record</span>
                <span className="text-right text-[#8F8E82]">Not on file yet</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Operating group / network</span>
                <span className="text-right font-medium text-[#1A1A1A]">
                  {formatNetworkName(row.network_id) ?? "None assigned"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">PE sponsor</span>
                <span className="text-right font-medium text-[#1A1A1A]">
                  {row.pe_backed === true
                    ? "PE-backed (census-confirmed)"
                    : "None documented"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Current doctors</span>
                <span className="text-right text-[#8F8E82]">
                  Not website-verified yet
                </span>
              </div>
              <p className="mt-1 border-t border-[#E8E5DE] pt-2 text-[11px] leading-4 text-[#6B6B60]">
                Still missing: {lane.missing.join(" · ")}
              </p>
            </div>
          </div>
        </section>

        <UsePracticeCard row={row} />

        <PracticeTabs row={row} siblings={siblings} />

        {/* Corrections — anything wrong on this page can be reported in place */}
        <section className="mt-6 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
          <ManualCorrectionPanel
            locationId={row.location_id}
            npi={row.primary_npi}
            practiceName={name}
            fields={[
              {
                key: "practice_name",
                label: "Current practice name",
                currentValue: name,
                placeholder: "Name shown on the practice website",
              },
              {
                key: "owner_doctor_or_group",
                label: "Owner doctor / group",
                currentValue: formatNetworkName(row.network_id),
                placeholder: "Example: Dr. Jane Smith, DDS",
              },
              {
                key: "operating_doctors",
                label: "Doctors currently shown on website",
                currentValue: null,
                placeholder: "Example: Dr. A; Dr. B; Dr. C",
              },
              {
                key: "provider_count",
                label: "Provider count",
                currentValue: row.provider_count,
                inputMode: "numeric",
              },
              {
                key: "employee_count",
                label: "Employee count",
                currentValue: row.employee_count,
                inputMode: "numeric",
              },
              {
                key: "website",
                label: "Website",
                currentValue: row.website,
              },
            ]}
          />
        </section>

      </div>
    </main>
  )
}
