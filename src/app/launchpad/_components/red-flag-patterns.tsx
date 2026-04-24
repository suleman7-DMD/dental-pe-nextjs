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

function heatColor(
  count: number,
  max: number
): { background: string; color: string } {
  if (count === 0 || max === 0) {
    return { background: "#FAFAF7", color: "#B5B5A8" }
  }
  const t = count / max
  if (t >= 0.66) return { background: "#C23B3B", color: "#FFFFFF" }
  if (t >= 0.33) return { background: "#D4920B", color: "#FFFFFF" }
  return { background: "#B8860B1A", color: "#B0780A" }
}

export function RedFlagPatterns({ bundle, onSelectNpi }: RedFlagPatternsProps) {
  const [expanded, setExpanded] = useState(false)

  const { marginals, matrix, compoundTargets, totalFlagged, maxCell } =
    useMemo(() => {
      const marginals: Record<LaunchpadSignalId, number> = {} as Record<
        LaunchpadSignalId,
        number
      >
      for (const id of WARNING_SIGNALS) marginals[id] = 0

      const matrix: Record<string, number> = {}
      const targets: LaunchpadRankedTarget[] = []

      if (!bundle) {
        return {
          marginals,
          matrix,
          compoundTargets: targets,
          totalFlagged: 0,
          maxCell: 0,
        }
      }

      for (const target of bundle.rankedTargets) {
        const warnings = target.warningSignalIds.filter((id) =>
          WARNING_SIGNALS.includes(id)
        )
        if (warnings.length === 0) continue
        for (const id of warnings) marginals[id] = (marginals[id] ?? 0) + 1
        for (let i = 0; i < warnings.length; i += 1) {
          for (let j = i; j < warnings.length; j += 1) {
            const a = warnings[i]
            const b = warnings[j]
            const key = a < b ? `${a}|${b}` : `${b}|${a}`
            matrix[key] = (matrix[key] ?? 0) + 1
          }
        }
        if (warnings.length >= 2) targets.push(target)
      }

      let max = 0
      for (let i = 0; i < WARNING_SIGNALS.length; i += 1) {
        for (let j = 0; j < WARNING_SIGNALS.length; j += 1) {
          if (i === j) continue
          const a = WARNING_SIGNALS[i]
          const b = WARNING_SIGNALS[j]
          const key = a < b ? `${a}|${b}` : `${b}|${a}`
          if ((matrix[key] ?? 0) > max) max = matrix[key] ?? 0
        }
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
        matrix,
        compoundTargets: targets.slice(0, 12),
        totalFlagged,
        maxCell: max,
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
        <div className="grid grid-cols-1 gap-4 border-t border-[#E8E5DE] px-4 py-4 lg:grid-cols-[1fr_320px]">
          {/* Matrix */}
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
              Co-occurrence heatmap
            </p>
            <div className="overflow-x-auto rounded-md border border-[#E8E5DE]">
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-r border-[#E8E5DE] bg-[#FAFAF7] px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
                      Warning
                    </th>
                    {presentSignals.map((id) => (
                      <th
                        key={id}
                        className="border-b border-[#E8E5DE] bg-[#FAFAF7] px-1 py-2 text-center font-semibold text-[#707064]"
                        style={{ minWidth: 52 }}
                      >
                        <span
                          className="block -rotate-12 whitespace-nowrap text-[10px]"
                          title={LAUNCHPAD_SIGNALS[id].label}
                        >
                          {LAUNCHPAD_SIGNALS[id].shortLabel}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {presentSignals.map((rowId) => (
                    <tr key={rowId}>
                      <td
                        className="sticky left-0 z-10 border-b border-r border-[#E8E5DE] bg-[#FFFFFF] px-2 py-1.5 text-left font-medium text-[#1A1A1A]"
                        title={LAUNCHPAD_SIGNALS[rowId].description}
                      >
                        {LAUNCHPAD_SIGNALS[rowId].shortLabel}
                      </td>
                      {presentSignals.map((colId) => {
                        const a = rowId
                        const b = colId
                        const key = a < b ? `${a}|${b}` : `${b}|${a}`
                        const count = matrix[key] ?? 0
                        const diagonal = rowId === colId
                        const colors = diagonal
                          ? { background: "#1A1A1A", color: "#FFFFFF" }
                          : heatColor(count, maxCell)
                        return (
                          <td
                            key={colId}
                            className="border-b border-[#E8E5DE] text-center font-mono"
                            style={{
                              background: colors.background,
                              color: colors.color,
                              padding: "6px 4px",
                            }}
                            title={
                              diagonal
                                ? `${LAUNCHPAD_SIGNALS[rowId].label} — ${count} target${
                                    count === 1 ? "" : "s"
                                  }`
                                : `${LAUNCHPAD_SIGNALS[rowId].label} + ${LAUNCHPAD_SIGNALS[colId].label} — ${count} target${
                                    count === 1 ? "" : "s"
                                  }`
                            }
                          >
                            {count || (diagonal ? marginals[rowId] : "·")}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-[#6B6B60]">
              Diagonal = total practices with that warning (solid dark). Off-diagonal = practices
              with both warnings. Darker cells = stronger co-occurrence.
            </p>
          </div>

          {/* Compound targets */}
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
              Compound red flags ({compoundCount})
            </p>
            {compoundCount === 0 ? (
              <p className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-3 text-xs text-[#6B6B60]">
                No practices in scope carry multiple warnings — the warning set here shows isolated
                patterns, not clusters.
              </p>
            ) : (
              <ul className="space-y-1.5">
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
        </div>
      )}
    </section>
  )
}
