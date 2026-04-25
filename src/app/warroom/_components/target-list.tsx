"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Flame,
  MapPin,
  Pin,
  Sparkles,
  Star,
  ThermometerSnowflake,
  ThermometerSun,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber } from "@/lib/utils/formatting"
import { exportToCsv } from "@/lib/utils/csv-export"
import type { RankedTarget, WarroomScoreComponent } from "@/lib/warroom/signals"
import type { WarroomLens } from "@/lib/warroom/mode"
import { getWarroomLensLabel } from "@/lib/warroom/mode"

interface TargetListProps {
  targets: RankedTarget[]
  lens: WarroomLens
  selectedNpi: string | null
  onSelect: (npi: string) => void
  pinnedNpis?: Set<string>
  onPin?: (npi: string) => void
  onUnpin?: (npi: string) => void
  intelAvailable?: Set<string>
  reviewedNpis?: Set<string>
  onMarkReviewed?: (npi: string) => void
  onUnmarkReviewed?: (npi: string) => void
  className?: string
}

type TierFilter = "all" | RankedTarget["tier"]

const TIER_STYLES: Record<
  RankedTarget["tier"],
  { bg: string; text: string; border: string; icon: typeof Flame; label: string }
> = {
  hot: {
    bg: "bg-[#C23B3B]/10",
    text: "text-[#C23B3B]",
    border: "border-[#C23B3B]/30",
    icon: Flame,
    label: "Hot",
  },
  warm: {
    bg: "bg-[#D4920B]/10",
    text: "text-[#D4920B]",
    border: "border-[#D4920B]/30",
    icon: ThermometerSun,
    label: "Warm",
  },
  cool: {
    bg: "bg-[#2563EB]/10",
    text: "text-[#2563EB]",
    border: "border-[#2563EB]/30",
    icon: ThermometerSnowflake,
    label: "Cool",
  },
  cold: {
    bg: "bg-[#E8E5DE]",
    text: "text-[#6B6B60]",
    border: "border-[#D4D0C8]",
    icon: ThermometerSnowflake,
    label: "Cold",
  },
}

