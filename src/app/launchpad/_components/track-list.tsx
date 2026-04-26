"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { exportToCsv } from "@/lib/utils/csv-export"
import {
  LAUNCHPAD_TIER_LABELS,
  LAUNCHPAD_TIERS,
  type LaunchpadBundle,
  type LaunchpadRankedTarget,
  type LaunchpadTier,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"
import { TrackListCard } from "./track-list-card"
import { getPracticeDisplayName } from "@/lib/launchpad/display"

interface TrackListProps {
  bundle: LaunchpadBundle | null
  track: LaunchpadTrack
  selectedNpi: string | null
  onSelect: (npi: string) => void
  pinnedNpis?: string[]
  onTogglePin?: (npi: string) => void
  className?: string
}

const TIER_SECTION_COLORS: Record<LaunchpadTier, string> = {
  best_fit: "text-[#2D8B4E]",
  strong: "text-[#B8860B]",
  maybe: "text-[#2563EB]",
  low: "text-[#6B6B60]",
  avoid: "text-[#C23B3B]",
}

const DEFAULT_EXPANDED_TIERS: ReadonlySet<LaunchpadTier> = new Set<LaunchpadTier>([
  "best_fit",
  "strong",
])

function exportRankedCsv(targets: LaunchpadRankedTarget[], track: LaunchpadTrack) {
  const rows = targets.map((t) => ({
    rank: t.rank,
    npi: t.npi,
    practice: getPracticeDisplayName(t.practice),
    city: t.practice.city ?? "",
    state: t.practice.state ?? "",
    zip: t.practice.zip ?? "",
    best_track: t.bestTrack,
    score: Math.round(t.displayScore),
    tier: t.displayTier,
    commutable: t.commutable ? "yes" : "no",
    dso_tier: t.dsoTier ?? "",
    signals: t.activeSignalIds.join("|"),
    warnings: t.warningSignalIds.join("|"),
  }))
  const columns = [
    "rank", "npi", "practice", "city", "state", "zip",
    "best_track", "score", "tier", "commutable", "dso_tier", "signals", "warnings",
  ]
  const headerMap: Record<string, string> = {
    rank: "Rank", npi: "NPI", practice: "Practice", city: "City", state: "State",
    zip: "ZIP", best_track: "Best Track", score: "Score", tier: "Tier",
    commutable: "Commutable", dso_tier: "DSO Tier", signals: "Opportunity Signals",
    warnings: "Warning Signals",
  }
  exportToCsv(
    rows as Record<string, unknown>[],
    columns,
    headerMap,
    `launchpad-${track}-${new Date().toISOString().slice(0, 10)}.csv`
  )
}

export function TrackList({
  bundle,
  track,
  selectedNpi,
  onSelect,
  pinnedNpis,
  onTogglePin,
  className,
}: TrackListProps) {
  const [expandedTiers, setExpandedTiers] = useState<Set<LaunchpadTier>>(
    () => new Set(DEFAULT_EXPANDED_TIERS)
  )
  const pinnedSet = useMemo(() => new Set(pinnedNpis ?? []), [pinnedNpis])

  const rankedTargets = useMemo(
    () => bundle?.rankedTargets ?? [],
    [bundle]
  )

  const grouped = useMemo(() => {
    const map = new Map<LaunchpadTier, LaunchpadRankedTarget[]>()
    for (const tier of LAUNCHPAD_TIERS) {
      map.set(tier, [])
    }
    for (const target of rankedTargets) {
      const group = map.get(target.displayTier)
      if (group) group.push(target)
    }
    return map
  }, [rankedTargets])

  const toggleTier = (tier: LaunchpadTier) => {
    setExpandedTiers((current) => {
      const next = new Set(current)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  return (
    <section
      className={cn("rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]", className)}
      aria-label="Ranked practice list"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">
            Ranked practices
            <span className="ml-2 rounded-md bg-[#F7F7F4] px-1.5 py-0.5 text-[11px] font-medium text-[#6B6B60]">
              {rankedTargets.length} total
            </span>
          </h2>
          {rankedTargets.length > 0 && (
            <p className="text-xs text-[#707064]">
              Top score {Math.round(rankedTargets[0]?.displayScore ?? 0)} ·{" "}
              {(grouped.get("best_fit") ?? []).length} best-fit ·{" "}
              {(grouped.get("strong") ?? []).length} strong
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => exportRankedCsv(rankedTargets, track)}
          disabled={rankedTargets.length === 0}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 text-[11px] font-medium text-[#6B6B60] transition-colors hover:bg-[#F7F7F4] hover:text-[#1A1A1A] disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </header>

      {rankedTargets.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-[#6B6B60]">
          No practices loaded yet — select a living location above.
        </div>
      ) : (
        <div className="max-h-[800px] overflow-y-auto">
          {LAUNCHPAD_TIERS.map((tier) => {
            const items = grouped.get(tier) ?? []
            if (items.length === 0) return null
            const isExpanded = expandedTiers.has(tier)
            const colorClass = TIER_SECTION_COLORS[tier]

            return (
              <div key={tier} className="border-b border-[#E8E5DE] last:border-b-0">
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleTier(tier)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[#FAFAF7]"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#6B6B60]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#6B6B60]" />
                    )}
                    <span
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-wider",
                        colorClass
                      )}
                    >
                      {LAUNCHPAD_TIER_LABELS[tier]}
                    </span>
                    <span className="rounded-full bg-[#F7F7F4] px-2 py-0.5 text-[11px] font-medium text-[#6B6B60]">
                      {items.length}
                    </span>
                  </div>
                </button>

                {/* Card list */}
                {isExpanded && (
                  <ol className="divide-y divide-[#E8E5DE]">
                    {items.map((target) => (
                      <TrackListCard
                        key={target.npi}
                        target={target}
                        isSelected={selectedNpi === target.npi}
                        onSelect={onSelect}
                        track={track}
                        isPinned={pinnedSet.has(target.npi)}
                        onTogglePin={onTogglePin}
                      />
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
