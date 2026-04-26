"use client"

import { MapPin, Pin, PinOff } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LAUNCHPAD_SIGNALS,
  LAUNCHPAD_TIER_LABELS,
  type ConcreteLaunchpadTrack,
  type LaunchpadRankedTarget,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"
import { getPracticeDisplayName } from "@/lib/launchpad/display"
import { CompoundThesis } from "./compound-thesis"

interface TrackListCardProps {
  target: LaunchpadRankedTarget
  isSelected: boolean
  onSelect: (npi: string) => void
  track: LaunchpadTrack
  isPinned?: boolean
  onTogglePin?: (npi: string) => void
}

const TIER_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  best_fit: {
    bg: "bg-[#2D8B4E]/10",
    text: "text-[#2D8B4E]",
    border: "border-[#2D8B4E]/30",
  },
  strong: {
    bg: "bg-[#B8860B]/10",
    text: "text-[#B8860B]",
    border: "border-[#B8860B]/30",
  },
  maybe: {
    bg: "bg-[#2563EB]/10",
    text: "text-[#2563EB]",
    border: "border-[#2563EB]/30",
  },
  low: {
    bg: "bg-[#E8E5DE]",
    text: "text-[#6B6B60]",
    border: "border-[#D4D0C8]",
  },
  avoid: {
    bg: "bg-[#C23B3B]/10",
    text: "text-[#C23B3B]",
    border: "border-[#C23B3B]/30",
  },
}

const DSO_TIER_LABEL_MAP: Record<string, string> = {
  tier1: "Tier 1 DSO",
  tier2: "Tier 2 DSO",
  tier3: "Tier 3 DSO",
  avoid: "Avoid DSO",
}

const DSO_TIER_COLOR_MAP: Record<string, string> = {
  tier1: "bg-[#2D8B4E]/10 text-[#2D8B4E] border-[#2D8B4E]/30",
  tier2: "bg-[#B8860B]/10 text-[#B8860B] border-[#B8860B]/30",
  tier3: "bg-[#D4920B]/10 text-[#D4920B] border-[#D4920B]/30",
  avoid: "bg-[#C23B3B]/10 text-[#C23B3B] border-[#C23B3B]/30",
}

const CONCRETE_TRACKS: ReadonlySet<string> = new Set(["succession", "high_volume", "dso"])

function resolveTrackKey(track: LaunchpadTrack, bestTrack: ConcreteLaunchpadTrack): ConcreteLaunchpadTrack {
  if (track === "all" || !CONCRETE_TRACKS.has(track)) return bestTrack
  return track as ConcreteLaunchpadTrack
}

