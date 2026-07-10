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

  // The clinic-location denominator: one row per physical office.
  // zip_scores sum when available, else the fetched location-row count.
  const clinicLocations = summary
    ? summary.totalGpLocations ?? summary.totalPracticesInScope
    : null

  const ownershipReviewed = summary?.censusReviewedCount ?? null
  const jobHuntVerified = summary?.jobHuntVerifiedCount ?? null

  const ownershipPct =
    ownershipReviewed != null && clinicLocations != null && clinicLocations > 0
      ? ((ownershipReviewed / clinicLocations) * 100).toFixed(0)
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
          label="Clinic locations"
          value={clinicLocations != null ? clinicLocations.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              one row per physical office
            </span>
          }
          tooltip="Physical clinic locations in this scope — dentist and organization registry rows at the same address are collapsed into one office. This is the denominator every coverage number below is measured against."
          accentColor="#B8860B"
        />

        <KpiCard
          icon={<ListChecks className="h-4 w-4" />}
          label="Ownership reviewed"
          value={
            summary && clinicLocations != null
              ? `${summary.censusReviewedCount.toLocaleString()} / ${clinicLocations.toLocaleString()}`
              : "--"
          }
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              {ownershipPct != null
                ? `${ownershipPct}% have an ownership answer`
                : "who controls the office"}
            </span>
          }
          tooltip="Offices where a human reviewed evidence and concluded who likely controls the practice (independent dentist, dentist-owned group, DSO/PE, etc.). The rest are still waiting for an answer — never assumed."
          accentColor="#2563EB"
        />

        <KpiCard
          icon={<Brain className="h-4 w-4" />}
          label="Job-hunt verified"
          value={
            jobHuntVerified != null && clinicLocations != null
              ? `${jobHuntVerified.toLocaleString()} / ${clinicLocations.toLocaleString()}`
              : "--"
          }
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              website-checked GP offices
            </span>
          }
          tooltip="Offices where we checked the practice's own website for current doctors, owner/operator statement, hiring, and contact facts. This is an extra verification layer on top of the ownership review — a small count here does NOT mean the other offices aren't real."
          accentColor="#7C3AED"
        />

        <KpiCard
          icon={<BadgeCheck className="h-4 w-4" />}
          label={LAUNCHPAD_LANE_LABELS.verified_target}
          value={summary ? summary.laneCounts.verified_target.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              ownership reviewed + website checked
            </span>
          }
          tooltip="Offices where we know who controls the practice AND the practice's own website was checked for current doctors, hiring, and contact facts. Older AI dossiers do not count — only the website-check layer opens this lane."
          accentColor={LAUNCHPAD_LANE_COLORS.verified_target}
        />

        <KpiCard
          icon={<Sparkles className="h-4 w-4" />}
          label={LAUNCHPAD_LANE_LABELS.promising_lead}
          value={summary ? summary.laneCounts.promising_lead.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              job details missing · scores ≤ 60
            </span>
          }
          tooltip="We know who controls the office, but current doctors / website / hiring / contact facts still need checking. Scores are capped at 60 until those job details are verified."
          accentColor={LAUNCHPAD_LANE_COLORS.promising_lead}
        />

        <KpiCard
          icon={<Microscope className="h-4 w-4" />}
          label={LAUNCHPAD_LANE_LABELS.needs_research}
          value={summary ? summary.laneCounts.needs_research.toLocaleString() : "--"}
          subtitle={
            <span className="text-[11px] text-[#6B6B60]">
              ownership answer missing · scores ≤ 45
            </span>
          }
          tooltip="We don't have a reviewed answer yet for who controls these offices. Scores are capped at 45 until the ownership review answers. This lane is never hidden: it is the honest size of what we don't know yet."
          accentColor={LAUNCHPAD_LANE_COLORS.needs_research}
        />
      </div>

      {jobHuntVerified != null &&
        clinicLocations != null &&
        jobHuntVerified < clinicLocations * 0.1 && (
          <div className="mt-2 rounded-md border border-[#D4920B]/30 bg-[#D4920B]/5 px-3 py-2 text-xs text-[#6B6B60]">
            Only {jobHuntVerified.toLocaleString()} of{" "}
            {clinicLocations.toLocaleString()} offices have job-hunt details
            verified so far — for everything else, treat doctors, website, and
            contact fields as unchecked unless they carry a verified label.
          </div>
        )}
    </div>
  )
}
