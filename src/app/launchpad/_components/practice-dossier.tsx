"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Brain,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  GraduationCap,
  MapPin,
  Phone,
  Pin,
  PinOff,
  X,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/formatting"
import { safeExternalUrl } from "@/lib/utils/safe-url"
import { CensusBadge, getOwnershipTierMeta } from "@/components/data-display/census-badge"
import { TrustSourceTag } from "@/components/data-display/trust-source-tag"
import { ManualCorrectionPanel } from "@/components/data-display/manual-correction-panel"
import {
  resolveDsoTierEntry,
  DSO_TIER_LABELS,
  DSO_TIER_COLORS,
  type DsoTierEntry,
} from "@/lib/launchpad/dso-tiers"
import {
  LAUNCHPAD_SIGNALS,
  LAUNCHPAD_TIER_LABELS,
  LAUNCHPAD_TRACK_LABELS,
  LAUNCHPAD_TRACK_SHORT_LABELS,
  type LaunchpadBundle,
  type LaunchpadRankedTarget,
  type LaunchpadSignalId,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"
import { getPracticeDisplayName, getPracticeSecondaryName } from "@/lib/launchpad/display"
import { AskIntelDrawer } from "./ask-intel-drawer"
import { ContractParser } from "./contract-parser"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PracticeDossierProps {
  target: LaunchpadRankedTarget | null
  open: boolean
  onClose: () => void
  track: LaunchpadTrack
  bundle: LaunchpadBundle | null
  isPinned?: boolean
  onTogglePin?: (npi: string) => void
  /** Optional controlled active tab. Defaults uncontrolled to "snapshot". */
  tab?: string
  onTabChange?: (tab: string) => void
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function getPracticeAge(yearEstablished: number | null): number | null {
  if (yearEstablished == null) return null
  return new Date().getFullYear() - yearEstablished
}

const TIER_SCORE_COLOR: Record<string, string> = {
  best_fit: "#2D8B4E",
  strong: "#B8860B",
  maybe: "#6B6B60",
  low: "#6B6B60",
  avoid: "#C23B3B",
}

function tierColor(tier: string): string {
  return TIER_SCORE_COLOR[tier] ?? "#6B6B60"
}

function SignalPill({ signalId }: { signalId: LaunchpadSignalId }) {
  const def = LAUNCHPAD_SIGNALS[signalId]
  if (!def) return null
  const base =
    def.category === "opportunity"
      ? "bg-[#B8860B]/10 text-[#B8860B] border-[#B8860B]/30"
      : def.category === "warning"
        ? "bg-[#C23B3B]/10 text-[#C23B3B] border-[#C23B3B]/30"
        : "bg-[#F5F5F0] text-[#6B6B60] border-[#E8E5DE]"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        base
      )}
    >
      {def.shortLabel}
    </span>
  )
}

function QuickFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
        {label}
      </span>
      <span className="text-sm font-medium text-[#1A1A1A]">{value}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90]">
      {children}
    </h4>
  )
}

