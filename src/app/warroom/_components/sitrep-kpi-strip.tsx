"use client"

import {
  Activity,
  Building2,
  Clock,
  Crosshair,
  DollarSign,
  FileWarning,
  FlagTriangleRight,
  Handshake,
  LineChart,
  Target,
  Users,
} from "lucide-react"
import { KpiCard } from "@/components/data-display/kpi-card"
import { formatNumber, formatPercent } from "@/lib/utils/formatting"
import type { WarroomSummary } from "@/lib/warroom/signals"

interface SitrepKpiStripProps {
  summary: WarroomSummary
  className?: string
}

function countsToPct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%"
  return formatPercent((numerator / denominator) * 100)
}

export function SitrepKpiStrip({ summary, className }: SitrepKpiStripProps) {
  const {
    ownership,
    enrichedPractices,
    enrichedPct,
    acquisitionTargets,
    retirementRisk,
    dealCount,
    latestDealDate,
    changeCount90d,
    signalCounts,
    corporateHighConfidence,
    corporateHighConfidencePct,
    avgBuyabilityScore,
    avgOpportunityScore,
  } = summary

  return (
    <div
      className={`grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6 ${className ?? ""}`}
      role="list"
      aria-label="Sitrep key performance indicators"
    >
      <KpiCard
        icon={<Users className="h-4 w-4" />}
        label="Practices in Scope"
        value={formatNumber(ownership.total)}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            {formatNumber(ownership.known)} classified ({countsToPct(ownership.known, ownership.total)})
          </span>
        }
        tooltip="All practices currently loaded for the selected scope (Supabase watched-ZIP universe + any polygon draws)."
        accentColor="#B8860B"
      />

      <KpiCard
        icon={<Building2 className="h-4 w-4" />}
        label="Corporate (High-Conf)"
        value={formatNumber(corporateHighConfidence)}
        suffix={formatPercent(corporateHighConfidencePct)}
        subtitle={
          <span className="text-[11px] text-[#D4920B]">
            All signals: {countsToPct(ownership.corporate, ownership.total)}
          </span>
        }
        tooltip="High-confidence = dso_national + dso_regional with parent company/EIN/franchise + DSO-owned specialists. Secondary row shows all corporate signals including phone-only matches."
        accentColor="#C23B3B"
      />

      <KpiCard
        icon={<Target className="h-4 w-4" />}
        label="Acquisition Ready"
        value={formatNumber(acquisitionTargets)}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Buyability ≥ 50 · {countsToPct(acquisitionTargets, ownership.total)} of scope
          </span>
        }
        tooltip="Independent practices with buyability_score ≥ 50 in the selected scope."
        accentColor="#2D8B4E"
      />

      <KpiCard
        icon={<Clock className="h-4 w-4" />}
        label="Retirement Risk"
        value={formatNumber(retirementRisk)}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Pre-1995 · established independents
          </span>
        }
        tooltip="Independent practices (all 7 entity classifications) with year_established < 1995."
        accentColor="#D4920B"
      />

      <KpiCard
        icon={<Handshake className="h-4 w-4" />}
        label="PE Deals in Scope"
        value={formatNumber(dealCount)}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Latest: {latestDealDate ?? "--"}
          </span>
        }
        accentColor="#7C3AED"
      />

      <KpiCard
        icon={<Activity className="h-4 w-4" />}
        label="90d Change Events"
        value={formatNumber(changeCount90d)}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Owner/name/address mutations
          </span>
        }
        accentColor="#2563EB"
      />

      <KpiCard
        icon={<FlagTriangleRight className="h-4 w-4" />}
        label="Flagged Practices"
        value={signalCounts ? formatNumber(signalCounts.totalFlaggedPractices) : "--"}
        subtitle={
          signalCounts ? (
            <span className="text-[11px] text-[#6B6B60]">
              {countsToPct(signalCounts.totalFlaggedPractices, ownership.total)} of scope
            </span>
          ) : (
            <span className="text-[11px] text-[#8F8E82]">Signal sync pending</span>
          )
        }
        tooltip="Any practice flagged by at least one hidden-gold signal (stealth DSO, phantom inventory, retirement combo, family dynasty, micro-cluster, ADA gap, etc.)."
        accentColor="#0D9488"
      />

      <KpiCard
        icon={<Crosshair className="h-4 w-4" />}
        label="Stealth Clusters"
        value={signalCounts ? formatNumber(signalCounts.stealthDsoClusters) : "--"}
        subtitle={
          signalCounts ? (
            <span className="text-[11px] text-[#6B6B60]">
              {formatNumber(signalCounts.stealthDsoPractices)} practices
            </span>
          ) : (
            <span className="text-[11px] text-[#8F8E82]">Signal sync pending</span>
          )
        }
        tooltip="Groups of 3+ practices sharing phone/brand/EIN signals indicating an under-the-radar DSO."
        accentColor="#C23B3B"
      />

      <KpiCard
        icon={<FileWarning className="h-4 w-4" />}
        label="Phantom Inventory"
        value={signalCounts ? formatNumber(signalCounts.phantomInventoryPractices) : "--"}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Listed but missing digital footprint
          </span>
        }
        tooltip="NPPES-listed practices missing phone/website/reviews — often retired or semi-active."
        accentColor="#9C7324"
      />

      <KpiCard
        icon={<LineChart className="h-4 w-4" />}
        label="Retirement Combo"
        value={signalCounts ? formatNumber(signalCounts.retirementComboHigh) : "--"}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Age × solo × independent stack
          </span>
        }
        tooltip="Practices scoring in the top retirement-combo percentile: old, solo, and independent with high buyability."
        accentColor="#D4920B"
      />

      <KpiCard
        icon={<DollarSign className="h-4 w-4" />}
        label="Avg Buyability"
        value={avgBuyabilityScore != null ? formatNumber(avgBuyabilityScore) : "--"}
        suffix={avgBuyabilityScore != null ? "/100" : undefined}
        subtitle={
          <span className="text-[11px] text-[#6B6B60]">
            Across scoped practices
          </span>
        }
        accentColor="#2563EB"
      />

      <KpiCard
        icon={<LineChart className="h-4 w-4" />}
        label="Enriched"
        value={formatNumber(enrichedPractices)}
        suffix={formatPercent(enrichedPct)}
        subtitle={
          avgOpportunityScore != null ? (
            <span className="text-[11px] text-[#6B6B60]">
              Avg opportunity: {formatNumber(avgOpportunityScore)}/100
            </span>
          ) : (
            <span className="text-[11px] text-[#6B6B60]">
              Data Axle overlay
            </span>
          )
        }
        tooltip="Practices with data_axle_import_date populated (adds lat/lon, revenue, employees, year)."
        accentColor="#6366F1"
      />
    </div>
  )
}
