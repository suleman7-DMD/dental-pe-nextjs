"use client"

import { useMemo } from "react"
import { Pin, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LAUNCHPAD_TIER_LABELS,
  type LaunchpadBundle,
  type LaunchpadRankedTarget,
} from "@/lib/launchpad/signals"
import { DSO_TIER_LABELS, resolveDsoTierEntry } from "@/lib/launchpad/dso-tiers"

interface PinboardPanelProps {
  bundle: LaunchpadBundle | null
  pinnedNpis: string[]
  onSelectNpi: (npi: string) => void
  onTogglePin: (npi: string) => void
  onClearAll: () => void
}

const TIER_BADGE_COLORS: Record<
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

export function PinboardPanel({
  bundle,
  pinnedNpis,
  onSelectNpi,
  onTogglePin,
  onClearAll,
}: PinboardPanelProps) {
  const pinnedTargets = useMemo(() => {
    if (!bundle || pinnedNpis.length === 0) return []
    const byNpi = new Map<string, LaunchpadRankedTarget>()
    for (const target of bundle.rankedTargets) byNpi.set(target.npi, target)
    return pinnedNpis
      .map((npi) => byNpi.get(npi) ?? null)
      .filter((t): t is LaunchpadRankedTarget => t !== null)
  }, [bundle, pinnedNpis])

  const outOfScopeCount = pinnedNpis.length - pinnedTargets.length

  if (pinnedNpis.length === 0) return null

  return (
    <section
      className="rounded-lg border border-[#B8860B]/30 bg-gradient-to-br from-[#FEF9E7] to-[#FFFFFF]"
      aria-label="Pinned practices"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#B8860B]/20 px-4 py-2">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[#B8860B]" />
          <span className="text-sm font-semibold text-[#1A1A1A]">Pinboard</span>
          <span className="rounded-full bg-[#B8860B]/10 px-2 py-0.5 text-[11px] font-medium text-[#B8860B]">
            {pinnedNpis.length}
          </span>
          {outOfScopeCount > 0 && (
            <span className="text-[11px] text-[#9C9C90]">
              ({outOfScopeCount} out of scope)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-medium text-[#6B6B60] underline-offset-2 transition-colors hover:text-[#C23B3B] hover:underline"
        >
          Clear all
        </button>
      </div>

      {pinnedTargets.length === 0 ? (
        <p className="px-4 py-4 text-xs text-[#6B6B60]">
          Pinned practices are outside the current scope. Switch scope or clear pins to
          continue.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <ul className="flex min-w-full gap-2 px-4 py-3">
            {pinnedTargets.map((target) => {
              const displayName =
                target.practice.doing_business_as ??
                target.practice.practice_name ??
                `NPI ${target.npi}`
              const location = [target.practice.city, target.practice.state]
                .filter(Boolean)
                .join(", ")
              const tierStyle =
                TIER_BADGE_COLORS[target.displayTier] ?? TIER_BADGE_COLORS.low
              const dsoEntry = target.practice.affiliated_dso
                ? resolveDsoTierEntry(
                    target.practice.affiliated_dso,
                    target.practice.parent_company,
                    target.practice.franchise_name
                  )
                : null

              return (
                <li
                  key={target.npi}
                  className="group relative flex w-56 shrink-0 flex-col rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-2.5 transition-all hover:border-[#B8860B]/40 hover:shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => onTogglePin(target.npi)}
                    aria-label="Unpin"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-[#9C9C90] opacity-0 transition-all hover:bg-[#C23B3B]/10 hover:text-[#C23B3B] group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectNpi(target.npi)}
                    className="flex flex-col gap-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-[#1A1A1A] pr-4">
                        {displayName}
                      </span>
                      <span
                        className="font-mono text-lg font-bold leading-none tracking-tight text-[#1A1A1A]"
                        style={{
                          fontFamily:
                            "var(--font-mono, 'JetBrains Mono', monospace)",
                        }}
                      >
                        {Math.round(target.displayScore)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                          tierStyle.bg,
                          tierStyle.text,
                          tierStyle.border
                        )}
                      >
                        {LAUNCHPAD_TIER_LABELS[target.displayTier] ??
                          target.displayTier}
                      </span>
                      {dsoEntry && (
                        <span className="inline-flex shrink-0 rounded-full border border-[#D4D0C8] bg-[#F5F5F0] px-1.5 py-0.5 text-[9px] font-medium text-[#6B6B60]">
                          {DSO_TIER_LABELS[dsoEntry.tier]}
                        </span>
                      )}
                    </div>
                    {location && (
                      <span className="truncate text-[10px] text-[#6B6B60]">
                        {location}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
