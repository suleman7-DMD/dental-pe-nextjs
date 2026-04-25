"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Building2,
  Compass,
  DollarSign,
  ExternalLink,
  Home,
  Info,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/utils/formatting"
import { useZipIntel } from "@/lib/hooks/use-warroom-intel"
import type { ZipQualitativeIntel } from "@/lib/types/intel"
import type {
  RankedTarget,
  WarroomChangeRecord,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "@/lib/warroom/signals"

interface ZipDossierDrawerProps {
  zipCode: string | null
  zipScore: WarroomZipScoreRecord | null
  zipSignal: WarroomZipSignalRecord | null
  rankedTargets: RankedTarget[]
  recentChanges: WarroomChangeRecord[]
  onClose: () => void
  onTargetSelect?: (npi: string) => void
  onIntentRequest?: (intentText: string) => void
}

const ZIP_FLAG_SPECS: {
  key: keyof WarroomZipSignalRecord
  label: string
  icon: typeof AlertTriangle
  color: string
  bg: string
  reasoningKey?: keyof WarroomZipSignalRecord
}[] = [
  {
    key: "ada_benchmark_gap_flag",
    label: "ADA Benchmark Gap",
    icon: AlertTriangle,
    color: "#D4920B",
    bg: "bg-[#D4920B]/10",
    reasoningKey: "ada_benchmark_reasoning",
  },
]

function StatBlock({
  label,
  value,
  subtitle,
  accent = "#B8860B",
}: {
  label: string
  value: string | number
  subtitle?: string
  accent?: string
}) {
  return (
    <div
      className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold text-[#1A1A1A]">{value}</p>
      {subtitle && <p className="mt-0.5 text-[11px] text-[#6B6B60]">{subtitle}</p>}
    </div>
  )
}

function DetailRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number | null | undefined
  hint?: string
}) {
  const empty = value == null || value === ""
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#E8E5DE]/60 py-1.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#6B6B60]">{label}</p>
        {hint && <p className="text-[10px] text-[#707064]">{hint}</p>}
      </div>
      <p
        className={cn(
          "shrink-0 font-mono text-[12px]",
          empty ? "text-[#8F8E82]" : "text-[#1A1A1A]"
        )}
      >
        {empty ? "—" : value}
      </p>
    </div>
  )
}