export function TrackListCard({
  target,
  isSelected,
  onSelect,
  track,
  isPinned = false,
  onTogglePin,
}: TrackListCardProps) {
  const practice = target.practice
  const displayName = getPracticeDisplayName(practice)

  const locationParts: string[] = []
  if (practice.city && practice.state) locationParts.push(`${practice.city}, ${practice.state}`)
  else if (practice.city) locationParts.push(practice.city)
  if (practice.zip) locationParts.push(practice.zip)
  const locationStr = locationParts.join(" · ")

  const tierStyle = TIER_STYLES[target.displayTier] ?? TIER_STYLES.low
  const tierLabel = LAUNCHPAD_TIER_LABELS[target.displayTier] ?? target.displayTier

  // Opportunity signals (up to 3)
  const opportunitySignalIds = target.activeSignalIds
    .filter((id) => {
      const def = LAUNCHPAD_SIGNALS[id]
      return def && (def.category === "opportunity" || def.category === "context")
    })
    .slice(0, 3)

  // Warning signals (up to 2)
  const warningSignalIds = target.warningSignalIds.slice(0, 2)

  // Confidence capped check
  const trackKey = resolveTrackKey(track, target.bestTrack)
  const confidenceCapped = target.trackScores[trackKey]?.confidenceCapped ?? false

  // Prepare CompoundThesis props
  const concreteTrack: ConcreteLaunchpadTrack =
    track === "all" || !CONCRETE_TRACKS.has(track)
      ? target.bestTrack
      : (track as ConcreteLaunchpadTrack)

  const practiceSnapshot = {
    npi: target.npi,
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
    ownership_status: practice.ownership_status,
    classification_confidence: practice.classification_confidence,
  }

  const trackScores = {
    succession: Math.round(target.trackScores.succession.score),
    high_volume: Math.round(target.trackScores.high_volume.score),
    dso: Math.round(target.trackScores.dso.score),
  }

  const allSignalIds = [
    ...target.activeSignalIds,
    ...target.warningSignalIds,
  ]

  return (
    <li
      className={cn(
        "group cursor-pointer px-4 py-3 transition-all",
        isSelected
          ? "border-l-2 border-[#B8860B] bg-[#B8860B]/5"
          : "border-l-2 border-transparent hover:bg-[#FAFAF7]",
        "hover:shadow-sm"
      )}
      onClick={() => onSelect(target.npi)}
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="mt-0.5 w-7 shrink-0 text-right">
          <span className="font-mono text-xs font-semibold text-[#9C9C90]">
            #{target.rank}
          </span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Name + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-sans text-base font-bold leading-snug text-[#1A1A1A]">
              {displayName}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                tierStyle.bg,
                tierStyle.text,
                tierStyle.border
              )}
            >
              {tierLabel}
            </span>
            {target.dsoTier && DSO_TIER_LABEL_MAP[target.dsoTier] && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  DSO_TIER_COLOR_MAP[target.dsoTier] ??
                    "bg-[#E8E5DE] text-[#6B6B60] border-[#D4D0C8]"
                )}
              >
                {DSO_TIER_LABEL_MAP[target.dsoTier]}
              </span>
            )}
          </div>

          {/* Location */}
          {locationStr && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B6B60]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {locationStr}
              </span>
              {target.commutable && (
                <span className="inline-flex items-center rounded-full bg-[#2D8B4E]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2D8B4E]">
                  Commutable
                </span>
              )}
            </div>
          )}

          {/* Signal chips */}
          {(opportunitySignalIds.length > 0 || warningSignalIds.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {opportunitySignalIds.map((id) => {
                const def = LAUNCHPAD_SIGNALS[id]
                return (
                  <span
                    key={id}
                    title={def?.description}
                    className="rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#B8860B]"
                  >
                    {def?.shortLabel ?? id}
                  </span>
                )
              })}
              {warningSignalIds.map((id) => {
                const def = LAUNCHPAD_SIGNALS[id]
                return (
                  <span
                    key={id}
                    title={def?.description}
                    className="rounded-full border border-[#C23B3B]/30 bg-[#C23B3B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#C23B3B]"
                  >
                    {def?.shortLabel ?? id}
                  </span>
                )
              })}
            </div>
          )}

          {/* Thin data warning */}
          {confidenceCapped && (
            <p className="mt-1 text-[10px] text-[#9C9C90]">
              Thin data — capped at 70
            </p>
          )}

          {/* AI compound thesis (lazy-loaded on expand) */}
          <CompoundThesis
            npi={target.npi}
            signals={allSignalIds}
            scores={trackScores}
            track={concreteTrack}
            practice={practiceSnapshot}
          />
        </div>

        {/* Score column */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {onTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePin(target.npi)
                }}
                aria-label={isPinned ? "Unpin practice" : "Pin practice"}
                aria-pressed={isPinned}
                title={isPinned ? "Unpin from pinboard" : "Pin to pinboard"}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                  isPinned
                    ? "border-[#B8860B]/40 bg-[#B8860B]/10 text-[#B8860B] hover:bg-[#B8860B]/15"
                    : "border-[#E8E5DE] bg-[#FFFFFF] text-[#9C9C90] hover:border-[#D4D0C8] hover:text-[#1A1A1A]"
                )}
              >
                {isPinned ? (
                  <PinOff className="h-3 w-3" />
                ) : (
                  <Pin className="h-3 w-3" />
                )}
              </button>
            )}
            <span
              className="font-mono text-[28px] font-bold leading-none tracking-tight text-[#1A1A1A]"
              style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
            >
              {Math.round(target.displayScore)}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
            {tierLabel}
          </span>
        </div>
      </div>
    </li>
  )
}
