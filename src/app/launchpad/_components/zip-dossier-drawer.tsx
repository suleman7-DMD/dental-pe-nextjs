"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  DollarSign,
  ExternalLink,
  Info,
  MapPin,
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
  formatNumber,
  formatPercent,
} from "@/lib/utils/formatting"
import {
  LAUNCHPAD_TIER_LABELS,
  LAUNCHPAD_TIERS,
  type LaunchpadBundle,
  type LaunchpadRankedTarget,
  type LaunchpadTier,
} from "@/lib/launchpad/signals"
import { isZipCommutable } from "@/lib/launchpad/scope"

interface ZipDossierDrawerProps {
  zipCode: string | null
  bundle: LaunchpadBundle | null
  onClose: () => void
  onSelectNpi?: (npi: string) => void
}

const TIER_COLORS: Record<LaunchpadTier, string> = {
  best_fit: "#2D8B4E",
  strong: "#B8860B",
  maybe: "#2563EB",
  low: "#9C9C90",
  avoid: "#C23B3B",
}

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

function formatConfidence(value: string | null | undefined): string {
  if (!value) return "—"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function LaunchpadZipDossierDrawer({
  zipCode,
  bundle,
  onClose,
  onSelectNpi,
}: ZipDossierDrawerProps) {
  const isOpen = zipCode != null

  const zipScore = useMemo(() => {
    if (!zipCode || !bundle) return null
    return bundle.zipScores.find((z) => z.zip_code === zipCode) ?? null
  }, [zipCode, bundle])

  const zipTargets = useMemo(() => {
    if (!zipCode || !bundle) return [] as LaunchpadRankedTarget[]
    return bundle.rankedTargets
      .filter((target) => target.practice.zip === zipCode)
      .slice(0, 15)
  }, [zipCode, bundle])

  const tierCounts = useMemo(() => {
    const counts: Record<LaunchpadTier, number> = {
      best_fit: 0,
      strong: 0,
      maybe: 0,
      low: 0,
      avoid: 0,
    }
    if (!zipCode || !bundle) return counts
    for (const target of bundle.rankedTargets) {
      if (target.practice.zip !== zipCode) continue
      counts[target.displayTier] = (counts[target.displayTier] ?? 0) + 1
    }
    return counts
  }, [zipCode, bundle])

  const recentDealsInZip = useMemo(() => {
    if (!zipCode || !bundle) return []
    return bundle.recentDeals.filter((deal) => deal.target_zip === zipCode).slice(0, 8)
  }, [zipCode, bundle])

  const commutable = useMemo(() => {
    if (!zipCode || !bundle) return false
    return isZipCommutable(bundle.scope.id, zipCode)
  }, [zipCode, bundle])

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
  const population = zipScore?.population ?? null
  const medianIncome = zipScore?.median_household_income ?? null
  const locationLine = [city, state].filter(Boolean).join(", ") || "Unknown"
  const gpLocations = zipScore?.total_gp_locations ?? null
  const corporateSharePct = zipScore?.corporate_share_pct ?? null
  const buyableRatio = zipScore?.buyable_practice_ratio ?? null
  const density = zipScore?.dld_gp_per_10k ?? null
  const peoplePerDoor = zipScore?.people_per_gp_door ?? null
  const opportunityScore = zipScore?.opportunity_score ?? null
  const confidenceLabel = formatConfidence(zipScore?.metrics_confidence ?? null)
  const marketType = zipScore?.market_type ?? null

  const totalInZip =
    tierCounts.best_fit +
    tierCounts.strong +
    tierCounts.maybe +
    tierCounts.low +
    tierCounts.avoid

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-[620px]"
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
            {commutable && (
              <span className="rounded-full border border-[#2D8B4E]/30 bg-[#2D8B4E]/10 px-2 py-0.5 text-[#2D8B4E]">
                Commutable
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-0.5">
              <Info className="h-3 w-3 text-[#707064]" />
              Confidence: {confidenceLabel}
            </span>
          </div>
          <div>
            <SheetTitle className="text-xl font-bold text-[#1A1A1A]">
              {locationLine}
            </SheetTitle>
            <SheetDescription className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B6B60]">
              <MapPin className="h-3.5 w-3.5 text-[#707064]" aria-hidden="true" />
              <span>
                ZIP {zipCode} · {totalInZip} ranked{" "}
                {totalInZip === 1 ? "practice" : "practices"}
                {gpLocations != null
                  ? ` · ${formatNumber(gpLocations)} GP locations`
                  : ""}
              </span>
            </SheetDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/market-intel?zip=${zipCode}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F7F7F4]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#6B6B60]" />
              Market Intel
            </Link>
            <Link
              href={`/warroom?mode=sitrep&scope=chicagoland&lens=consolidation`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F7F7F4]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#6B6B60]" />
              Warroom
            </Link>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-11 shrink-0 rounded-none border-b border-[#E8E5DE] bg-[#FAFAF7] px-5">
            <TabsTrigger value="overview" className="text-[13px]">
              Overview
            </TabsTrigger>
            <TabsTrigger value="targets" className="text-[13px]">
              Top targets
              {zipTargets.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#2D8B4E]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#2D8B4E]">
                  {zipTargets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="deals" className="text-[13px]">
              PE activity
              {recentDealsInZip.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#C23B3B]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#C23B3B]">
                  {recentDealsInZip.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <TabsContent value="overview" className="m-0 space-y-4">
              {/* First-job opportunity summary */}
              <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
                  Launchpad fit mix
                </p>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {LAUNCHPAD_TIERS.map((tier) => (
                    <div
                      key={tier}
                      className="flex flex-col items-center gap-1 rounded border border-[#E8E5DE] bg-[#FFFFFF] p-1.5"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: TIER_COLORS[tier] }}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-sm font-bold text-[#1A1A1A]">
                        {tierCounts[tier]}
                      </span>
                      <span className="text-center text-[9px] leading-tight text-[#6B6B60]">
                        {LAUNCHPAD_TIER_LABELS[tier]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Saturation snapshot */}
              <div className="grid grid-cols-2 gap-2">
                <StatBlock
                  label="Density"
                  value={density != null ? formatNumber(density) : "—"}
                  subtitle="GP offices / 10k"
                  accent="#2563EB"
                />
                <StatBlock
                  label="People / GP door"
                  value={peoplePerDoor != null ? formatNumber(peoplePerDoor) : "—"}
                  subtitle="Population / GP locations"
                  accent="#0D9488"
                />
                <StatBlock
                  label="Corporate share"
                  value={
                    corporateSharePct != null ? formatPercent(corporateSharePct) : "—"
                  }
                  subtitle="dso_regional + dso_national"
                  accent="#C23B3B"
                />
                <StatBlock
                  label="Buyable ratio"
                  value={buyableRatio != null ? formatPercent(buyableRatio) : "—"}
                  subtitle="Solo + inactive targets"
                  accent="#2D8B4E"
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
                  {opportunityScore != null && (
                    <p className="mt-0.5 text-[11px] text-[#6B6B60]">
                      Opportunity score:{" "}
                      <span className="font-mono font-semibold text-[#1A1A1A]">
                        {formatNumber(opportunityScore)}/100
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Demographics */}
              <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                  <Users className="h-3.5 w-3.5" />
                  Demographics
                </p>
                <DetailRow
                  label="Population"
                  value={population != null ? formatNumber(population) : null}
                />
                <DetailRow
                  label="Median household income"
                  value={medianIncome != null ? formatCurrency(medianIncome) : null}
                />
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
              </div>

              {/* Data quality */}
              <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                  <Info className="h-3.5 w-3.5" />
                  Data quality
                </p>
                <DetailRow label="Metrics confidence" value={confidenceLabel} />
                <DetailRow label="Score date" value={zipScore?.score_date ?? null} />
              </div>
            </TabsContent>

            <TabsContent value="targets" className="m-0 space-y-3">
              {zipTargets.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-5 text-center">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    No ranked targets in this ZIP
                  </p>
                  <p className="mt-1 text-[11px] text-[#6B6B60]">
                    Try a different ZIP or adjust the track filter.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {zipTargets.map((target) => {
                    const displayName =
                      target.practice.doing_business_as ??
                      target.practice.practice_name ??
                      `NPI ${target.npi}`
                    const tierColor = TIER_COLORS[target.displayTier]
                    return (
                      <li key={target.npi}>
                        <button
                          type="button"
                          onClick={() => onSelectNpi?.(target.npi)}
                          className="group flex w-full items-center gap-3 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2 text-left transition-colors hover:border-[#B8860B]/40 hover:bg-[#B8860B]/5"
                        >
                          <span className="font-mono text-[11px] text-[#B8860B]">
                            #{target.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                              {displayName}
                            </p>
                            <p className="flex items-center gap-1.5 text-[11px] text-[#6B6B60]">
                              <Building2 className="h-3 w-3" />
                              {target.practice.entity_classification ?? "unclassified"}
                              {target.practice.buyability_score != null && (
                                <span className="ml-1 font-mono">
                                  · buy {target.practice.buyability_score}
                                </span>
                              )}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold"
                            style={{
                              borderColor: `${tierColor}40`,
                              backgroundColor: `${tierColor}1A`,
                              color: tierColor,
                            }}
                          >
                            {Math.round(target.displayScore)}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#707064] transition-colors group-hover:text-[#B8860B]" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="deals" className="m-0 space-y-3">
              {recentDealsInZip.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#E8E5DE] bg-[#FAFAF7] p-5 text-center">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    No recent PE deals in this ZIP
                  </p>
                  <p className="mt-1 text-[11px] text-[#6B6B60]">
                    Quieter ZIP — typically means less DSO churn and more stable
                    associate comp.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-[#D4920B]/30 bg-[#D4920B]/10 p-3 text-[12px] text-[#1A1A1A]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B0780A]" />
                    <p>
                      {recentDealsInZip.length}{" "}
                      {recentDealsInZip.length === 1 ? "deal" : "deals"} in the past
                      18 months — expect ownership/comp churn if these touched target
                      practices.
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {recentDealsInZip.map((deal) => (
                      <li
                        key={deal.id}
                        className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                              {deal.target_name ?? "Target unnamed"}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6B6B60]">
                              <TrendingUp className="h-3 w-3" />
                              {deal.platform_company ?? "Unknown platform"}
                              {deal.pe_sponsor ? ` · ${deal.pe_sponsor}` : ""}
                            </p>
                            {deal.target_city && (
                              <p className="mt-0.5 text-[11px] text-[#707064]">
                                {deal.target_city}
                              </p>
                            )}
                          </div>
                          {deal.deal_date && (
                            <span className="shrink-0 rounded-full bg-[#FAFAF7] px-2 py-0.5 font-mono text-[10px] text-[#707064]">
                              {deal.deal_date}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                  <DollarSign className="h-3.5 w-3.5" />
                  Why this matters for a first job
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#1A1A1A]">
                  Recent PE deals in a ZIP often signal comp disruption: new owners
                  renegotiate associate agreements, enforce non-competes, and push
                  production quotas. High PE-activity ZIPs favor structured DSO roles
                  with published tier bands; low-activity ZIPs favor succession and
                  boutique solo placements.
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