function formatConfidence(value: string | null): string {
  if (!value) return "—"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function intelOutlookStyle(value: string | null | undefined): {
  bg: string
  text: string
  border: string
} {
  const key = (value ?? "").toLowerCase()
  if (key.includes("strong") || key.includes("growing") || key.includes("expanding") || key.includes("positive") || key.includes("high")) {
    return {
      bg: "bg-[#2D8B4E]/10",
      text: "text-[#2D8B4E]",
      border: "border-[#2D8B4E]/30",
    }
  }
  if (key.includes("weak") || key.includes("declining") || key.includes("contracting") || key.includes("negative") || key.includes("low")) {
    return {
      bg: "bg-[#C23B3B]/10",
      text: "text-[#C23B3B]",
      border: "border-[#C23B3B]/30",
    }
  }
  if (key.includes("mixed") || key.includes("moderate") || key.includes("medium") || key.includes("stable")) {
    return {
      bg: "bg-[#D4920B]/10",
      text: "text-[#D4920B]",
      border: "border-[#D4920B]/30",
    }
  }
  return {
    bg: "bg-[#E8E5DE]",
    text: "text-[#6B6B60]",
    border: "border-[#D4D0C8]",
  }
}

function intelConfidenceStyle(value: string | null | undefined): {
  bg: string
  text: string
  border: string
} {
  const key = (value ?? "").toLowerCase()
  if (key === "high") {
    return {
      bg: "bg-[#2D8B4E]/10",
      text: "text-[#2D8B4E]",
      border: "border-[#2D8B4E]/30",
    }
  }
  if (key === "medium") {
    return {
      bg: "bg-[#D4920B]/10",
      text: "text-[#D4920B]",
      border: "border-[#D4920B]/30",
    }
  }
  if (key === "low") {
    return {
      bg: "bg-[#C23B3B]/10",
      text: "text-[#C23B3B]",
      border: "border-[#C23B3B]/30",
    }
  }
  return {
    bg: "bg-[#E8E5DE]",
    text: "text-[#6B6B60]",
    border: "border-[#D4D0C8]",
  }
}

function ZipIntelSection({
  intel,
  loading,
  error,
}: {
  intel: ZipQualitativeIntel | null
  loading: boolean
  error: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <div className="h-12 animate-pulse rounded-md border border-[#E8E5DE] bg-[#FAFAF7]" />
        <div className="h-32 animate-pulse rounded-md border border-[#E8E5DE] bg-[#FAFAF7]" />
        <div className="h-24 animate-pulse rounded-md border border-[#E8E5DE] bg-[#FAFAF7]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-6 text-center">
        <AlertTriangle className="mx-auto h-5 w-5 text-[#C23B3B]" />
        <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
          Intel lookup failed
        </p>
        <p className="mt-1 text-xs text-[#6B6B60]">
          Couldn&apos;t reach the intel store — try refreshing this drawer.
        </p>
      </div>
    )
  }

  if (!intel) {
    return (
      <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] px-4 py-10 text-center">
        <BookOpen className="mx-auto h-5 w-5 text-[#B8860B]" />
        <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
          No qualitative ZIP report yet
        </p>
        <p className="mt-1 text-xs text-[#6B6B60]">
          This ZIP hasn&apos;t been run through the AI market scout.
          Trigger via{" "}
          <code className="rounded bg-[#FFFFFF] px-1 py-0.5 text-[10px] text-[#1A1A1A]">
            qualitative_scout.py --zip
          </code>{" "}
          to populate this tab.
        </p>
      </div>
    )
  }

  const demandStyle = intelOutlookStyle(intel.demand_outlook)
  const supplyStyle = intelOutlookStyle(intel.supply_outlook)
  const confidenceStyleObj = intelConfidenceStyle(intel.confidence)

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-2 text-[11px] text-[#6B6B60]">
        <BookOpen className="h-3.5 w-3.5 text-[#B8860B]" />
        <span className="font-mono text-[#1A1A1A]">
          {formatDate(intel.research_date) || "—"}
        </span>
        {intel.confidence && (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              confidenceStyleObj.bg,
              confidenceStyleObj.text,
              confidenceStyleObj.border
            )}
          >
            {intel.confidence} confidence
          </span>
        )}
        {intel.research_method && (
          <span className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
            {intel.research_method}
          </span>
        )}
      </section>

      {intel.investment_thesis && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Investment Thesis
          </h3>
          <p className="mt-2 whitespace-pre-wrap rounded-md border-l-2 border-[#B8860B] bg-[#FAFAF7] p-3 text-[12px] leading-relaxed text-[#1A1A1A]">
            {intel.investment_thesis}
          </p>
        </section>
      )}

      {(intel.demand_outlook || intel.supply_outlook) && (
        <section className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {intel.demand_outlook && (
            <div
              className={cn(
                "rounded-md border p-3",
                demandStyle.border,
                demandStyle.bg
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider",
                  demandStyle.text
                )}
              >
                <TrendingUp className="h-3 w-3" />
                Demand outlook
              </p>
              <p className="mt-1 text-[12px] font-medium text-[#1A1A1A]">
                {intel.demand_outlook}
              </p>
            </div>
          )}
          {intel.supply_outlook && (
            <div
              className={cn(
                "rounded-md border p-3",
                supplyStyle.border,
                supplyStyle.bg
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider",
                  supplyStyle.text
                )}
              >
                <Building2 className="h-3 w-3" />
                Supply outlook
              </p>
              <p className="mt-1 text-[12px] font-medium text-[#1A1A1A]">
                {intel.supply_outlook}
              </p>
            </div>
          )}
        </section>
      )}

      {(intel.dental_new_offices ||
        intel.dental_dso_moves ||
        intel.dental_note ||
        intel.competitor_new ||
        intel.competitor_closures ||
        intel.competitor_note) && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Dental Activity
          </h3>
          <div className="mt-2 space-y-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 text-[12px]">
            {intel.dental_new_offices && (
              <DetailRow label="New offices" value={intel.dental_new_offices} />
            )}
            {intel.dental_dso_moves && (
              <DetailRow label="DSO moves" value={intel.dental_dso_moves} />
            )}
            {intel.competitor_new && (
              <DetailRow label="New competitors" value={intel.competitor_new} />
            )}
            {intel.competitor_closures && (
              <DetailRow label="Closures" value={intel.competitor_closures} />
            )}
            {intel.competitor_note && (
              <p className="pt-1 text-[11px] italic leading-snug text-[#6B6B60]">
                {intel.competitor_note}
              </p>
            )}
            {intel.dental_note && (
              <p className="pt-1 text-[11px] italic leading-snug text-[#6B6B60]">
                {intel.dental_note}
              </p>
            )}
          </div>
        </section>
      )}

      {(intel.housing_summary ||
        intel.housing_status ||
        intel.median_home_price != null ||
        intel.home_price_trend ||
        intel.pop_growth_signals ||
        intel.commercial_status) && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Demographics &amp; Real Estate
          </h3>
          <div className="mt-2 space-y-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 text-[12px]">
            {intel.housing_summary && (
              <p className="flex items-start gap-1.5 text-[#1A1A1A]">
                <Home className="mt-0.5 h-3 w-3 shrink-0 text-[#707064]" />
                <span>{intel.housing_summary}</span>
              </p>
            )}
            {intel.median_home_price != null && (
              <DetailRow
                label="Median home price"
                value={formatCurrency(intel.median_home_price)}
                hint={
                  intel.home_price_yoy_pct != null
                    ? `${intel.home_price_yoy_pct >= 0 ? "+" : ""}${formatNumber(intel.home_price_yoy_pct)}% YoY`
                    : intel.home_price_trend ?? undefined
                }
              />
            )}
            {intel.pop_growth_signals && (
              <DetailRow label="Population growth" value={intel.pop_growth_signals} />
            )}
            {intel.commercial_status && (
              <DetailRow label="Commercial development" value={intel.commercial_status} />
            )}
            {intel.major_employers && (
              <DetailRow label="Major employers" value={intel.major_employers} />
            )}
          </div>
        </section>
      )}

      {(intel.school_district || intel.school_rating) && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Schools
          </h3>
          <div className="mt-2 space-y-1 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 text-[12px]">
            {intel.school_district && (
              <DetailRow label="District" value={intel.school_district} />
            )}
            {intel.school_rating && (
              <DetailRow label="Rating" value={intel.school_rating} />
            )}
            {intel.school_note && (
              <p className="pt-1 text-[11px] italic leading-snug text-[#6B6B60]">
                {intel.school_note}
              </p>
            )}
          </div>
        </section>
      )}

      {(intel.model_used || intel.cost_usd != null) && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#E8E5DE] pt-3 text-[10px] uppercase tracking-wider text-[#9C9C90]">
          {intel.model_used && <span>Model: {intel.model_used}</span>}
          {intel.cost_usd != null && (
            <span className="inline-flex items-center gap-1">
              <DollarSign className="h-2.5 w-2.5" />
              {intel.cost_usd.toFixed(3)}
            </span>
          )}
        </footer>
      )}
    </div>
  )
}

