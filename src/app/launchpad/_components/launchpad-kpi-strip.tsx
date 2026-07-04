"use client"

import {
  BadgeCheck,
  Brain,
  Building2,
  ListChecks,
  Microscope,
  Sparkles,
} from "lucide-react"
import { KpiCard } from "@/components/data-display/kpi-card"
import {
  LAUNCHPAD_LANE_COLORS,
  LAUNCHPAD_LANE_LABELS,
  type LaunchpadBundle,
} from "@/lib/launchpad/signals"

interface LaunchpadKpiStripProps {
  bundle: LaunchpadBundle | null
  className?: string
}

export function LaunchpadKpiStrip({ bundle, className }: LaunchpadKpiStripProps) {
  const summary = bundle?.summary ?? null

  const intelCoveragePct = bundle?.dataHealth?.intelCoveragePct ?? null

  // Intel coverage count
  const withIntelCount = bundle?.rankedTargets
    ? bundle.rankedTargets.filter((t) => t.intel != null).length
    : null
  const totalCount = bundle?.rankedTargets ? bundle.rankedTargets.length : null

  const intelValue =
    withIntelCount != null && totalCount != null
      ? `${withIntelCount} / ${totalCount}`
      : "--"

  const intelPct =
    withIntelCount != null && totalCount != null && totalCount > 0
      ? ((withIntelCount / totalCount) * 100).toFixed(0)
      : null

  return (
    <div className={className}>
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        role="list"
        aria-label="Launchpad key performance indicators"
      >
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="GP clinics in scope"
          value={
            summary && summary.totalGpLocations != null
              ? summary.totalGpLocations.toLocaleString()
              : summary
                ? summary.totalPracticesInScope.toLocaleString()
                : "--"
          }
          subtitle={
            summary && summary.totalGpLocations != null ? (
              <span className="text-[11px] text-[#6B6B60]">
                {summary.totalPracticesInScope.toLocaleString()} NPI rows
              </span>
            ) : (
              <span className="text-[11px] text-[#9C9C90]">
                Location dedup unavailable
              </span>
            )
          }
          tooltip="Location-deduped GP clinic count (sum of zip_scores.total_gp_locations across the scope's ZIPs). Subtitle shows the raw NPPES NPI row count, which is ~2.7× larger because NPPES emits one row per provider AND one per organization at the same address."
          accentColor="#B8860B"
        />

        <KpiCard
          icon={<BadgeCheck className="h-4 w-4" />}
          label={LAUNCHPAD_LANE_LABELS.verified_target}
          value={summary ? summary.laneCounts.verified_target.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              Census-reviewed + accepted intel
            </span>
          }
          tooltip="Practices whose ownership is a census-reviewed conclusion AND that carry accepted source-backed practice intel. The only lane with uncapped scores — every ownership claim here has been human-reviewed with evidence."
          accentColor={LAUNCHPAD_LANE_COLORS.verified_target}
        />

        <KpiCard
          icon={<Sparkles className="h-4 w-4" />}
          label={LAUNCHPAD_LANE_LABELS.promising_lead}
          value={summary ? summary.laneCounts.promising_lead.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              Census-reviewed · scores ≤ 70
            </span>
          }
          tooltip="Ownership is census-reviewed but practice-level intel is thin or unverified. Scores are capped at 70 until source-backed intel is accepted."
          accentColor={LAUNCHPAD_LANE_COLORS.promising_lead}
        />

        <KpiCard
          icon={<Microscope className="h-4 w-4" />}
          label={LAUNCHPAD_LANE_LABELS.needs_research}
          value={summary ? summary.laneCounts.needs_research.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              Census pending · scores ≤ 60
            </span>
          }
          tooltip="Ownership is not a census conclusion yet — unreviewed, undetermined, or held for evidence. Scores are capped at 60 until the ownership census reviews these locations. This lane is never hidden: it is the honest size of what we don't know yet."
          accentColor={LAUNCHPAD_LANE_COLORS.needs_research}
        />

        <KpiCard
          icon={<ListChecks className="h-4 w-4" />}
          label="Census coverage"
          value={summary ? `${summary.censusReviewedPct.toFixed(0)}%` : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              of scope rows ownership-reviewed
            </span>
          }
          tooltip="Share of practice rows in this scope whose ownership_tier is a census-reviewed conclusion (evidence-backed human review). Everything else is unreviewed, undetermined, or held — never assumed."
          accentColor="#2563EB"
        />

        <KpiCard
          icon={<Brain className="h-4 w-4" />}
          label="Evidence coverage"
          value={intelValue}
          subtitle={
            intelPct != null ? (
              <span className="text-[11px] text-[#6B6B60]">{intelPct}% of ranked targets</span>
            ) : (
              <span className="text-[11px] text-[#9C9C90]">No source-backed intel</span>
            )
          }
          tooltip={
            withIntelCount === 0
              ? "0% source-backed evidence coverage — no practice can reach the verified-target lane. Run the weekly research pipeline to populate verified dossiers."
              : "Practices with source-backed practice_intel attached. Rejected raw rows do not lift scores or populate thesis claims."
          }
          accentColor="#7C3AED"
        />
      </div>

      {intelCoveragePct !== null && intelCoveragePct < 10 && (
        <div className="mt-2 rounded-md border border-[#D4920B]/30 bg-[#D4920B]/5 px-3 py-2 text-xs text-[#6B6B60]">
          Source-backed intel coverage thin ({intelCoveragePct.toFixed(0)}%) — most
          census-reviewed practices sit in the promising-leads lane (scores ≤ 70)
        </div>
      )}
    </div>
  )
}