function Banner({
  variant,
  children,
}: {
  variant: "green" | "amber" | "red"
  children: React.ReactNode
}) {
  const styles = {
    green: "bg-[#2D8B4E]/8 border-[#2D8B4E]/30 text-[#2D8B4E]",
    amber: "bg-[#D4920B]/8 border-[#D4920B]/30 text-[#D4920B]",
    red: "bg-[#C23B3B]/8 border-[#C23B3B]/30 text-[#C23B3B]",
  }
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", styles[variant])}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Snapshot
// ---------------------------------------------------------------------------

function SnapshotTab({
  target,
}: {
  target: LaunchpadRankedTarget
}) {
  const { practice, intel } = target
  const age = getPracticeAge(practice.year_established)
  const dsoEntry = target.networkLabel ? resolveDsoTierEntry(target.networkLabel) : null

  const trackScoreLabels = (["succession", "high_volume", "dso"] as const).map((t) => {
    const ts = target.trackScores?.[t]
    return `${LAUNCHPAD_TRACK_SHORT_LABELS[t]}: ${Math.round(ts?.score ?? 0)}`
  })

  const isCapped = target.trackScores?.[target.bestTrack]?.confidenceCapped ?? false
  const intelNeedsReview =
    target.intelAudit?.status === "rejected" || target.intelAudit?.status === "legacy"
  const sourceBackedIntel = target.intelAudit?.status === "source_backed"
  const currentDoctors =
    sourceBackedIntel && intel?.provider_notes
      ? cleanIntelText(intel.provider_notes)
      : null
  const providerCount =
    sourceBackedIntel && intel?.provider_count_web != null
      ? intel.provider_count_web
      : practice.num_providers
  const providerCountSource =
    sourceBackedIntel && intel?.provider_count_web != null
      ? "website dossier"
      : "registry count"

  return (
    <div className="space-y-5">
      {/* Address block */}
      <div className="space-y-1">
        {practice.address && (
          <div className="flex items-start gap-1.5 text-sm text-[#6B6B60]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9C9C90]" />
            <span>
              {practice.address}
              {(practice.city || practice.state || practice.zip) && (
                <>
                  <br />
                  {[practice.city, practice.state, practice.zip]
                    .filter(Boolean)
                    .join(", ")}
                </>
              )}
            </span>
          </div>
        )}
        {practice.phone && (
          <div className="flex items-center gap-1.5 text-sm text-[#6B6B60]">
            <Phone className="h-3.5 w-3.5 shrink-0 text-[#9C9C90]" />
            <span>{practice.phone}</span>
            <TrustSourceTag source="registry_only" />
          </div>
        )}
        {practice.website && (
          <div className="flex items-center gap-1.5 text-sm">
            <Globe className="h-3.5 w-3.5 shrink-0 text-[#9C9C90]" />
            <a
              href={safeExternalUrl(practice.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B8860B] hover:underline"
            >
              {practice.website.replace(/^https?:\/\//, "").split("/")[0]}
              <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
            <TrustSourceTag source="commercial_estimate" />
          </div>
        )}
      </div>

      <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
        <SectionHeading>Ownership and doctors</SectionHeading>
        <div className="grid grid-cols-1 gap-3">
          <QuickFact
            label="Owner / group"
            value={target.networkLabel ?? "Not verified in structured data"}
          />
          <QuickFact
            label="Doctors currently shown"
            value={currentDoctors ?? "Not verified yet"}
          />
          <QuickFact
            label="Provider count"
            value={
              <span>
                {providerCount ?? "—"}
                <span className="ml-1 text-xs font-normal text-[#6B6B60]">
                  {providerCount != null ? providerCountSource : ""}
                </span>
              </span>
            }
          />
        </div>
      </div>

      {intelNeedsReview && (
        <Banner variant={target.intelAudit?.status === "rejected" ? "red" : "amber"}>
          <div className="font-semibold">
            {target.intelAudit?.status === "rejected"
              ? "Practice intel needs re-research"
              : "Archived intel is not used for scoring"}
          </div>
          <div className="mt-1 text-xs opacity-90">
            {target.intelAudit?.reason ??
              "This practice has older or incomplete research. Verify current doctors, ownership, and hiring before outreach."}
          </div>
        </Banner>
      )}

      {/* 3-column KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Fit Score */}
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div
            className="font-mono text-3xl font-bold leading-none"
            style={{ color: tierColor(target.displayTier) }}
          >
            {Math.round(target.displayScore)}
          </div>
          <div
            className="mt-1 text-[11px] font-medium"
            style={{ color: tierColor(target.displayTier) }}
          >
            {LAUNCHPAD_TIER_LABELS[target.displayTier]}
          </div>
          <div className="mt-0.5 text-[10px] text-[#9C9C90]">Fit score</div>
        </div>

        {/* Track */}
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="text-sm font-semibold text-[#1A1A1A]">
            {LAUNCHPAD_TRACK_SHORT_LABELS[target.bestTrack]}
          </div>
          <div className="mt-1 text-[10px] text-[#9C9C90]">
            {trackScoreLabels.join(" · ")}
          </div>
          <div className="mt-0.5 text-[10px] text-[#9C9C90]">Best track</div>
        </div>

        {/* Confidence */}
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          {intelNeedsReview ? (
            <>
              <div className="text-sm font-semibold text-[#C23B3B]">Review</div>
              <div className="mt-1 text-[10px] text-[#C23B3B]">Re-research intel</div>
            </>
          ) : isCapped ? (
            <>
              <div className="text-sm font-semibold text-[#D4920B]">Capped</div>
              <div className="mt-1 text-[10px] text-[#D4920B]">
                {target.lane === "needs_research" ? "Ownership unreviewed" : "Intel unverified"}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-[#2D8B4E]">High</div>
              <div className="mt-1 text-[10px] text-[#9C9C90]">Confidence</div>
            </>
          )}
          <div className="mt-0.5 text-[10px] text-[#9C9C90]">Data quality</div>
        </div>
      </div>

      {/* Active signals */}
      {target.activeSignalIds.length > 0 && (
        <div>
          <SectionHeading>Active signals</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {target.activeSignalIds.map((id) => (
              <SignalPill key={id} signalId={id} />
            ))}
          </div>
        </div>
      )}

      {/* Quick facts */}
      <div>
        <SectionHeading>Quick facts</SectionHeading>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <QuickFact
            label="Ownership (reviewed)"
            value={
              <CensusBadge
                tier={target.ownershipTier ?? practice.census_review_status}
                peBacked={target.peBacked}
                compact
              />
            }
          />
          <QuickFact
            label="Providers"
            value={providerCount ?? "—"}
          />
          <QuickFact
            label="Employees"
            value={practice.employee_count ?? "—"}
          />
          <QuickFact
            label="Revenue"
            value={
              practice.estimated_revenue != null
                ? formatCurrency(practice.estimated_revenue)
                : "—"
            }
          />
          <QuickFact
            label="Year est."
            value={
              practice.year_established != null
                ? `${practice.year_established}${age != null ? ` · ${age}y` : ""}`
                : "—"
            }
          />
          <QuickFact
            label="Network"
            value={
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>{target.networkLabel ?? "None on record"}</span>
                {dsoEntry && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${DSO_TIER_COLORS[dsoEntry.tier]}18`,
                      color: DSO_TIER_COLORS[dsoEntry.tier],
                      border: `1px solid ${DSO_TIER_COLORS[dsoEntry.tier]}40`,
                    }}
                  >
                    {DSO_TIER_LABELS[dsoEntry.tier]}
                  </span>
                )}
              </span>
            }
          />
        </div>
      </div>

      {/* Headline quote */}
      {target.headline && (
        <div className="rounded-md border border-[#E8E5DE] bg-[#F5F5F0] px-3 py-2">
          <p className="text-sm italic text-[#6B6B60]">{target.headline}</p>
        </div>
      )}

      {/* Intel assessment */}
      {intel?.overall_assessment && (
        <div>
          <SectionHeading>AI assessment</SectionHeading>
          <p className="text-sm text-[#6B6B60]">{cleanIntelText(intel.overall_assessment)}</p>
        </div>
      )}

      <ManualCorrectionPanel
        locationId={practice.location_id}
        npi={practice.npi}
        practiceName={getPracticeDisplayName(practice)}
        fields={[
          {
            key: "practice_name",
            label: "Current practice name",
            currentValue: getPracticeDisplayName(practice),
            placeholder: "Name shown on the practice website",
          },
          {
            key: "owner_doctor_or_group",
            label: "Owner doctor / group",
            currentValue: target.networkLabel,
            placeholder: "Example: Dr. Jane Smith, DDS",
          },
          {
            key: "operating_doctors",
            label: "Doctors currently shown on website",
            currentValue: currentDoctors,
            placeholder: "Example: Dr. A; Dr. B; Dr. C",
          },
          {
            key: "provider_count",
            label: "Provider count",
            currentValue: providerCount,
            inputMode: "numeric",
          },
          {
            key: "employee_count",
            label: "Employee count",
            currentValue: practice.employee_count,
            inputMode: "numeric",
          },
          {
            key: "website",
            label: "Website",
            currentValue: practice.website,
          },
        ]}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Intel Evidence
// ---------------------------------------------------------------------------

function formatBooleanSignal(value: number | boolean | null | undefined): string {
  if (value == null) return "Unknown"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return value === 1 ? "Yes" : value === 0 ? "No" : "Unknown"
}

function EvidenceUrlList({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return <p className="text-sm text-[#9C9C90]">No verification URLs stored.</p>
  }
  return (
    <ul className="space-y-1.5">
      {urls.slice(0, 10).map((url) => (
        <li key={url}>
          <a
            href={safeExternalUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-xs text-[#B8860B] hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function IntelFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-[#1A1A1A]">{value}</div>
    </div>
  )
}

function IntelList({
  title,
  items,
  tone = "neutral",
}: {
  title: string
  items: string[] | null | undefined
  tone?: "neutral" | "green" | "red"
}) {
  if (!items || items.length === 0) return null
  const color =
    tone === "green" ? "text-[#2D8B4E]" : tone === "red" ? "text-[#C23B3B]" : "text-[#6B6B60]"
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className={cn("text-sm", color)}>
            {cleanIntelText(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function cleanIntelText(value: string): string {
  return value
    .replace(/\bsolo_established\b/g, "legacy solo detector class")
    .replace(/\bsmall_group\b/g, "legacy small-group detector class")
    .replace(/\blarge_group\b/g, "legacy large-group detector class")
}

function IntelEvidenceTab({ target }: { target: LaunchpadRankedTarget }) {
  const { intel, intelAudit } = target

  const needsReresearch = intelAudit?.status === "rejected"

  if (!intel) {
    return (
      <div className="space-y-4">
        {needsReresearch ? (
          <Banner variant="red">
            <div className="font-semibold">Dossier needs re-research</div>
            <div className="mt-1 text-xs opacity-90">
              A dossier was researched for this practice but is not safe for job-search
              scoring. {intelAudit?.reason ?? "Re-run source verification before outreach."} Re-run{" "}
              <code className="rounded bg-white/20 px-1 py-0.5 font-mono text-[11px]">
                python3 scrapers/dossier_batch/launch.py --npi {target.npi}
              </code>{" "}
              to produce a source-backed dossier that will lift the scoring cap.
            </div>
          </Banner>
        ) : (
          <Banner variant="amber">
            <div className="font-semibold">No current verified practice dossier attached</div>
            <div className="mt-1 text-xs opacity-90">
              {intelAudit?.reason ??
                "There is no practice_intel row for this location's provider NPIs."}
            </div>
          </Banner>
        )}
        {intelAudit && (
          <div className="grid grid-cols-3 gap-3">
            <IntelFact label="Quality" value={intelAudit.verification_quality ?? "Missing"} />
            <IntelFact label="Searches" value={intelAudit.verification_searches ?? 0} />
            <IntelFact label="URLs" value={intelAudit.verification_urls.length} />
          </div>
        )}
        <div>
          <SectionHeading>Stored source URLs</SectionHeading>
          <EvidenceUrlList urls={intelAudit?.verification_urls ?? []} />
        </div>
        <div className="rounded-md border border-[#E8E5DE] bg-[#F5F5F0] px-3 py-2 text-xs text-[#6B6B60]">
          This drawer is using the reviewed ownership answer plus structural NPPES/Data Axle fields only.
          Rejected or archived raw research is visible as an audit record, but it is not used
          for scoring, thesis, or evidence claims.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Banner variant={intelAudit?.status === "legacy" ? "amber" : "green"}>
        <div className="font-semibold">
          {intelAudit?.status === "legacy"
            ? "Practice dossier (pre-verification batch)"
            : "Current verified practice dossier"}
        </div>
        <div className="mt-1 text-xs opacity-90">
          {intel.verification_quality ?? "verified"} · {intel.verification_searches ?? 0} searches ·{" "}
          {intel.verification_urls?.length ?? 0} URLs
          {intel.research_date ? ` · ${intel.research_date.slice(0, 10)}` : ""}
          {intel.npi !== target.npi ? ` · evidence NPI ${intel.npi}` : ""}
        </div>
      </Banner>

      <div>
        <SectionHeading>Verification URLs</SectionHeading>
        <EvidenceUrlList urls={intel.verification_urls ?? []} />
      </div>

      {intel.overall_assessment && (
        <div>
          <SectionHeading>Assessment</SectionHeading>
          <p className="text-sm leading-relaxed text-[#6B6B60]">
            {cleanIntelText(intel.overall_assessment)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <IntelFact label="Website" value={intel.website_url ?? "Unknown"} />
        <IntelFact label="Website era" value={intel.website_era ?? "Unknown"} />
        <IntelFact label="Owner stage" value={intel.owner_career_stage ?? "Unknown"} />
        <IntelFact label="Readiness" value={intel.acquisition_readiness ?? "Unknown"} />
        <IntelFact label="Hiring active" value={formatBooleanSignal(intel.hiring_active)} />
        <IntelFact label="Technology" value={intel.technology_level ?? "Unknown"} />
        <IntelFact
          label="Google"
          value={
            intel.google_rating != null || intel.google_review_count != null
              ? `${intel.google_rating ?? "?"} · ${intel.google_review_count ?? "?"} reviews`
              : "Unknown"
          }
        />
        <IntelFact
          label="Healthgrades"
          value={
            intel.healthgrades_rating != null || intel.healthgrades_reviews != null
              ? `${intel.healthgrades_rating ?? "?"} · ${intel.healthgrades_reviews ?? "?"} reviews`
              : "Unknown"
          }
        />
      </div>

      <IntelList title="Services found" items={intel.services_listed} />
      <IntelList title="Technology found" items={intel.technology_listed} />
      <IntelList title="Green flags" items={intel.green_flags} tone="green" />
      <IntelList title="Red flags" items={intel.red_flags} tone="red" />

      {(intel.website_analysis || intel.provider_notes || intel.insurance_note) && (
        <div className="space-y-3">
          {intel.website_analysis && (
            <div>
              <SectionHeading>Website notes</SectionHeading>
              <p className="text-sm text-[#6B6B60]">{cleanIntelText(intel.website_analysis)}</p>
            </div>
          )}
          {intel.provider_notes && (
            <div>
              <SectionHeading>Provider notes</SectionHeading>
              <p className="text-sm text-[#6B6B60]">{cleanIntelText(intel.provider_notes)}</p>
            </div>
          )}
          {intel.insurance_note && (
            <div>
              <SectionHeading>Insurance notes</SectionHeading>
              <p className="text-sm text-[#6B6B60]">{cleanIntelText(intel.insurance_note)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PracticeDossier({
  target,
  open,
  onClose,
  track,
  bundle,
  isPinned = false,
  onTogglePin,
  tab,
  onTabChange,
}: PracticeDossierProps) {
  const [askIntelOpen, setAskIntelOpen] = useState(false)

  if (!target || !open) return null

  const { practice, intel } = target
  const displayName = getPracticeDisplayName(practice)
  const dba = getPracticeSecondaryName(practice)

  const dsoEntry = target.networkLabel ? resolveDsoTierEntry(target.networkLabel) : null

  const locationLine = [practice.city, practice.state].filter(Boolean).join(", ")

  const practiceSnapshot = {
    name: displayName,
    dba: practice.doing_business_as,
    city: practice.city,
    state: practice.state,
    zip: practice.zip,
    year_established: practice.year_established,
    employee_count: practice.employee_count,
    num_providers: practice.num_providers,
    estimated_revenue: practice.estimated_revenue,
    buyability_score: practice.buyability_score,
    website: practice.website,
    peer_class: practice.entity_classification,
    ownership_tier: target.ownershipTier,
    census_review_status: practice.census_review_status,
    ownership_confidence: practice.ownership_confidence,
    network: target.networkLabel,
    pe_backed: target.peBacked,
    dso_employment_tier: dsoEntry ? DSO_TIER_LABELS[dsoEntry.tier] : null,
  }

  const intelContext = intel
    ? {
        overall_assessment: intel.overall_assessment,
        acquisition_readiness: intel.acquisition_readiness,
        confidence: intel.confidence,
        green_flags: intel.green_flags,
        red_flags: intel.red_flags,
        raw_json: intel.raw_json,
        // Verification metadata — the route re-audits server-side and
        // withholds intel content that is not source-backed.
        research_date: intel.research_date,
        verification_quality: intel.verification_quality,
        verification_searches: intel.verification_searches,
        verification_urls: intel.verification_urls,
      }
    : null

  const signalIds = [
    ...target.activeSignalIds,
    ...target.warningSignalIds,
  ] as string[]

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 border-l border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-[520px]"
        >
          {/* Header */}
          <SheetHeader className="shrink-0 border-b border-[#E8E5DE] bg-[#FAFAF7] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base font-semibold text-[#1A1A1A]">
                  {displayName}
                </SheetTitle>
                {dba && (
                  <div className="mt-0.5 truncate text-xs text-[#9C9C90]">
                    dba {dba}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {locationLine && (
                    <span className="flex items-center gap-1 text-xs text-[#6B6B60]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {locationLine}
                    </span>
                  )}
                  <CensusBadge
                    tier={target.ownershipTier ?? practice.census_review_status}
                    peBacked={target.peBacked}
                    compact
                  />
                  {dsoEntry && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${DSO_TIER_COLORS[dsoEntry.tier]}18`,
                        color: DSO_TIER_COLORS[dsoEntry.tier],
                        border: `1px solid ${DSO_TIER_COLORS[dsoEntry.tier]}40`,
                      }}
                    >
                      {DSO_TIER_LABELS[dsoEntry.tier]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => setAskIntelOpen(true)}
                  aria-label="Ask Intel about this practice"
                  title="Ask AI a question about this practice"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#9C9C90] transition-colors hover:border-[#B8860B]/30 hover:bg-[#B8860B]/5 hover:text-[#B8860B]"
                >
                  <Brain className="h-4 w-4" />
                </button>
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(target.npi)}
                    aria-label={isPinned ? "Unpin practice" : "Pin practice"}
                    aria-pressed={isPinned}
                    title={isPinned ? "Unpin from pinboard" : "Pin to pinboard"}
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isPinned
                        ? "border-[#B8860B]/40 bg-[#B8860B]/10 text-[#B8860B] hover:bg-[#B8860B]/15"
                        : "border-transparent text-[#9C9C90] hover:bg-[#F5F5F0] hover:text-[#1A1A1A]"
                    )}
                  >
                    {isPinned ? (
                      <PinOff className="h-4 w-4" />
                    ) : (
                      <Pin className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9C9C90] transition-colors hover:bg-[#F5F5F0] hover:text-[#1A1A1A]"
                  aria-label="Close dossier"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs
            value={tab ?? "snapshot"}
            onValueChange={onTabChange}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 border-b border-[#E8E5DE] bg-[#FAFAF7] px-4">
              <TabsList
                variant="line"
                className="h-10 w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
              >
                {(
                  [
                    { value: "snapshot", label: "Overview" },
                    { value: "intel", label: "Evidence" },
                  ] as const
                ).map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-full shrink-0 rounded-none border-0 px-3 text-xs font-medium text-[#6B6B60] data-active:text-[#B8860B] data-active:after:bg-[#B8860B]"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="snapshot" className="p-4">
                <SnapshotTab target={target} />
              </TabsContent>
              <TabsContent value="intel" className="p-4">
                <IntelEvidenceTab target={target} />
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#E8E5DE] bg-[#FAFAF7] px-4 py-2">
            <div className="flex items-center gap-2 text-[10px] text-[#9C9C90]">
              <GraduationCap className="h-3 w-3 shrink-0" />
              <span>
                Active track:{" "}
                <span className="font-medium text-[#6B6B60]">
                  {LAUNCHPAD_TRACK_LABELS[track]}
                </span>
              </span>
              <span className="mx-1 opacity-40">·</span>
              <span>NPI {target.npi}</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {askIntelOpen && (
        <AskIntelDrawer
          open={askIntelOpen}
          onClose={() => setAskIntelOpen(false)}
          npi={target.npi}
          practiceSnapshot={practiceSnapshot}
          zipContext={
            target.zipScore
              ? {
                  metro: target.zipScore.metro_area,
                  market_type: target.zipScore.market_type,
                  corporate_share_pct: target.zipScore.corporate_share_pct,
                  dld_gp_per_10k: target.zipScore.dld_gp_per_10k,
                  buyable_practice_ratio: target.zipScore.buyable_practice_ratio,
                  commutable: target.commutable,
                  metrics_confidence: target.zipScore.metrics_confidence,
                  population: target.zipScore.population,
                  median_household_income: target.zipScore.median_household_income,
                }
              : null
          }
          intelContext={intelContext}
        />
      )}
    </>
  )
}