export function ZipDossierDrawer({
  zipCode,
  zipScore,
  zipSignal,
  rankedTargets,
  recentChanges,
  onClose,
  onTargetSelect,
  onIntentRequest,
}: ZipDossierDrawerProps) {
  const isOpen = zipCode != null

  const {
    data: zipIntel,
    isLoading: zipIntelLoading,
    isError: zipIntelError,
  } = useZipIntel(zipCode)

  const activeFlags = useMemo(() => {
    if (!zipSignal) return []
    return ZIP_FLAG_SPECS.filter((spec) => Boolean(zipSignal[spec.key])).map((spec) => ({
      spec,
      reasoning: spec.reasoningKey ? (zipSignal[spec.reasoningKey] as string | null) ?? null : null,
    }))
  }, [zipSignal])

  const zipTargets = useMemo(
    () => rankedTargets.filter((target) => target.zip === zipCode).slice(0, 15),
    [rankedTargets, zipCode]
  )

  const zipChanges = useMemo(
    () => recentChanges.filter((change) => change.zip === zipCode).slice(0, 10),
    [recentChanges, zipCode]
  )

  if (!zipCode) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent className="border-[#E8E5DE] bg-[#FFFFFF]" />
      </Sheet>
    )
  }

  const city = zipScore?.city ?? null
  const state = zipScore?.state ?? null
  const metro = zipScore?.metro_area ?? null
  const population = zipSignal?.population ?? null
  const locationLine = [city, state].filter(Boolean).join(", ") || "Unknown"
  const gpLocations = zipScore?.total_gp_locations ?? null
  const corporateSharePct = zipScore?.corporate_share_pct ?? null
  const buyableRatio = zipScore?.buyable_practice_ratio ?? null
  const density = zipScore?.dld_gp_per_10k ?? null
  const opportunityScore = zipScore?.opportunity_score ?? null
  const confidenceLabel = formatConfidence(zipScore?.metrics_confidence ?? null)
  const marketType = zipScore?.market_type ?? null
  const marketTypeConfidence = formatConfidence(zipScore?.market_type_confidence ?? null)

  const similarIntent = `similar ${marketType ?? "market"} ZIPs near ${zipCode}`.trim()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-[640px]"
      >
        <SheetHeader className="space-y-3 border-b border-[#E8E5DE] bg-[#FAFAF7] p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B6B60]">
            <span className="rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-0.5 font-mono font-semibold text-[#B8860B]">
              ZIP {zipCode}
            </span>
            {metro && (
              <span className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-0.5">
                {metro}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-0.5">
              <Info className="h-3 w-3 text-[#707064]" />
              Metrics confidence: {confidenceLabel}
            </span>
          </div>
          <div>
            <SheetTitle className="text-xl font-bold text-[#1A1A1A]">
              {locationLine}
            </SheetTitle>
            <SheetDescription className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B6B60]">
              <MapPin className="h-3.5 w-3.5 text-[#707064]" aria-hidden="true" />
              <span>
                ZIP {zipCode} dossier —{" "}
                {gpLocations != null
                  ? `${formatNumber(gpLocations)} GP locations`
                  : "GP count unavailable"}
                {population != null
                  ? ` · ${formatNumber(population)} residents`
                  : ""}
              </span>
            </SheetDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {onIntentRequest && (
              <button
                type="button"
                onClick={() => onIntentRequest(similarIntent)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/10 px-3 text-[12px] font-medium text-[#B8860B] transition-colors hover:bg-[#B8860B]/20"
              >
                <Search className="h-3.5 w-3.5" />
                Find similar ZIPs
              </button>
            )}
            <Link
              href={`/market-intel?zip=${zipCode}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F7F7F4]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#6B6B60]" />
              Open in Market Intel
            </Link>
          </div>
        </SheetHeader>

        <Tabs defaultValue="snapshot" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-11 shrink-0 rounded-none border-b border-[#E8E5DE] bg-[#FAFAF7] px-5">
            <TabsTrigger value="snapshot" className="text-[13px]">
              Snapshot
            </TabsTrigger>
            <TabsTrigger value="signals" className="text-[13px]">
              Signals
              {activeFlags.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#B8860B]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#B8860B]">
                  {activeFlags.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="targets" className="text-[13px]">
              Targets
              {zipTargets.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#2D8B4E]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#2D8B4E]">
                  {zipTargets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="intel" className="text-[13px]">
              Intel
              {zipIntel && (
                <span className="ml-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#B8860B]/15">
                  <Sparkles className="h-2.5 w-2.5 text-[#B8860B]" />
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="evidence" className="text-[13px]">
              Evidence
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <TabsContent value="snapshot" className="m-0 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <StatBlock
                  label="Corporate share"
                  value={corporateSharePct != null ? formatPercent(corporateSharePct) : "—"}
                  subtitle="dso_regional + dso_national"
                  accent="#C23B3B"
                />
                <StatBlock
                  label="Buyable ratio"
                  value={buyableRatio != null ? formatPercent(buyableRatio) : "—"}
                  subtitle="Solo + inactive targets"
                  accent="#2D8B4E"
                />
                <StatBlock
                  label="Density"
                  value={density != null ? formatNumber(density) : "—"}
                  subtitle="GP offices / 10k residents"
                  accent="#2563EB"
                />
                <StatBlock
                  label="Opportunity"
                  value={opportunityScore != null ? `${formatNumber(opportunityScore)}/100` : "—"}
                  subtitle="Composite ZIP score"
                  accent="#B8860B"
                />
              </div>

              {marketType && (
                <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
                    Market type
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1A1A1A]">
                    {marketType.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B6B60]">
                    {marketTypeConfidence} confidence
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <StatBlock
                  label="Independent"
                  value={
                    zipScore?.independent_count != null
                      ? formatNumber(zipScore.independent_count)
                      : "—"
                  }
                  subtitle={
                    zipScore?.independent_pct_of_total != null
                      ? formatPercent(zipScore.independent_pct_of_total)
                      : undefined
                  }
                  accent="#2563EB"
                />
                <StatBlock
                  label="Known consolidated"
                  value={
                    zipScore?.consolidated_count != null
                      ? formatNumber(zipScore.consolidated_count)
                      : "—"
                  }
                  subtitle={
                    zipScore?.consolidation_pct_of_total != null
                      ? formatPercent(zipScore.consolidation_pct_of_total)
                      : undefined
                  }
                  accent="#C23B3B"
                />
                <StatBlock
                  label="High-confidence corp."
                  value={
                    zipScore?.corporate_highconf_count != null
                      ? formatNumber(zipScore.corporate_highconf_count)
                      : "—"
                  }
                  subtitle="Real DSO brands + strong signals"
                  accent="#9C7324"
                />
                <StatBlock
                  label="Unknown"
                  value={
                    zipScore?.unknown_count != null
                      ? formatNumber(zipScore.unknown_count)
                      : "—"
                  }
                  subtitle={
                    zipScore?.pct_unknown != null
                      ? formatPercent(zipScore.pct_unknown)
                      : undefined
                  }
                  accent="#9C9C90"
                />
              </div>
            </TabsContent>

            <TabsContent value="signals" className="m-0 space-y-4">
              {activeFlags.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-5 text-center">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    No ZIP-level flags active
                  </p>
                  <p className="mt-1 text-[11px] text-[#6B6B60]">
                    Compound demand / mirror / white-space / contested / ADA gap.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeFlags.map(({ spec, reasoning }) => {
                    const Icon = spec.icon
                    return (
                      <div
                        key={String(spec.key)}
                        className={cn(
                          "rounded-md border border-[#E8E5DE] p-3",
                          spec.bg
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: spec.color }} />
                          <p className="text-sm font-semibold" style={{ color: spec.color }}>
                            {spec.label}
                          </p>
                        </div>
                        {reasoning && (
                          <p className="mt-1.5 text-[12px] leading-relaxed text-[#1A1A1A]">
                            {reasoning}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="space-y-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Practice-level signal counts
                </p>
                <DetailRow
                  label="Stealth DSO practices"
                  value={
                    zipSignal?.stealth_dso_practice_count != null
                      ? formatNumber(zipSignal.stealth_dso_practice_count)
                      : null
                  }
                  hint={`${formatNumber(zipSignal?.stealth_dso_cluster_count ?? 0)} clusters`}
                />
                <DetailRow
                  label="Phantom inventory"
                  value={
                    zipSignal?.phantom_inventory_count != null
                      ? formatNumber(zipSignal.phantom_inventory_count)
                      : null
                  }
                  hint={
                    zipSignal?.phantom_inventory_pct != null
                      ? `${formatPercent(zipSignal.phantom_inventory_pct)} of GP`
                      : undefined
                  }
                />
                <DetailRow
                  label="Family dynasty"
                  value={
                    zipSignal?.family_dynasty_count != null
                      ? formatNumber(zipSignal.family_dynasty_count)
                      : null
                  }
                />
                <DetailRow
                  label="Retirement combo (high)"
                  value={
                    zipSignal?.retirement_combo_high_count != null
                      ? formatNumber(zipSignal.retirement_combo_high_count)
                      : null
                  }
                />
                <DetailRow
                  label="Recent changes (90d)"
                  value={
                    zipSignal?.last_change_90d_count != null
                      ? formatNumber(zipSignal.last_change_90d_count)
                      : null
                  }
                />
                <DetailRow
                  label="Deals (24mo catchment)"
                  value={
                    zipSignal?.deal_catchment_sum_24mo != null
                      ? formatNumber(zipSignal.deal_catchment_sum_24mo)
                      : null
                  }
                  hint={
                    zipSignal?.deal_catchment_max_24mo != null
                      ? `Peak ${formatNumber(zipSignal.deal_catchment_max_24mo)} within nearby ZIPs`
                      : undefined
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="targets" className="m-0 space-y-3">
              {zipTargets.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-5 text-center">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    No ranked targets in this ZIP
                  </p>
                  <p className="mt-1 text-[11px] text-[#6B6B60]">
                    Adjust filters or try a different lens.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {zipTargets.map((target) => (
                    <li key={target.npi}>
                      <button
                        type="button"
                        onClick={() => onTargetSelect?.(target.npi)}
                        className="group flex w-full items-center gap-3 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2 text-left transition-colors hover:border-[#B8860B]/40 hover:bg-[#B8860B]/5"
                      >
                        <span className="font-mono text-[11px] text-[#B8860B]">
                          #{target.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                            {target.practiceName}
                          </p>
                          <p className="flex items-center gap-1.5 text-[11px] text-[#6B6B60]">
                            <Building2 className="h-3 w-3" />
                            {target.entityClassification ?? "unclassified"}
                            {target.buyabilityScore != null && (
                              <span className="ml-1 font-mono">
                                · buy {target.buyabilityScore}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#E8E5DE] bg-[#FAFAF7] px-2 py-0.5 font-mono text-[11px] text-[#1A1A1A]">
                          {target.score}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#707064] transition-colors group-hover:text-[#B8860B]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {zipChanges.length > 0 && (
                <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                    <Compass className="h-3.5 w-3.5" />
                    Recent changes in ZIP ({zipChanges.length})
                  </p>
                  <ul className="mt-2 space-y-1">
                    {zipChanges.map((change) => (
                      <li key={change.id} className="text-[11px] text-[#6B6B60]">
                        <span className="font-mono text-[10px] text-[#707064]">
                          {change.change_date ?? "—"}
                        </span>{" "}
                        <span className="font-medium text-[#1A1A1A]">
                          {change.practice_name ?? "Practice"}
                        </span>{" "}
                        <span className="text-[#707064]">
                          ({change.field_changed ?? change.change_type ?? "change"})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="intel" className="m-0">
              <ZipIntelSection
                intel={zipIntel ?? null}
                loading={zipIntelLoading}
                error={zipIntelError}
              />
            </TabsContent>

            <TabsContent value="evidence" className="m-0 space-y-4">
              <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                  <Users className="h-3.5 w-3.5" />
                  Supply &amp; demand
                </p>
                <DetailRow
                  label="Total practices"
                  value={
                    zipScore?.total_practices != null
                      ? formatNumber(zipScore.total_practices)
                      : null
                  }
                />
                <DetailRow
                  label="GP locations"
                  value={gpLocations != null ? formatNumber(gpLocations) : null}
                />
                <DetailRow
                  label="Specialist locations"
                  value={
                    zipScore?.total_specialist_locations != null
                      ? formatNumber(zipScore.total_specialist_locations)
                      : null
                  }
                />
                <DetailRow
                  label="People / GP door"
                  value={
                    zipScore?.people_per_gp_door != null
                      ? formatNumber(zipScore.people_per_gp_door)
                      : null
                  }
                />
                <DetailRow
                  label="Total density / 10k"
                  value={
                    zipScore?.dld_total_per_10k != null
                      ? formatNumber(zipScore.dld_total_per_10k)
                      : null
                  }
                />
                <DetailRow
                  label="State deals (12mo)"
                  value={
                    zipScore?.state_deal_count_12m != null
                      ? formatNumber(zipScore.state_deal_count_12m)
                      : null
                  }
                />
              </div>

              <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                  <Info className="h-3.5 w-3.5" />
                  Data quality
                </p>
                <DetailRow
                  label="Metrics confidence"
                  value={confidenceLabel}
                />
                <DetailRow
                  label="Market-type confidence"
                  value={marketTypeConfidence}
                />
                <DetailRow
                  label="Classification coverage"
                  value={
                    zipScore?.entity_classification_coverage_pct != null
                      ? formatPercent(zipScore.entity_classification_coverage_pct)
                      : null
                  }
                />
                <DetailRow
                  label="Data Axle enrichment"
                  value={
                    zipScore?.data_axle_enrichment_pct != null
                      ? formatPercent(zipScore.data_axle_enrichment_pct)
                      : null
                  }
                />
                <DetailRow
                  label="Score date"
                  value={zipScore?.score_date ?? null}
                />
              </div>

              {zipSignal?.data_limitations && (
                <div className="rounded-md border border-[#D4920B]/30 bg-[#D4920B]/10 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#B0780A]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Data limitations
                  </p>
                  <p className="mt-1 text-[12px] text-[#1A1A1A]">
                    {zipSignal.data_limitations}
                  </p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
