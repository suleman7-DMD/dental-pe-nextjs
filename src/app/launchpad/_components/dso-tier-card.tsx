"use client"

import { Award, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  resolveDsoTierEntry,
  DSO_TIER_LABELS,
  DSO_TIER_COLORS,
  type DsoTierEntry,
  type DsoTier,
} from "@/lib/launchpad/dso-tiers"

interface DsoTierCardProps {
  /** DSO name or alias to look up. Falls back to "not found" state if not in tier list. */
  dsoName: string
  /** Optional additional class names for the outer container */
  className?: string
}

const TIER_BADGE_BG: Record<DsoTier, string> = {
  tier1: "bg-[#2D8B4E]/10 text-[#2D8B4E] border-[#2D8B4E]/30",
  tier2: "bg-[#D4920B]/10 text-[#D4920B] border-[#D4920B]/30",
  tier3: "bg-[#C47A3B]/10 text-[#C47A3B] border-[#C47A3B]/30",
  avoid: "bg-[#C23B3B]/10 text-[#C23B3B] border-[#C23B3B]/30",
  unknown: "bg-[#E8E5DE] text-[#6B6B60] border-[#D4D0C8]",
}

const TIER_LABEL_SHORT: Record<DsoTier, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
  avoid: "Avoid",
  unknown: "Unrated",
}

function TierBadge({ tier }: { tier: DsoTier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        TIER_BADGE_BG[tier]
      )}
    >
      <Award className="h-3 w-3" aria-hidden="true" />
      {TIER_LABEL_SHORT[tier]}
    </span>
  )
}

function CitationItem({ citation }: { citation: { label: string; url: string } }) {
  const isUrl = citation.url.startsWith("http")
  if (isUrl) {
    return (
      <li className="flex items-start gap-1">
        <span className="mt-0.5 shrink-0 text-[#9C9C90]">•</span>
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] text-[#2563EB] underline-offset-2 hover:underline"
        >
          {citation.label}
          <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        </a>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-1 text-[11px] text-[#6B6B60]">
      <span className="mt-0.5 shrink-0 text-[#9C9C90]">•</span>
      {citation.label}
    </li>
  )
}

function FoundCard({ entry }: { entry: DsoTierEntry }) {
  const tierColor = DSO_TIER_COLORS[entry.tier]
  return (
    <div
      className="space-y-3 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4"
      style={{ borderLeftColor: tierColor, borderLeftWidth: 3 }}
      role="article"
      aria-label={`DSO tier card for ${entry.name}`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A]">{entry.name}</h3>
          {entry.structure && (
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[#9C9C90]">
              {entry.structure}
            </p>
          )}
        </div>
        <TierBadge tier={entry.tier} />
      </div>

      {/* Tier label */}
      <p className="text-xs font-medium" style={{ color: tierColor }}>
        {DSO_TIER_LABELS[entry.tier]}
      </p>

      {/* Comp band */}
      {entry.compBand && (
        <div className="rounded-md bg-[#FAFAF7] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Compensation
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-[#1A1A1A]">
            {entry.compBand.base} base
          </p>
          <p className="text-xs text-[#6B6B60]">{entry.compBand.total} total</p>
          {entry.compBand.notes && (
            <p className="mt-1 text-[11px] italic text-[#9C9C90]">{entry.compBand.notes}</p>
          )}
        </div>
      )}

      {/* Rationale */}
      <p className="text-xs italic leading-relaxed text-[#6B6B60]">{entry.rationale}</p>

      {/* Citations */}
      {entry.citations.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-[#9C9C90]">Sources</p>
          <ul className="space-y-0.5">
            {entry.citations.map((citation, idx) => (
              <CitationItem key={idx} citation={citation} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NotFoundCard({ dsoName }: { dsoName: string }) {
  const subject = encodeURIComponent(`DSO Tier Suggestion: ${dsoName}`)
  const body = encodeURIComponent(
    `Hi,\n\nI'd like to suggest adding "${dsoName}" to the DSO tier list in Launchpad.\n\nRationale:\n\nComp band (if known):\n\nCitations / sources:\n`
  )
  const mailtoHref = `mailto:suleman7@bu.edu?subject=${subject}&body=${body}`

  return (
    <div
      className="space-y-2 rounded-lg border border-[#E8E5DE] bg-[#FAFAF7] p-4"
      role="article"
      aria-label={`DSO tier data not available for ${dsoName}`}
    >
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-[#9C9C90]" aria-hidden="true" />
        <p className="text-sm font-medium text-[#6B6B60]">
          DSO tier data not available
        </p>
      </div>
      <p className="text-xs text-[#9C9C90]">
        <span className="font-mono">{dsoName}</span> is not yet in the curated tier list.
      </p>
      <a
        href={mailtoHref}
        className="inline-flex items-center gap-1 text-[11px] text-[#2563EB] underline-offset-2 hover:underline"
      >
        Suggest a tier for this DSO
        <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
      </a>
    </div>
  )
}

/**
 * DsoTierCard — looks up a DSO by name in the curated tier list and renders
 * tier badge, comp band, rationale, and citations. Shows a "not available"
 * state with a mailto suggest link when the DSO is not found.
 */
export function DsoTierCard({ dsoName, className }: DsoTierCardProps) {
  const entry = resolveDsoTierEntry(dsoName)

  return (
    <div className={className}>
      {entry ? <FoundCard entry={entry} /> : <NotFoundCard dsoName={dsoName} />}
    </div>
  )
}
