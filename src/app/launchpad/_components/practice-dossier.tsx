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
import { getEntityClassificationLabel } from "@/lib/constants/entity-classifications"
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
import { NarrativeCard } from "./narrative-card"
import { AskIntelDrawer } from "./ask-intel-drawer"
import { InterviewPrepAi } from "./interview-prep-ai"
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
  track,
}: {
  target: LaunchpadRankedTarget
  track: LaunchpadTrack
}) {
  const { practice, intel } = target
  const age = getPracticeAge(practice.year_established)
  const dsoEntry = practice.affiliated_dso
    ? resolveDsoTierEntry(practice.affiliated_dso, practice.parent_company, practice.franchise_name)
    : null

  const trackScoreLabels = (["succession", "high_volume", "dso"] as const).map((t) => {
    const ts = target.trackScores[t]
    return `${LAUNCHPAD_TRACK_SHORT_LABELS[t]}: ${Math.round(ts.score)}`
  })

  const isCapped = target.trackScores[target.bestTrack].confidenceCapped

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
          </div>
        )}
      </div>

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
          {isCapped ? (
            <>
              <div className="text-sm font-semibold text-[#D4920B]">Capped</div>
              <div className="mt-1 text-[10px] text-[#D4920B]">Thin data</div>
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

      {/* AI narrative */}
      <NarrativeCard target={target} track={track} />

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
            label="Classification"
            value={getEntityClassificationLabel(practice.entity_classification)}
          />
          <QuickFact
            label="Providers"
            value={practice.num_providers ?? "—"}
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
            label="DSO"
            value={
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>{practice.affiliated_dso ?? "Independent"}</span>
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
          <p className="text-sm text-[#6B6B60]">{intel.overall_assessment}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Compensation
// ---------------------------------------------------------------------------

function CompensationGuidanceNote() {
  const bullets = [
    "ADA HPI 2024: median first-year associate $145k base + bonus, IL metro.",
    "MGMA 2024: 25th–75th percentile total comp $155k–$215k for 1–3 years experience.",
    "Non-compete law (IL): courts uphold ≤25mi / ≤2 years for legitimate interests.",
    "Student loan: PAYE/SAVE + 10-year PSLF possible at FQHCs / community clinics.",
  ]
  return (
    <div className="rounded-md border border-[#E8E5DE] bg-[#F5F5F0] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90]">
        Benchmark context
      </div>
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[#6B6B60]">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B8860B]" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DsoCompSection({ entry }: { entry: DsoTierEntry }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            backgroundColor: `${DSO_TIER_COLORS[entry.tier]}18`,
            color: DSO_TIER_COLORS[entry.tier],
            border: `1px solid ${DSO_TIER_COLORS[entry.tier]}40`,
          }}
        >
          {DSO_TIER_LABELS[entry.tier]}
        </span>
        <span className="text-sm font-medium text-[#1A1A1A]">{entry.name}</span>
        {entry.structure && (
          <span className="text-xs text-[#9C9C90]">· {entry.structure}</span>
        )}
      </div>

      <p className="text-sm text-[#6B6B60]">{entry.rationale}</p>

      {entry.compBand && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
              Base range
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-[#1A1A1A]">
              {entry.compBand.base}
            </div>
          </div>
          <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
              Total comp range
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-[#1A1A1A]">
              {entry.compBand.total}
            </div>
          </div>
        </div>
      )}

      {entry.compBand?.notes && (
        <p className="text-xs text-[#6B6B60]">{entry.compBand.notes}</p>
      )}

      {entry.citations.length > 0 && (
        <div>
          <SectionHeading>Sources</SectionHeading>
          <ul className="space-y-1">
            {entry.citations.map((c, i) => (
              <li key={i}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#B8860B] hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function IndependentCompSection({
  target,
  bundle,
}: {
  target: LaunchpadRankedTarget
  bundle: LaunchpadBundle | null
}) {
  const compRange = bundle?.summary.medianCompRange
  const { practice } = target

  const negotiationPrompts: string[] = [
    "Ask about production threshold and collections-vs-production clause — confirm whether it is collections or production basis.",
    "Confirm insurance mix — PPO-heavy practices typically require a higher production threshold to net the same take-home.",
    "Request a 6-month guaranteed base + production review clause — protects you while building your patient base.",
  ]

  if (target.activeSignalIds.includes("ffs_concierge_signal")) {
    negotiationPrompts.push(
      "FFS / concierge detected — ask about planned payer changes and whether fee schedules are reviewed annually."
    )
  }
  if (target.activeSignalIds.includes("succession_track_signal")) {
    negotiationPrompts.push(
      "Succession track flagged — ask for a letter of intent or partnership timeline in the offer package."
    )
  }

  return (
    <div className="space-y-4">
      {compRange && (
        <div>
          <SectionHeading>Market comp range ({compRange.source})</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
                Low estimate
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-[#1A1A1A]">
                {formatCurrency(compRange.low)}
              </div>
            </div>
            <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
                High estimate
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-[#1A1A1A]">
                {formatCurrency(compRange.high)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border border-[#D4D0C8] bg-[#FAFAF7] px-3 py-2 text-xs text-[#6B6B60]">
        Independent practice comp varies widely by production %. Typical structure: base +
        28–32% of collections above threshold.
      </div>

      <div>
        <SectionHeading>Negotiation prompts</SectionHeading>
        <ol className="space-y-2">
          {negotiationPrompts.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B60]">
              <span className="mt-0.5 shrink-0 text-[11px] font-bold text-[#B8860B]">
                {i + 1}.
              </span>
              {p}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function CompensationTab({
  target,
  bundle,
}: {
  target: LaunchpadRankedTarget
  bundle: LaunchpadBundle | null
}) {
  const { practice } = target
  const dsoEntry =
    practice.affiliated_dso
      ? resolveDsoTierEntry(
          practice.affiliated_dso,
          practice.parent_company,
          practice.franchise_name
        )
      : null

  return (
    <div className="space-y-5">
      {dsoEntry ? (
        <DsoCompSection entry={dsoEntry} />
      ) : (
        <IndependentCompSection target={target} bundle={bundle} />
      )}
      <CompensationGuidanceNote />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Mentorship
// ---------------------------------------------------------------------------

function MentorshipTab({ target }: { target: LaunchpadRankedTarget }) {
  const { practice, intel } = target
  const age = getPracticeAge(practice.year_established)
  const isMentorRich = target.activeSignalIds.includes("mentor_rich_signal")
  const isSuccessionPublished = target.activeSignalIds.includes("succession_published_signal")
  const isFamilyDynasty = target.activeSignalIds.includes("family_dynasty_warning")

  const mentorRichContribution = target.trackScores[target.bestTrack].contributions.find(
    (c) => c.signalId === "mentor_rich_signal"
  )

  let notMentorRichReason = ""
  if (!isMentorRich) {
    const cls = practice.entity_classification ?? ""
    const soloTypes = ["solo_established", "solo_new", "solo_inactive", "solo_high_volume"]
    if (!soloTypes.includes(cls)) {
      notMentorRichReason = `Practice is classified as ${getEntityClassificationLabel(cls)} — mentor-rich requires a solo provider.`
    } else if (age != null && age < 25) {
      notMentorRichReason = `Practice age is only ${age} years — mentor-rich requires 25+ years in business.`
    } else if ((practice.employee_count ?? 0) < 2) {
      notMentorRichReason = `Only ${practice.employee_count ?? 0} staff member(s) — mentorship bandwidth may be limited.`
    } else {
      notMentorRichReason = "Mentor-rich criteria not met — verify practice data."
    }
  }

  return (
    <div className="space-y-4">
      {isMentorRich ? (
        <Banner variant="green">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Mentor-rich practice</div>
              <div className="mt-0.5 text-xs opacity-90">
                {mentorRichContribution?.reasoning ?? LAUNCHPAD_SIGNALS.mentor_rich_signal.description}
              </div>
            </div>
          </div>
        </Banner>
      ) : (
        <div className="rounded-md border border-[#E8E5DE] bg-[#F5F5F0] px-3 py-2">
          <div className="flex items-start gap-2 text-sm text-[#6B6B60]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D4920B]" />
            <span>{notMentorRichReason}</span>
          </div>
        </div>
      )}

      {isSuccessionPublished && (
        <Banner variant="green">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Succession intent published</div>
              <div className="mt-0.5 text-xs opacity-90">
                Owner has published succession intent — directly inquire about apprentice-to-owner
                timeline.
              </div>
            </div>
          </div>
        </Banner>
      )}

      {isFamilyDynasty && (
        <Banner variant="amber">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Family dynasty risk</div>
              <div className="mt-0.5 text-xs opacity-90">
                Shared last name at address — likely internal succession. Ask directly if they are
                open to a non-family associate track.
              </div>
            </div>
          </div>
        </Banner>
      )}

      {age != null && age >= 25 && practice.entity_classification?.startsWith("solo") && (
        <div>
          <SectionHeading>Ownership runway</SectionHeading>
          <p className="text-sm text-[#6B6B60]">
            Owner has been practicing {age} years — retirement runway likely within 3–7 years,
            creating a buy-in or transition opportunity.
          </p>
        </div>
      )}

      <div>
        <SectionHeading>Provider setup</SectionHeading>
        {practice.num_providers == null || practice.num_providers === 1 ? (
          <p className="text-sm text-[#6B6B60]">
            Solo provider — 1:1 mentorship likely but no peer associate network.
          </p>
        ) : practice.num_providers <= 3 ? (
          <p className="text-sm text-[#6B6B60]">
            {practice.num_providers} providers — small group with likely active mentorship and some
            peer learning opportunity.
          </p>
        ) : (
          <p className="text-sm text-[#6B6B60]">
            {practice.num_providers} providers — larger group; mentorship time per associate may
            be limited.
          </p>
        )}
      </div>

      {practice.employee_count != null && (
        <div>
          <SectionHeading>Staff count</SectionHeading>
          <p className="text-sm text-[#6B6B60]">
            {practice.employee_count} total staff.{" "}
            {practice.employee_count >= 5
              ? "Adequate support team — clinical mentor can delegate admin."
              : "Lean team — owner may be stretched across chair time and management."}
          </p>
        </div>
      )}

      {intel ? (
        <div className="space-y-3">
          {intel.owner_career_stage && (
            <div>
              <SectionHeading>Owner career stage</SectionHeading>
              <div className="text-lg font-semibold capitalize text-[#1A1A1A]">
                {intel.owner_career_stage.replace(/_/g, " ")}
              </div>
            </div>
          )}
          {intel.overall_assessment && (
            <div>
              <SectionHeading>AI assessment</SectionHeading>
              <p className="text-sm text-[#6B6B60]">{intel.overall_assessment}</p>
            </div>
          )}
          {intel.acquisition_readiness && (
            <div>
              <SectionHeading>Acquisition readiness</SectionHeading>
              <span
                className={cn(
                  "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                  intel.acquisition_readiness === "high"
                    ? "bg-[#2D8B4E]/10 text-[#2D8B4E]"
                    : intel.acquisition_readiness === "medium"
                      ? "bg-[#D4920B]/10 text-[#D4920B]"
                      : "bg-[#E8E5DE] text-[#6B6B60]"
                )}
              >
                {intel.acquisition_readiness}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#9C9C90]">
          No AI-researched mentorship intel yet. Schedule an intel run to get a full dossier.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Red Flags
// ---------------------------------------------------------------------------

function RedFlagsTab({ target }: { target: LaunchpadRankedTarget }) {
  const { practice, intel } = target
  const warnings = target.warningSignalIds

  const dsoEntry =
    target.dsoTier === "avoid" && practice.affiliated_dso
      ? resolveDsoTierEntry(practice.affiliated_dso, practice.parent_company, practice.franchise_name)
      : null

  const aiRedFlags = intel?.red_flags && intel.red_flags.length > 0 ? intel.red_flags : null

  if (warnings.length === 0 && !dsoEntry && !aiRedFlags) {
    return (
      <Banner variant="green">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">No red flags detected</div>
            <div className="mt-0.5 text-xs opacity-90">
              Proceed with standard due diligence.
            </div>
          </div>
        </div>
      </Banner>
    )
  }

  return (
    <div className="space-y-4">
      {dsoEntry && (
        <Banner variant="red">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">
                AVOID list — {practice.affiliated_dso}
              </div>
              <div className="mt-1 text-xs opacity-90">{dsoEntry.rationale}</div>
              {dsoEntry.citations.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {dsoEntry.citations.map((c, i) => (
                    <li key={i}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs underline opacity-90"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Banner>
      )}

      {warnings.map((signalId) => {
        const def = LAUNCHPAD_SIGNALS[signalId]
        const contribution = target.trackScores[target.bestTrack].contributions.find(
          (c) => c.signalId === signalId
        )
        const evidence = contribution?.reasoning ?? def.description
        const impact = contribution ? Math.round(contribution.contribution) : null

        return (
          <div
            key={signalId}
            className="rounded-md border border-[#C23B3B]/20 bg-[#C23B3B]/4 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#C23B3B]" />
                <span className="text-sm font-semibold text-[#C23B3B]">{def.label}</span>
              </div>
              {impact != null && (
                <span className="shrink-0 text-[11px] font-medium text-[#C23B3B]">
                  {impact > 0 ? "+" : ""}
                  {impact} pts
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[#6B6B60]">{def.description}</p>
            {evidence !== def.description && (
              <p className="mt-1 text-xs text-[#6B6B60] italic">{evidence}</p>
            )}
          </div>
        )
      })}

      {aiRedFlags && (
        <div>
          <SectionHeading>AI-researched red flags</SectionHeading>
          <ul className="space-y-2">
            {aiRedFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B60]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C23B3B]" />
                {flag}
              </li>
            ))}
          </ul>
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
}: PracticeDossierProps) {
  const [askIntelOpen, setAskIntelOpen] = useState(false)

  if (!target || !open) return null

  const { practice, intel } = target
  const displayName =
    practice.practice_name ?? practice.doing_business_as ?? `NPI ${target.npi}`
  const dba =
    practice.doing_business_as &&
    practice.doing_business_as !== practice.practice_name
      ? practice.doing_business_as
      : null

  const dsoEntry =
    practice.affiliated_dso
      ? resolveDsoTierEntry(
          practice.affiliated_dso,
          practice.parent_company,
          practice.franchise_name
        )
      : null

  const locationLine = [practice.city, practice.state].filter(Boolean).join(", ")

  const practiceSnapshot = {
    name: displayName,
    dba: practice.doing_business_as,
    entity_classification: practice.entity_classification,
    city: practice.city,
    state: practice.state,
    zip: practice.zip,
    year_established: practice.year_established,
    employee_count: practice.employee_count,
    num_providers: practice.num_providers,
    estimated_revenue: practice.estimated_revenue,
    buyability_score: practice.buyability_score,
    website: practice.website,
    affiliated_dso: practice.affiliated_dso,
    dso_tier: dsoEntry ? DSO_TIER_LABELS[dsoEntry.tier] : null,
    ownership_status: practice.ownership_status,
    classification_confidence: practice.classification_confidence,
  }

  const intelContext = intel
    ? {
        overall_assessment: intel.overall_assessment,
        acquisition_readiness: intel.acquisition_readiness,
        confidence: intel.confidence,
        green_flags: intel.green_flags,
        red_flags: intel.red_flags,
        raw_json: intel.raw_json,
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
            defaultValue="snapshot"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 border-b border-[#E8E5DE] bg-[#FAFAF7] px-4">
              <TabsList
                variant="line"
                className="h-10 w-full justify-start gap-0 rounded-none bg-transparent p-0"
              >
                {(
                  [
                    { value: "snapshot", label: "Snapshot" },
                    { value: "compensation", label: "Comp" },
                    { value: "mentorship", label: "Mentor" },
                    { value: "redflags", label: "Red Flags" },
                    { value: "interview", label: "Interview" },
                    { value: "contract", label: "Contract" },
                  ] as const
                ).map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-full rounded-none border-0 px-3 text-xs font-medium text-[#6B6B60] data-active:text-[#B8860B] data-active:after:bg-[#B8860B]"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="snapshot" className="p-4">
                <SnapshotTab target={target} track={track} />
              </TabsContent>
              <TabsContent value="compensation" className="p-4">
                <CompensationTab target={target} bundle={bundle} />
              </TabsContent>
              <TabsContent value="mentorship" className="p-4">
                <MentorshipTab target={target} />
              </TabsContent>
              <TabsContent value="redflags" className="p-4">
                <RedFlagsTab target={target} />
              </TabsContent>
              <TabsContent value="interview" className="p-4">
                <InterviewPrepAi
                  npi={target.npi}
                  practiceSnapshot={practiceSnapshot}
                  signals={signalIds}
                  intel={intelContext}
                  track={track}
                />
              </TabsContent>
              <TabsContent value="contract" className="p-4">
                <ContractParser />
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
