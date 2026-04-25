"use client"

import { useMemo } from "react"
import {
  ArrowUpRight,
  Flag,
  GitBranch,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/utils/formatting"
import { PRACTICE_FLAG_LABELS, ZIP_FLAG_LABELS } from "@/lib/warroom/intent"
import type {
  RankedTarget,
  WarroomPracticeSignalRecord,
  WarroomSitrepBundle,
} from "@/lib/warroom/signals"

interface InvestigateModePanelProps {
  bundle: WarroomSitrepBundle | null
  rankedTargets: RankedTarget[]
  onTargetSelect: (npi: string) => void
  onIntentRequest?: (intentText: string) => void
  className?: string
}

interface FlagCoOccurrence {
  flag: string
  label: string
  count: number
  topCoFlags: { flag: string; label: string; count: number }[]
}

const FLAG_DISPLAY_LABELS: Record<string, string> = {
  ...PRACTICE_FLAG_LABELS,
  ...ZIP_FLAG_LABELS,
}

function labelForFlag(flag: string): string {
  return (
    FLAG_DISPLAY_LABELS[flag] ??
    flag.replace(/_flag$/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function InvestigateModePanel({
  bundle,
  rankedTargets,
  onTargetSelect,
  onIntentRequest,
  className,
}: InvestigateModePanelProps) {
  const flagStats = useMemo<FlagCoOccurrence[]>(() => {
    if (rankedTargets.length === 0) return []
    const flagCounts = new Map<string, number>()
    const coFlagCounts = new Map<string, Map<string, number>>()
    for (const target of rankedTargets) {
      for (const flag of target.flags) {
        flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1)
        if (!coFlagCounts.has(flag)) coFlagCounts.set(flag, new Map())
        for (const other of target.flags) {
          if (other === flag) continue
          const inner = coFlagCounts.get(flag)!
          inner.set(other, (inner.get(other) ?? 0) + 1)
        }
      }
    }
    const stats: FlagCoOccurrence[] = Array.from(flagCounts.entries())
      .map(([flag, count]) => {
        const inner = coFlagCounts.get(flag) ?? new Map()
        const topCoFlags = Array.from(inner.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([f, c]) => ({ flag: f, label: labelForFlag(f), count: c }))
        return { flag, label: labelForFlag(flag), count, topCoFlags }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
    return stats
  }, [rankedTargets])

  const compoundTargets = useMemo(
    () =>
      rankedTargets
        .filter((target) => target.flagCount >= 2)
        .sort((a, b) => b.flagCount - a.flagCount || b.score - a.score)
        .slice(0, 6),
    [rankedTargets]
  )

  const topStealthClusters = useMemo<WarroomPracticeSignalRecord[]>(() => {
    return (bundle?.topSignals.stealthClusters ?? []).slice(0, 5)
  }, [bundle])

  const totalFlags = rankedTargets.reduce((sum, t) => sum + t.flagCount, 0)
  const avgFlagsPerTarget =
    rankedTargets.length > 0 ? totalFlags / rankedTargets.length : 0

  return (
    <section
      className={cn(
        "rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] shadow-sm",
        className
      )}
      aria-label="Investigate mode"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[#B8860B]/10 text-[#B8860B]">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A1A]">Investigate signals</h2>
            <p className="text-[11px] text-[#707064]">
              Pattern detection across ranked targets
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B60]">
          <span className="rounded-full border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1 font-mono">
            {formatNumber(totalFlags)} flags fired
          </span>
          <span className="rounded-full border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1 font-mono">
            Avg {avgFlagsPerTarget.toFixed(1)} / target
          </span>
        </div>
      </header>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
            <Flag className="h-3.5 w-3.5 text-[#707064]" />
            Signal prevalence &amp; co-occurrence
          </div>
          {flagStats.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-4 text-center text-[11px] text-[#6B6B60]">
              No flags fired on the current ranked targets.
            </div>
          ) : (
            <ul className="space-y-2">
              {flagStats.map((stat) => (
                <li
                  key={stat.flag}
                  className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onIntentRequest?.(`practices with ${stat.label.toLowerCase()}`)
                      }
                      className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-[#B8860B]"
                      title={`Filter to "${stat.label}"`}
                    >
                      <span className="truncate text-[13px] font-semibold text-[#1A1A1A] hover:text-[#B8860B]">
                        {stat.label}
                      </span>
                      <Search className="h-3 w-3 shrink-0 text-[#707064]" />
                    </button>
                    <span className="shrink-0 font-mono text-[12px] text-[#1A1A1A]">
                      {stat.count}
                    </span>
                  </div>
                  {stat.topCoFlags.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-[#6B6B60]">
                      <span className="text-[#707064]">often with:</span>
                      {stat.topCoFlags.map((co) => (
                        <span
                          key={co.flag}
                          className="rounded border border-[#E8E5DE] bg-[#FAFAF7] px-1.5 py-0.5 font-mono"
                        >
                          {co.label} ×{co.count}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
            <Layers className="h-3.5 w-3.5 text-[#707064]" />
            Compound-signal targets
          </div>
          {compoundTargets.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-4 text-center text-[11px] text-[#6B6B60]">
              No practices with 2+ overlapping signals in this scope.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {compoundTargets.map((target) => (
                <li key={target.npi}>
                  <button
                    type="button"
                    onClick={() => onTargetSelect(target.npi)}
                    className="group flex w-full items-center gap-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2.5 py-2 text-left transition-colors hover:border-[#B8860B]/40 hover:bg-[#B8860B]/5"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-[#C23B3B]/10 font-mono text-[11px] font-bold text-[#C23B3B]">
                      {target.flagCount}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#1A1A1A]">
                        {target.practiceName}
                      </p>
                      <p className="text-[11px] text-[#707064]">
                        ZIP {target.zip ?? "—"} · score {target.score}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-[#707064] transition-colors group-hover:text-[#B8860B]" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-1">
            <InvestigateSampleCard
              icon={ShieldAlert}
              color="#C23B3B"
              label="Stealth DSO clusters"
              items={topStealthClusters.map((s) => ({
                title: s.practice_name ?? "Practice",
                detail: `ZIP ${s.zip_code} · cluster ${s.stealth_dso_cluster_size ?? "?"}`,
                onClick: () => onTargetSelect(s.npi),
              }))}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function InvestigateSampleCard({
  icon: Icon,
  color,
  label,
  items,
}: {
  icon: typeof Sparkles
  color: string
  label: string
  items: { title: string; detail: string; onClick: () => void }[]
}) {
  return (
    <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[11px] font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-[#707064]">No entries.</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5">
          {items.slice(0, 3).map((item, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={item.onClick}
                className="group flex w-full items-center gap-1 text-left text-[11px] text-[#1A1A1A] hover:text-[#B8860B]"
              >
                <Users className="h-3 w-3 shrink-0 text-[#707064] group-hover:text-[#B8860B]" />
                <span className="truncate">{item.title}</span>
              </button>
              <p className="truncate pl-4 text-[10px] text-[#707064]">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

