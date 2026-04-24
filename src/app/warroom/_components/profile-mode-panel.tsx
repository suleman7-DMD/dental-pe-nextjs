"use client"

import { useMemo } from "react"
import {
  ArrowUpRight,
  Flame,
  GitCompareArrows,
  Pin,
  ThermometerSnowflake,
  ThermometerSun,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/utils/formatting"
import type { RankedTarget } from "@/lib/warroom/signals"

interface ProfileModePanelProps {
  pinnedNpis: string[]
  pinTargets: Map<string, RankedTarget>
  selectedEntity: string | null
  onSelectEntity: (npi: string) => void
  rankedTargets: RankedTarget[]
  className?: string
}

const TIER_ICONS = {
  hot: Flame,
  warm: ThermometerSun,
  cool: ThermometerSnowflake,
  cold: ThermometerSnowflake,
}

const TIER_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  hot: { text: "text-[#C23B3B]", bg: "bg-[#C23B3B]/10", border: "border-[#C23B3B]/30" },
  warm: { text: "text-[#D4920B]", bg: "bg-[#D4920B]/10", border: "border-[#D4920B]/30" },
  cool: { text: "text-[#2563EB]", bg: "bg-[#2563EB]/10", border: "border-[#2563EB]/30" },
  cold: { text: "text-[#6B6B60]", bg: "bg-[#E8E5DE]", border: "border-[#D4D0C8]" },
}

export function ProfileModePanel({
  pinnedNpis,
  pinTargets,
  selectedEntity,
  onSelectEntity,
  rankedTargets,
  className,
}: ProfileModePanelProps) {
  const pinned = useMemo(
    () => pinnedNpis.map((npi) => pinTargets.get(npi)).filter((t): t is RankedTarget => t != null),
    [pinnedNpis, pinTargets]
  )

  const selectedTarget = useMemo(
    () => rankedTargets.find((t) => t.npi === selectedEntity) ?? null,
    [rankedTargets, selectedEntity]
  )

  const suggestedTargets = useMemo(() => {
    const base = selectedTarget
      ? rankedTargets.filter(
          (t) =>
            t.npi !== selectedTarget.npi &&
            (t.zip === selectedTarget.zip ||
              t.entityClassification === selectedTarget.entityClassification)
        )
      : rankedTargets.slice(0, 6)
    return base.slice(0, 6)
  }, [rankedTargets, selectedTarget])

  const peerPool = useMemo(() => {
    if (!selectedTarget?.zip) return null
    const peers = rankedTargets.filter((t) => t.zip === selectedTarget.zip)
    if (peers.length === 0) return null
    const avgScore = Math.round(
      peers.reduce((sum, p) => sum + p.score, 0) / peers.length
    )
    return {
      count: peers.length,
      avgScore,
      rank:
        peers
          .slice()
          .sort((a, b) => b.score - a.score)
          .findIndex((p) => p.npi === selectedTarget.npi) + 1,
    }
  }, [rankedTargets, selectedTarget])

  return (
    <section
      className={cn(
        "rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] shadow-sm",
        className
      )}
      aria-label="Profile mode"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[#B8860B]/10 text-[#B8860B]">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A1A]">Profile focus</h2>
            <p className="text-[11px] text-[#707064]">
              Deep dive one target and compare against peers
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1 font-mono text-xs text-[#6B6B60]">
          {pinnedNpis.length} pinned · {rankedTargets.length} ranked
        </span>
      </header>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
            <Pin className="h-3.5 w-3.5 text-[#707064]" />
            Pinned
          </div>
          {pinned.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-4 text-center text-[11px] text-[#6B6B60]">
              Pin targets from the map or target list to profile them side by side.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {pinned.map((target) => {
                const tier = TIER_COLORS[target.tier]
                const TierIcon = TIER_ICONS[target.tier]
                const isActive = selectedEntity === target.npi
                return (
                  <li key={target.npi}>
                    <button
                      type="button"
                      onClick={() => onSelectEntity(target.npi)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                        isActive
                          ? "border-[#B8860B]/40 bg-[#B8860B]/10"
                          : "border-[#E8E5DE] bg-[#FFFFFF] hover:border-[#D4D0C8] hover:bg-[#FAFAF7]"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          tier.bg,
                          tier.text,
                          tier.border
                        )}
                      >
                        <TierIcon className="h-3 w-3" />
                        {target.tier}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#1A1A1A]">
                          {target.practiceName}
                        </p>
                        <p className="text-[11px] text-[#707064]">
                          ZIP {target.zip ?? "—"}
                          {target.entityClassification
                            ? ` · ${target.entityClassification}`
                            : ""}
                        </p>
                      </div>
                      <span className="font-mono text-[12px] text-[#1A1A1A]">
                        {target.score}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
            <GitCompareArrows className="h-3.5 w-3.5 text-[#707064]" />
            {selectedTarget ? "Peer comparison" : "Recommended to pin"}
          </div>

          {selectedTarget && peerPool && (
            <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 text-[11px] text-[#6B6B60]">
              <p>
                <span className="font-mono font-semibold text-[#1A1A1A]">
                  #{peerPool.rank}
                </span>{" "}
                of <span className="font-mono">{peerPool.count}</span> ranked
                practices in ZIP {selectedTarget.zip}
              </p>
              <p className="mt-1">
                Peer average score:{" "}
                <span className="font-mono text-[#1A1A1A]">
                  {formatNumber(peerPool.avgScore)}
                </span>
              </p>
            </div>
          )}

          {suggestedTargets.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-4 text-center text-[11px] text-[#6B6B60]">
              Select a target to see similar peers nearby.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {suggestedTargets.map((target) => (
                <li key={target.npi}>
                  <button
                    type="button"
                    onClick={() => onSelectEntity(target.npi)}
                    className="group flex w-full items-center gap-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2.5 py-2 text-left transition-colors hover:border-[#B8860B]/40 hover:bg-[#B8860B]/5"
                  >
                    <span className="font-mono text-[11px] text-[#B8860B]">
                      #{target.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#1A1A1A]">
                        {target.practiceName}
                      </p>
                      <p className="text-[11px] text-[#707064]">
                        ZIP {target.zip ?? "—"} · {target.entityClassification ?? "—"}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] text-[#1A1A1A]">
                      {target.score}
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-[#707064] transition-colors group-hover:text-[#B8860B]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
