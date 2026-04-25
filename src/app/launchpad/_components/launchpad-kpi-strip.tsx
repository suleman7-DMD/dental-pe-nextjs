"use client"

import {
  Brain,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { KpiCard } from "@/components/data-display/kpi-card"
import type { LaunchpadBundle } from "@/lib/launchpad/signals"

interface LaunchpadKpiStripProps {
  bundle: LaunchpadBundle | null
  className?: string
}

export function LaunchpadKpiStrip({ bundle, className }: LaunchpadKpiStripProps) {
  const summary = bundle?.summary ?? null

  const bestFitTotal = summary
    ? summary.successionCandidates.bestFit +
      summary.highVolumeCandidates.bestFit +
      summary.dsoCandidates.bestFit
    : 0

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
          label="Practices in scope"
          value={summary ? summary.totalPracticesInScope.toLocaleString() : "--"}
          tooltip="GP + specialist + non-clinical practices in selected living location"
          accentColor="#B8860B"
        />

        <KpiCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Best-fit candidates"
          value={summary ? bestFitTotal.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">score ≥ 80 in any track</span>
          }
          tooltip="Practices scoring ≥ 80 in at least one of the three job tracks (Succession, High-volume, DSO)"
          accentColor="#B8860B"
        />

        <KpiCard
          icon={<GraduationCap className="h-4 w-4" />}
          label="Mentor-rich"
          value={summary ? summary.mentorRichCount.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">Solo, 25+ yrs, 2+ staff</span>
          }
          tooltip="Solo practitioners operating 25+ years with at least 2 support staff — classic mentorship capacity"
          accentColor="#2D8B4E"
        />

        <KpiCard
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          label="Hiring now"
          value={summary ? summary.hiringNowCount.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">AI research confirmed openings</span>
          }
          tooltip="Practices with active associate openings detected via website, Google listing, or AI research"
          accentColor="#2563EB"
        />

        <KpiCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Avoid-tier DSOs"
          value={summary ? summary.avoidListCount.toLocaleString() : "--"}
          subtitle={
            summary && summary.avoidListCount > 0 ? (
              <span className="text-[11px] text-[#C23B3B]">
                {summary.avoidListCount} on AVOID list
              </span>
            ) : (
              <span className="text-[11px] text-[#6B6B60]">Aspen, Sage, Risas, Western</span>
            )
          }
          tooltip="DSOs rated AVOID due to documented patient-harm or excessive associate churn patterns"
          accentColor="#C23B3B"
        />

        <KpiCard
          icon={<Brain className="h-4 w-4" />}
          label="Intel coverage"
          value={intelValue}
          subtitle={
            intelPct != null ? (
              <span className="text-[11px] text-[#6B6B60]">{intelPct}% of ranked targets</span>
            ) : (
              <span className="text-[11px] text-[#9C9C90]">No intel data loaded</span>
            )
          }
          tooltip={
            withIntelCount === 0
              ? "0% intel coverage — scores are capped at 70 for all practices. Run the weekly research pipeline to populate AI dossiers."
              : "Practices with an AI research dossier attached. Higher coverage → fewer confidence caps on scores."
          }
          accentColor="#7C3AED"
        />
      </div>

      {intelCoveragePct !== null && intelCoveragePct < 10 && (
        <div className="mt-2 rounded-md border border-[#D4920B]/30 bg-[#D4920B]/5 px-3 py-2 text-xs text-[#6B6B60]">
          Intel coverage thin ({intelCoveragePct.toFixed(0)}%) — scores capped at 70 for most
          practices
        </div>
      )}
    </div>
  )
}
