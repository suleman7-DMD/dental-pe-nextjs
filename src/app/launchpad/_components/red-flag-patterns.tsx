"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LAUNCHPAD_SIGNALS,
  type LaunchpadBundle,
  type LaunchpadRankedTarget,
  type LaunchpadSignalId,
} from "@/lib/launchpad/signals"

interface RedFlagPatternsProps {
  bundle: LaunchpadBundle | null
  onSelectNpi: (npi: string) => void
}

const WARNING_SIGNALS: LaunchpadSignalId[] = [
  "dso_avoid_warning",
  "family_dynasty_warning",
  "ghost_practice_warning",
  "recent_acquisition_warning",
  "associate_saturated_signal",
  "medicaid_mill_warning",
  "non_compete_radius_warning",
  "pe_recap_volatility_warning",
]

export function RedFlagPatterns({ bundle, onSelectNpi }: RedFlagPatternsProps) {
  const [expanded, setExpanded] = useState(false)

  const { marginals, compoundTargets, totalFlagged } =
    useMemo(() => {
      const marginals: Record<LaunchpadSignalId, number> = {} as Record<
        LaunchpadSignalId,
        number
      >
      for (const id of WARNING_SIGNALS) marginals[id] = 0

      const targets: LaunchpadRankedTarget[] = []

      if (!bundle) {
        return {
          marginals,
          compoundTargets: targets,
          totalFlagged: 0,
        }
      }

      for (const target of bundle.rankedTargets) {
        const warnings = target.warningSignalIds.filter((id) =>
          WARNING_SIGNALS.includes(id)
        )
        if (warnings.length === 0) continue
        for (const id of warnings) marginals[id] = (marginals[id] ?? 0) + 1
        if (warnings.length >= 2) targets.push(target)
      }

      targets.sort((a, b) => {
        const aw = a.warningSignalIds.length
        const bw = b.warningSignalIds.length
        if (bw !== aw) return bw - aw
        return b.displayScore - a.displayScore
      })

      const totalFlagged = Object.values(marginals).reduce((s, v) => s + v, 0)

      return {
        marginals,
        compoundTargets: targets.slice(0, 12),
        totalFlagged,
      }
    }, [bundle])

  const presentSignals = WARNING_SIGNALS.filter((id) => marginals[id] > 0)
  const hasData = presentSignals.length > 0
  const compoundCount = compoundTargets.length

  if (!hasData) return null

  return (
    <section
      className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]"
      aria-label="Red flag patterns"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[#707064]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#707064]" />
          )}
          <AlertTriangle className="h-4 w-4 text-[#D4920B]" />
          <span className="text-sm font-semibold text-[#1A1A1A]">
            Red flag patterns
          </span>
          <span className="text-xs text-[#6B6B60]">
            {presentSignals.length} warning{presentSignals.length === 1 ? "" : "s"}{" "}
            active · {totalFlagged} total hits · {compoundCount} practices with 2+
            warnings
          </span>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#B8860B]">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#E8E5DE] px-4 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Compound red flags ({compoundCount})
          </p>
          {compoundCount === 0 ? (
            <p className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-3 text-xs text-[#6B6B60]">
              No practices in scope carry multiple warnings — the warning set here shows isolated
              patterns, not clusters.
            </p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {compoundTargets.map((target) => {
                const displayName =
                  target.practice.doing_business_as ??
                  target.practice.practice_name ??
                  `NPI ${target.npi}`
                return (
                  <li key={target.npi}>
                    <button
                      type="button"
                      onClick={() => onSelectNpi(target.npi)}
                      className={cn(
                        "group flex w-full items-start gap-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-2 text-left transition-colors",
                        "hover:border-[#C23B3B]/40 hover:bg-[#C23B3B]/5"
                      )}
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C23B3B]/10 font-mono text-[10px] font-bold text-[#C23B3B]">
                        {target.warningSignalIds.length}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#1A1A1A]">
                          {displayName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {target.warningSignalIds
                            .filter((id) => WARNING_SIGNALS.includes(id))
                            .map((id) => (
                              <span
                                key={id}
                                className="rounded bg-[#C23B3B]/10 px-1 py-0.5 text-[9px] font-medium text-[#C23B3B]"
                              >
                                {LAUNCHPAD_SIGNALS[id].shortLabel}
                              </span>
                            ))}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-[#707064] group-hover:text-[#B8860B]">
                        {Math.round(target.displayScore)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
