"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { exportToCsv } from "@/lib/utils/csv-export"
import {
  LAUNCHPAD_LANES,
  LAUNCHPAD_LANE_CAPS,
  LAUNCHPAD_LANE_COLORS,
  LAUNCHPAD_LANE_DESCRIPTIONS,
  LAUNCHPAD_LANE_LABELS,
  type LaunchpadBundle,
  type LaunchpadLane,
  type LaunchpadRankedTarget,
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
  /** Opens the dossier with the Score tab pre-selected. */
  onOpenScore?: (npi: string) => void
  className?: string
}

// All three lanes start expanded — "Needs research" must stay visible, not
// buried, because most of the pool lives there until the census reviews it.
const DEFAULT_EXPANDED_LANES: ReadonlySet<LaunchpadLane> = new Set<LaunchpadLane>([
  "verified_target",
  "promising_lead",
  "needs_research",
])
const PAGE_SIZE = 100

function exportRankedCsv(targets: LaunchpadRankedTarget[], track: LaunchpadTrack) {
  const rows = targets.map((t) => ({
    rank: t.rank,
    npi: t.npi,
    practice: getPracticeDisplayName(t.practice),
    city: t.practice.city ?? "",
    state: t.practice.state ?? "",
    zip: t.practice.zip ?? "",
    lane: LAUNCHPAD_LANE_LABELS[t.lane],
    ownership_tier: t.ownershipTier ?? "not_reviewed",
    network: t.networkLabel ?? "",
    pe_backed: t.peBacked ? "yes" : "no",
    best_track: t.bestTrack,
    score: Math.round(t.displayScore),
    tier: t.displayTier,
    commutable: t.commutable ? "yes" : "no",
    dso_employment_tier: t.dsoTier ?? "",
    signals: t.activeSignalIds.join("|"),
    warnings: t.warningSignalIds.join("|"),
  }))
  const columns = [
    "rank", "npi", "practice", "city", "state", "zip",
    "lane", "ownership_tier", "network", "pe_backed",
    "best_track", "score", "tier", "commutable", "dso_employment_tier", "signals", "warnings",
  ]
  const headerMap: Record<string, string> = {
    rank: "Rank", npi: "NPI", practice: "Practice", city: "City", state: "State",
    zip: "ZIP", lane: "Lane", ownership_tier: "Census Ownership Tier",
    network: "Network", pe_backed: "PE-Backed",
    best_track: "Best Track", score: "Score", tier: "Fit Tier",
    commutable: "Commutable", dso_employment_tier: "DSO Employment Tier",
    signals: "Opportunity Signals", warnings: "Warning Signals",
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
  onOpenScore,
  className,
}: TrackListProps) {
  const [expandedLanes, setExpandedLanes] = useState<Set<LaunchpadLane>>(
    () => new Set(DEFAULT_EXPANDED_LANES)
  )
  const [page, setPage] = useState(1)
  const pinnedSet = useMemo(() => new Set(pinnedNpis ?? []), [pinnedNpis])

  const rankedTargets = useMemo(
    () => bundle?.rankedTargets ?? [],
    [bundle]
  )

  useEffect(() => {
    setPage(1)
  }, [rankedTargets.length, track])

  const totalPages = Math.max(1, Math.ceil(rankedTargets.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedTargets = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return rankedTargets.slice(start, start + PAGE_SIZE)
  }, [rankedTargets, safePage])

  const totalGrouped = useMemo(() => {
    const map = new Map<LaunchpadLane, LaunchpadRankedTarget[]>()
    for (const lane of LAUNCHPAD_LANES) {
      map.set(lane, [])
    }
    for (const target of rankedTargets) {
      const group = map.get(target.lane)
      if (group) group.push(target)
    }
    return map
  }, [rankedTargets])

  const grouped = useMemo(() => {
    const map = new Map<LaunchpadLane, LaunchpadRankedTarget[]>()
    for (const lane of LAUNCHPAD_LANES) {
      map.set(lane, [])
    }
    for (const target of paginatedTargets) {
      const group = map.get(target.lane)
      if (group) group.push(target)
    }
    return map
  }, [paginatedTargets])

  const toggleLane = (lane: LaunchpadLane) => {
    setExpandedLanes((current) => {
      const next = new Set(current)
      if (next.has(lane)) next.delete(lane)
      else next.add(lane)
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
            Ranked GP practices
            <span className="ml-2 rounded-md bg-[#F7F7F4] px-1.5 py-0.5 text-[11px] font-medium text-[#6B6B60]">
              {rankedTargets.length.toLocaleString()} total
            </span>
          </h2>
          {rankedTargets.length > 0 && (
            <p className="text-xs text-[#707064]">
              {(totalGrouped.get("verified_target") ?? []).length.toLocaleString()} verified ·{" "}
              {(totalGrouped.get("promising_lead") ?? []).length.toLocaleString()} promising ·{" "}
              {(totalGrouped.get("needs_research") ?? []).length.toLocaleString()} need research
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
          No GP practices loaded yet — select a living location above.
        </div>
      ) : (
        <div className="max-h-[800px] overflow-y-auto">
          {LAUNCHPAD_LANES.map((lane) => {
            const items = grouped.get(lane) ?? []
            const laneTotal = (totalGrouped.get(lane) ?? []).length
            // Lane headers stay visible even when the lane has no rows on this
            // page, so the three-lane structure never silently collapses.
            if (laneTotal === 0) return null
            const isExpanded = expandedLanes.has(lane)
            const laneColor = LAUNCHPAD_LANE_COLORS[lane]
            const laneCap = LAUNCHPAD_LANE_CAPS[lane]

            return (
              <div key={lane} className="border-b border-[#E8E5DE] last:border-b-0">
                {/* Lane header */}
                <button
                  type="button"
                  onClick={() => toggleLane(lane)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FAFAF7]"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#6B6B60]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#6B6B60]" />
                      )}
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: laneColor }}
                      >
                        {LAUNCHPAD_LANE_LABELS[lane]}
                      </span>
                      <span className="rounded-full bg-[#F7F7F4] px-2 py-0.5 text-[11px] font-medium text-[#6B6B60]">
                        {laneTotal.toLocaleString()}
                      </span>
                      {laneCap != null && (
                        <span className="rounded-full border border-[#D4920B]/30 bg-[#D4920B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#98690A]">
                          scores capped at {laneCap}
                        </span>
                      )}
                    </div>
                    <p className="ml-6 mt-0.5 text-[11px] leading-snug text-[#9C9C90]">
                      {LAUNCHPAD_LANE_DESCRIPTIONS[lane]}
                    </p>
                  </div>
                </button>

                {/* Card list */}
                {isExpanded &&
                  (items.length > 0 ? (
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
                          onOpenScore={onOpenScore}
                        />
                      ))}
                    </ol>
                  ) : (
                    <p className="px-4 pb-3 pl-10 text-[11px] text-[#9C9C90]">
                      None on this page — use the pager below to reach this lane&apos;s rows.
                    </p>
                  ))}
              </div>
            )
          })}
          {rankedTargets.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-[#E8E5DE] px-4 py-3 text-xs text-[#6B6B60]">
              <span>
                Showing {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}-
                {Math.min(safePage * PAGE_SIZE, rankedTargets.length).toLocaleString()} of{' '}
                {rankedTargets.length.toLocaleString()} GP practices
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-1 text-[#1A1A1A] disabled:opacity-40"
                >
                  Previous
                </button>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-1 text-[#1A1A1A] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
