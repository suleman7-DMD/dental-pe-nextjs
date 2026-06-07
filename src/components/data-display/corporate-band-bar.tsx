"use client"

/**
 * CorporateBandBar — the honest three-anchor consolidation band, visualized.
 *
 * Renders the per-LOCATION confirmed floor, the per-DENTIST confirmed floor
 * (our confirmed corporate, counted by dentist), and the ADA HPI per-dentist
 * anchor on one proportional track. The two shaded gaps are labeled by what
 * they MEAN:
 *   • floor → per-dentist : primarily office density (our confirmed corporate, by dentist)
 *   • per-dentist → anchor: the genuinely unmeasured local-name DSO share
 *
 * Presentational only. Source of truth is `consolidation-honesty.ts`
 * (`getCorporateBand` → `CorporateBand`). Never hardcode percentages here.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"
import type { CorporateBand } from "@/lib/constants/consolidation-honesty"

const CONFIRMED = "#C23B3B" // corporate red — our measured floors
const ANCHOR = "#B8860B" // goldenrod — external ADA anchor

interface CorporateBandBarProps {
  band: CorporateBand
  /** Heading above the bar. */
  title?: string
  /** Optional one-line caption under the title. */
  caption?: string
  className?: string
}

export function CorporateBandBar({
  band,
  title = "Corporate consolidation — confirmed floor to ADA anchor",
  caption,
  className,
}: CorporateBandBarProps) {
  const { confirmedPct, perDentistPct, anchorPct, anchorLabel, stateLabel } = band

  // Scale ceiling: round the anchor up to the next 5 and add headroom so the
  // anchor marker never sits flush against the right edge.
  const ceiling = Math.max(10, Math.ceil((anchorPct + 1) / 5) * 5)
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / ceiling) * 100))}%`
  const widthBetween = (a: number, b: number) =>
    `${Math.max(0, Math.min(100, ((b - a) / ceiling) * 100))}%`

  // Boundaries for the two gap segments (clamped so a non-monotonic state like
  // MA, where per-dentist < the location floor, simply collapses a segment).
  const bridgeStart = Math.min(confirmedPct, perDentistPct)
  const bridgeEnd = Math.max(confirmedPct, perDentistPct)
  const gapStart = Math.max(bridgeEnd, perDentistPct)

  const markers: Array<{ pct: number; label: string; color: string }> = [
    { pct: confirmedPct, label: `${confirmedPct.toFixed(1)}%`, color: CONFIRMED },
    { pct: perDentistPct, label: `${perDentistPct.toFixed(1)}%`, color: CONFIRMED },
    { pct: anchorPct, label: `${anchorPct.toFixed(1)}%`, color: ANCHOR },
  ]

  return (
    <div
      className={`rounded-lg border border-[#E8E5DE] bg-white p-4 px-5 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-[var(--font-dm-sans)] text-[13px] font-semibold uppercase tracking-wider text-[#1A1A1A]">
            {title}
          </h3>
          {caption && (
            <p className="mt-0.5 text-[11px] text-[#6B6B60]">{caption}</p>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger
            delay={200}
            render={
              <span className="cursor-help" aria-label="How to read this band">
                <HelpCircle className="h-3.5 w-3.5 text-[#9C9C90]" />
              </span>
            }
          />
          <TooltipContent
            side="top"
            className="max-w-[280px] border-[#D4D0C8] bg-[#FFFFFF] text-[11px] leading-relaxed text-[#1A1A1A] shadow-md"
          >
            Two of these three numbers are OURS. The first is confirmed corporate
            GP locations (documented evidence). The second counts our confirmed
            corporate by dentist instead of by location — the lift is mostly
            office density (~2x dentists per corporate office). The ADA figure is
            the external per-dentist anchor; the gap above our per-dentist floor
            is the genuinely unmeasured local-name DSO share.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* value labels above each marker */}
      <div className="relative mt-5 h-4">
        {markers.map((m, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap font-[var(--font-jetbrains-mono)] text-[11px] font-bold"
            style={{ left: pos(m.pct), color: m.color }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* the track */}
      <div className="relative h-3 w-full rounded-full bg-[#F0EEE8]">
        {/* seg 1: confirmed locations (solid) */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{ width: pos(confirmedPct), background: CONFIRMED }}
        />
        {/* seg 2: unit bridge — same data, by dentist (hatched red) */}
        <div
          className="absolute inset-y-0"
          style={{
            left: pos(bridgeStart),
            width: widthBetween(bridgeStart, bridgeEnd),
            backgroundImage: `repeating-linear-gradient(45deg, ${CONFIRMED}AA 0, ${CONFIRMED}AA 4px, ${CONFIRMED}55 4px, ${CONFIRMED}55 8px)`,
          }}
        />
        {/* seg 3: unmeasured — hidden local-name DSOs (hatched amber) */}
        <div
          className="absolute inset-y-0"
          style={{
            left: pos(gapStart),
            width: widthBetween(gapStart, anchorPct),
            backgroundImage: `repeating-linear-gradient(45deg, ${ANCHOR}88 0, ${ANCHOR}88 4px, ${ANCHOR}33 4px, ${ANCHOR}33 8px)`,
          }}
        />
        {/* anchor tick */}
        <div
          className="absolute -top-1 bottom-[-4px] w-[2px] -translate-x-1/2"
          style={{ left: pos(anchorPct), background: ANCHOR }}
        />
        {/* the two confirmed ticks */}
        {[confirmedPct, perDentistPct].map((v, i) => (
          <div
            key={i}
            className="absolute -top-1 bottom-[-4px] w-[2px] -translate-x-1/2"
            style={{ left: pos(v), background: CONFIRMED }}
          />
        ))}
      </div>

      {/* axis labels under each marker */}
      <div className="relative mt-2 h-8">
        <span
          className="absolute -translate-x-1/2 text-center text-[10px] leading-tight text-[#6B6B60]"
          style={{ left: pos(confirmedPct), maxWidth: 90 }}
        >
          Confirmed
          <br />
          (locations)
        </span>
        <span
          className="absolute -translate-x-1/2 text-center text-[10px] leading-tight text-[#6B6B60]"
          style={{ left: pos(perDentistPct), maxWidth: 90 }}
        >
          Confirmed
          <br />({stateLabel} dentists)
        </span>
        <span
          className="absolute -translate-x-1/2 text-center text-[10px] leading-tight text-[#9C7324]"
          style={{ left: pos(anchorPct), maxWidth: 110 }}
        >
          {anchorLabel}
        </span>
      </div>

      {/* legend — what the two gaps mean */}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-[#F0EEE8] pt-3 text-[11px] text-[#6B6B60] sm:flex-row sm:gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, ${CONFIRMED}AA 0, ${CONFIRMED}AA 3px, ${CONFIRMED}55 3px, ${CONFIRMED}55 6px)`,
            }}
          />
          Density effect — our confirmed corporate, by dentist
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, ${ANCHOR}88 0, ${ANCHOR}88 3px, ${ANCHOR}33 3px, ${ANCHOR}33 6px)`,
            }}
          />
          Unmeasured — hidden local-name DSOs
        </span>
      </div>
    </div>
  )
}
