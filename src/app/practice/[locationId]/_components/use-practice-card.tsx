import Link from "next/link"
import { ArrowUpRight, Compass, Briefcase, Target } from "lucide-react"
import type { PracticeLocationRecord } from "@/lib/supabase/queries/practice-locations"
import {
  TrustSourceTag,
  type TrustSource,
} from "@/components/data-display/trust-source-tag"
import { acquisitionVerdict, formatCurrency } from "./format"

// ────────────────────────────────────────────────────────────────────────────
// "Use this practice" header card — the page's single answer to "what do I do
// with this office?" (§7.1 redesign). Replaces the old Job Hunt + Acquisition
// tabs and the header MetricBlocks that duplicated them with drifted strings.
// The reviewed census tier drives every claim; the heuristic lead score never
// headlines here (its raw value lives in the Older data tab).
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
      return "No ownership answer yet — treat the employment context as unknown until this office gets one."
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
      return "No ownership answer yet — this location cannot be qualified as a candidate until ownership is resolved."
  }
}

function hiringSignal(row: PracticeLocationRecord): string {
  const providerCount = row.provider_count ?? 0
  const employeeCount = row.employee_count ?? 0
  if (providerCount >= 4 || employeeCount >= 10) return "Strong hiring signal"
  return row.ownership_tier ? "Moderate — review in Job Hunt" : "Unknown — awaiting review"
}

function Stat({
  label,
  value,
  source,
}: {
  label: string
  value: string | number | null
  source: TrustSource
}) {
  const empty = value == null || value === "" || value === "Not available"
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
        {label}
      </dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-[#1A1A1A]">
        {empty ? "Not available" : String(value)}
        <TrustSourceTag source={empty ? "missing" : source} />
      </dd>
    </div>
  )
}

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2 text-sm font-medium text-[#1A1A1A] hover:border-[#D4D0C8] hover:bg-[#F0EEE8]"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 text-[#8F8E82]" />
    </Link>
  )
}

export function UsePracticeCard({ row }: { row: PracticeLocationRecord }) {
  const practiceAge =
    row.year_established != null && row.year_established > 1900
      ? new Date().getFullYear() - row.year_established
      : null

  return (
    <section className="mt-6 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Compass className="h-4 w-4 text-[#B8860B]" />
        <h2 className="text-base font-semibold text-[#1A1A1A]">Use this practice</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
            <Briefcase className="h-3.5 w-3.5" />
            Job Hunt
          </div>
          <div className="mt-2 text-lg font-bold leading-6 text-[#1A1A1A]">
            {hiringSignal(row)}
          </div>
          <p className="mt-1 text-sm leading-6 text-[#3D3D35]">{jobHuntContext(row)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat label="Providers" value={row.provider_count} source="registry_only" />
            <Stat label="Employees" value={row.employee_count} source="commercial_estimate" />
          </dl>
          <div className="mt-4">
            <CtaLink
              href={`/launchpad?practice=${encodeURIComponent(row.location_id)}`}
              label="Open in Job Hunt"
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#8F8E82]">
            <Target className="h-3.5 w-3.5" />
            Acquisition
          </div>
          <div className="mt-2 text-lg font-bold leading-6 text-[#1A1A1A]">
            {acquisitionVerdict(row)}
          </div>
          <p className="mt-1 text-sm leading-6 text-[#3D3D35]">{acquisitionContext(row)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat
              label="Established"
              value={
                row.year_established != null
                  ? practiceAge != null
                    ? `${row.year_established} (${practiceAge} yrs)`
                    : row.year_established
                  : null
              }
              source="commercial_estimate"
            />
            <Stat
              label="Est. revenue"
              value={formatCurrency(row.estimated_revenue)}
              source="commercial_estimate"
            />
          </dl>
          <div className="mt-4">
            <CtaLink
              href={`/buyability?practice=${encodeURIComponent(row.location_id)}`}
              label="Open in Acquisition Scout"
            />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-[#8F8E82]">
        Verdicts come from the reviewed ownership record. Provider counts are federal-registry
        filings; staffing, revenue, and year established are unchecked commercial-feed estimates.
        A real acquisition target still needs current ownership and succession review.{" "}
        <Link
          href={`/market-intel?zip=${encodeURIComponent(row.zip ?? "")}`}
          className="font-medium text-[#8B6508] underline hover:text-[#1A1A1A]"
        >
          Compare this location against its ZIP in Market View
        </Link>
      </p>
    </section>
  )
}