function ScoreBreakdown({ components }: { components: WarroomScoreComponent[] }) {
  const positive = components.filter((component) => component.contribution > 0)
  const negative = components.filter((component) => component.contribution < 0)
  const neutral = components.filter((component) => component.contribution === 0)

  return (
    <div className="space-y-2 text-[11px]">
      {positive.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold uppercase tracking-wider text-[#2D8B4E]">
            Adds
          </p>
          <ul className="space-y-1">
            {positive.map((component) => (
              <li key={component.label} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="font-medium text-[#1A1A1A]">{component.label}</span>
                  <p className="text-[#6B6B60]">{component.reasoning}</p>
                </div>
                <span className="font-mono font-semibold text-[#2D8B4E]">
                  +{component.contribution}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {negative.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold uppercase tracking-wider text-[#C23B3B]">
            Subtracts
          </p>
          <ul className="space-y-1">
            {negative.map((component) => (
              <li key={component.label} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="font-medium text-[#1A1A1A]">{component.label}</span>
                  <p className="text-[#6B6B60]">{component.reasoning}</p>
                </div>
                <span className="font-mono font-semibold text-[#C23B3B]">
                  {component.contribution}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {neutral.length > 0 && (
        <details className="rounded-md border border-[#E8E5DE] px-2 py-1">
          <summary className="cursor-pointer text-[11px] font-medium text-[#707064]">
            {neutral.length} neutral factors
          </summary>
          <ul className="mt-1 space-y-1">
            {neutral.map((component) => (
              <li key={component.label} className="flex items-start justify-between gap-3">
                <span className="font-medium text-[#6B6B60]">{component.label}</span>
                <span className="font-mono text-[#707064]">{component.contribution}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function exportRankedCsv(targets: RankedTarget[], lens: WarroomLens) {
  const rows = targets.map((target) => ({
    rank: target.rank,
    npi: target.npi,
    practice: target.practiceName,
    city: target.city ?? "",
    zip: target.zip ?? "",
    tier: target.tier,
    score: target.score,
    ownership: target.ownershipGroup,
    entity_classification: target.entityClassification ?? "",
    buyability: target.buyabilityScore ?? "",
    year_established: target.yearEstablished ?? "",
    employees: target.employeeCount ?? "",
    providers: target.numProviders ?? "",
    estimated_revenue: target.estimatedRevenue ?? "",
    flags: target.flags.join("|"),
    headline: target.headline,
  }))
  const columns = [
    "rank",
    "npi",
    "practice",
    "city",
    "zip",
    "tier",
    "score",
    "ownership",
    "entity_classification",
    "buyability",
    "year_established",
    "employees",
    "providers",
    "estimated_revenue",
    "flags",
    "headline",
  ]
  const headerMap: Record<string, string> = {
    rank: "Rank",
    npi: "NPI",
    practice: "Practice",
    city: "City",
    zip: "ZIP",
    tier: "Tier",
    score: "Score",
    ownership: "Ownership",
    entity_classification: "Entity Classification",
    buyability: "Buyability",
    year_established: "Year Established",
    employees: "Employees",
    providers: "Providers",
    estimated_revenue: "Estimated Revenue",
    flags: "Flags",
    headline: "Headline",
  }
  exportToCsv(
    rows as Record<string, unknown>[],
    columns,
    headerMap,
    `warroom-${lens}-${new Date().toISOString().slice(0, 10)}.csv`
  )
}

export function TargetList({
  targets,
  lens,
  selectedNpi,
  onSelect,
  pinnedNpis,
  onPin,
  onUnpin,
  intelAvailable,
  reviewedNpis,
  onMarkReviewed,
  onUnmarkReviewed,
  className,
}: TargetListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tierFilter, setTierFilter] = useState<TierFilter>("all")
  const [intelOnly, setIntelOnly] = useState(false)
  const [hideReviewed, setHideReviewed] = useState(false)

  const tierCounts = useMemo(() => {
    const counts: Record<RankedTarget["tier"], number> = {
      hot: 0,
      warm: 0,
      cool: 0,
      cold: 0,
    }
    targets.forEach((target) => {
      counts[target.tier] += 1
    })
    return counts
  }, [targets])

  const intelCount = useMemo(() => {
    if (!intelAvailable || intelAvailable.size === 0) return 0
    return targets.reduce((acc, target) => acc + (intelAvailable.has(target.npi) ? 1 : 0), 0)
  }, [targets, intelAvailable])

  const reviewedCount = useMemo(() => {
    if (!reviewedNpis || reviewedNpis.size === 0) return 0
    return targets.reduce((acc, target) => acc + (reviewedNpis.has(target.npi) ? 1 : 0), 0)
  }, [targets, reviewedNpis])

  const filtered = useMemo(() => {
    let out = targets
    if (tierFilter !== "all") out = out.filter((target) => target.tier === tierFilter)
    if (intelOnly && intelAvailable) out = out.filter((target) => intelAvailable.has(target.npi))
    if (hideReviewed && reviewedNpis) out = out.filter((target) => !reviewedNpis.has(target.npi))
    return out
  }, [targets, tierFilter, intelOnly, intelAvailable, hideReviewed, reviewedNpis])

  const toggleExpanded = (npi: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(npi)) next.delete(npi)
      else next.add(npi)
      return next
    })
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]",
        className
      )}
      aria-label="Ranked target list"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">
            Ranked Targets
            <span className="ml-2 rounded-md bg-[#F7F7F4] px-1.5 py-0.5 text-[11px] font-medium text-[#6B6B60]">
              {getWarroomLensLabel(lens)}
            </span>
          </h2>
          <p className="text-xs text-[#707064]">
            {targets.length} ranked · top score {targets[0]?.score ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-0.5">
            {(["all", "hot", "warm", "cool", "cold"] as const).map((tier) => {
              const active = tierFilter === tier
              const count = tier === "all" ? targets.length : tierCounts[tier]
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={cn(
                    "h-7 rounded px-2 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                    active
                      ? "bg-[#B8860B] text-white"
                      : "text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                  )}
                >
                  {tier} · {count}
                </button>
              )
            })}
          </div>
          {intelAvailable && intelCount > 0 && (
            <button
              type="button"
              onClick={() => setIntelOnly((prev) => !prev)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors",
                intelOnly
                  ? "border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#7C3AED]"
                  : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
              )}
              aria-pressed={intelOnly}
              title="Show only practices with AI dossiers"
            >
              <Sparkles className="h-3 w-3" />
              Intel · {intelCount}
            </button>
          )}
          {reviewedNpis && reviewedCount > 0 && (
            <button
              type="button"
              onClick={() => setHideReviewed((prev) => !prev)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors",
                hideReviewed
                  ? "border-[#2D8B4E]/40 bg-[#2D8B4E]/10 text-[#2D8B4E]"
                  : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
              )}
              aria-pressed={hideReviewed}
              title="Hide practices already reviewed"
            >
              <CheckCircle2 className="h-3 w-3" />
              {hideReviewed ? `Hidden · ${reviewedCount}` : `Reviewed · ${reviewedCount}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => exportRankedCsv(targets, lens)}
            disabled={targets.length === 0}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 text-[11px] font-medium text-[#6B6B60] transition-colors hover:bg-[#F7F7F4] hover:text-[#1A1A1A] disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </header>

      <div className="max-h-[720px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#6B6B60]">
            No targets match this tier yet.
          </div>
        ) : (
          <ol className="divide-y divide-[#E8E5DE]">
            {filtered.map((target) => {
              const tier = TIER_STYLES[target.tier]
              const isExpanded = expanded.has(target.npi)
              const isSelected = selectedNpi === target.npi
              const isPinned = pinnedNpis?.has(target.npi) ?? false
              const hasIntel = intelAvailable?.has(target.npi) ?? false
              const isReviewed = reviewedNpis?.has(target.npi) ?? false
              const TierIcon = tier.icon
              return (
                <li
                  key={target.npi}
                  className={cn(
                    "group px-4 py-3 transition-colors",
                    isSelected ? "bg-[#B8860B]/5" : isReviewed ? "bg-[#FAFAF7]/60" : "hover:bg-[#FAFAF7]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
                      onClick={() => toggleExpanded(target.npi)}
                      className="mt-0.5 text-[#707064] hover:text-[#1A1A1A]"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="min-w-[36px] text-center">
                        <p className="font-mono text-xs font-semibold text-[#6B6B60]">
                          #{target.rank}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelect(target.npi)}
                            className="truncate text-left text-sm font-semibold text-[#1A1A1A] hover:text-[#B8860B]"
                          >
                            {target.practiceName}
                          </button>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              tier.bg,
                              tier.text,
                              tier.border
                            )}
                          >
                            <TierIcon className="h-3 w-3" />
                            {tier.label}
                          </span>
                          {hasIntel && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7C3AED]"
                              title="AI dossier available"
                            >
                              <Sparkles className="h-3 w-3" />
                              Intel
                            </span>
                          )}
                          {isReviewed && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-[#2D8B4E]/30 bg-[#2D8B4E]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#2D8B4E]"
                              title="You reviewed this target"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Reviewed
                            </span>
                          )}
                          <span className="text-[11px] text-[#707064]">
                            {target.ownershipGroup} · {target.entityClassification ?? "—"}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6B6B60]">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {target.city ?? "—"}
                            {target.zip ? ` · ${target.zip}` : ""}
                          </span>
                          {target.yearEstablished && (
                            <span>est. {target.yearEstablished}</span>
                          )}
                          {target.employeeCount != null && (
                            <span>{formatNumber(target.employeeCount)} staff</span>
                          )}
                          {target.estimatedRevenue != null && (
                            <span>{formatCurrency(target.estimatedRevenue)}</span>
                          )}
                        </div>

                        {target.flags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {target.flags.slice(0, 6).map((flag) => (
                              <span
                                key={flag}
                                className="rounded-full bg-[#F7F7F4] px-1.5 py-0.5 text-[10px] text-[#6B6B60]"
                              >
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                            {target.flags.length > 6 && (
                              <span className="rounded-full bg-[#F7F7F4] px-1.5 py-0.5 text-[10px] text-[#707064]">
                                +{target.flags.length - 6} more
                              </span>
                            )}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-3 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                            <ScoreBreakdown components={target.components} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-[#B8860B]" />
                        <span className="font-mono text-base font-bold text-[#1A1A1A]">
                          {target.score}
                        </span>
                        <span className="text-[10px] text-[#707064]">/100</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelect(target.npi)}
                          className="inline-flex h-7 items-center rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 text-[11px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F4]"
                        >
                          Open
                        </button>
                        {(onPin || onUnpin) && (
                          <button
                            type="button"
                            aria-label={isPinned ? "Unpin target" : "Pin target"}
                            onClick={() => (isPinned ? onUnpin?.(target.npi) : onPin?.(target.npi))}
                            className={cn(
                              "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium",
                              isPinned
                                ? "border-[#B8860B]/40 bg-[#B8860B]/10 text-[#B8860B]"
                                : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4]"
                            )}
                          >
                            {isPinned ? (
                              <Star className="h-3 w-3" fill="currentColor" />
                            ) : (
                              <Pin className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        {(onMarkReviewed || onUnmarkReviewed) && (
                          <button
                            type="button"
                            aria-label={isReviewed ? "Mark as not reviewed" : "Mark reviewed"}
                            onClick={() =>
                              isReviewed ? onUnmarkReviewed?.(target.npi) : onMarkReviewed?.(target.npi)
                            }
                            className={cn(
                              "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium",
                              isReviewed
                                ? "border-[#2D8B4E]/40 bg-[#2D8B4E]/10 text-[#2D8B4E]"
                                : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4]"
                            )}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
