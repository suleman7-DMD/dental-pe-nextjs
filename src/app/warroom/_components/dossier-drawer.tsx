"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Check,
  Clock,
  Compass,
  Copy,
  Crosshair,
  ExternalLink,
  FileWarning,
  Flame,
  Gauge,
  Globe,
  Handshake,
  Info,
  Layers,
  LineChart,
  MapPin,
  Phone,
  Pin,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  ThermometerSnowflake,
  ThermometerSun,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { safeExternalUrl } from "@/lib/utils/safe-url"
import { getEntityClassificationLabel } from "@/lib/constants/entity-classifications"
import {
  filterNearbyDealsWithin,
  type NearbyDealMatch,
} from "@/lib/warroom/geo"
import type {
  RankedTarget,
  WarroomChangeRecord,
  WarroomDealRecord,
  WarroomPracticeSignalRecord,
  WarroomScoreComponent,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "@/lib/warroom/signals"

interface DossierDrawerProps {
  target: RankedTarget | null
  onClose: () => void
  onPin?: (npi: string) => void
  onUnpin?: (npi: string) => void
  isPinned?: boolean
  onIntentRequest?: (intentText: string) => void
  nearbyDeals?: WarroomDealRecord[]
  recentChanges?: WarroomChangeRecord[]
}

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

interface SignalFlagSpec {
  key: keyof WarroomPracticeSignalRecord
  label: string
  icon: typeof Sparkles
  color: string
  reasoningKey?: keyof WarroomPracticeSignalRecord
  extraKeys?: (keyof WarroomPracticeSignalRecord)[]
}

const PRACTICE_SIGNAL_SPECS: SignalFlagSpec[] = [
  {
    key: "stealth_dso_flag",
    label: "Stealth DSO Cluster",
    icon: ShieldAlert,
    color: "#C23B3B",
    reasoningKey: "stealth_dso_reasoning",
    extraKeys: ["stealth_dso_cluster_size", "stealth_dso_zip_count", "stealth_dso_basis"],
  },
  {
    key: "phantom_inventory_flag",
    label: "Phantom Inventory",
    icon: FileWarning,
    color: "#9C7324",
    reasoningKey: "phantom_inventory_reasoning",
  },
  {
    key: "revenue_default_flag",
    label: "Revenue Default",
    icon: Gauge,
    color: "#6B6B60",
    reasoningKey: "revenue_default_reasoning",
  },
  {
    key: "family_dynasty_flag",
    label: "Family Dynasty",
    icon: Users,
    color: "#D4920B",
    reasoningKey: "family_dynasty_reasoning",
  },
  {
    key: "micro_cluster_flag",
    label: "Micro Cluster",
    icon: Crosshair,
    color: "#7C3AED",
    reasoningKey: "micro_cluster_reasoning",
    extraKeys: ["micro_cluster_size"],
  },
  {
    key: "intel_quant_disagreement_flag",
    label: "Intel/Quant Disagreement",
    icon: Scale,
    color: "#2563EB",
    reasoningKey: "intel_quant_disagreement_reasoning",
    extraKeys: ["intel_quant_disagreement_type"],
  },
  {
    key: "retirement_combo_flag",
    label: "Retirement Combo",
    icon: Clock,
    color: "#D4920B",
    reasoningKey: "retirement_combo_reasoning",
    extraKeys: ["retirement_combo_score"],
  },
  {
    key: "last_change_90d_flag",
    label: "Recent Change (90d)",
    icon: Zap,
    color: "#2563EB",
    reasoningKey: "last_change_reasoning",
    extraKeys: ["last_change_date", "last_change_type"],
  },
  {
    key: "high_peer_buyability_flag",
    label: "High-Peer Buyability",
    icon: LineChart,
    color: "#2D8B4E",
    reasoningKey: "peer_percentile_reasoning",
    extraKeys: ["buyability_pctile_zip_class", "buyability_pctile_class"],
  },
  {
    key: "high_peer_retirement_flag",
    label: "High-Peer Retirement",
    icon: LineChart,
    color: "#D4920B",
    reasoningKey: "peer_percentile_reasoning",
    extraKeys: ["retirement_pctile_zip_class", "retirement_pctile_class"],
  },
]

const ZIP_SIGNAL_SPECS: {
  key: keyof WarroomZipSignalRecord
  label: string
  icon: typeof Sparkles
  color: string
  reasoningKey?: keyof WarroomZipSignalRecord
}[] = [
  {
    key: "white_space_flag",
    label: "White-Space ZIP",
    icon: Sparkles,
    color: "#0D9488",
    reasoningKey: "white_space_reasoning",
  },
  {
    key: "compound_demand_flag",
    label: "Compound Demand",
    icon: LineChart,
    color: "#2563EB",
    reasoningKey: "compound_demand_reasoning",
  },
  {
    key: "mirror_pair_flag",
    label: "Mirror Pair",
    icon: Layers,
    color: "#7C3AED",
    reasoningKey: "mirror_reasoning",
  },
  {
    key: "contested_zone_flag",
    label: "Contested Zone",
    icon: Crosshair,
    color: "#C23B3B",
    reasoningKey: "contested_zone_reasoning",
  },
  {
    key: "ada_benchmark_gap_flag",
    label: "ADA Benchmark Gap",
    icon: AlertTriangle,
    color: "#D4920B",
    reasoningKey: "ada_benchmark_reasoning",
  },
]

function formatFieldValue(value: unknown): string | null {
  if (value == null || value === "") return null
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return formatNumber(value)
  return String(value)
}

function humanizeFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function ScoreComponentRow({ component }: { component: WarroomScoreComponent }) {
  const positive = component.contribution > 0
  const negative = component.contribution < 0
  const tone = positive
    ? "text-[#2D8B4E]"
    : negative
    ? "text-[#C23B3B]"
    : "text-[#707064]"
  const bar = positive
    ? "bg-[#2D8B4E]/25"
    : negative
    ? "bg-[#C23B3B]/25"
    : "bg-[#E8E5DE]"
  const width = Math.min(100, Math.abs(component.contribution) * 3)

  return (
    <Popover>
      <PopoverTrigger className="group w-full rounded-md border border-transparent px-1.5 py-1 text-left transition-colors hover:border-[#E8E5DE] hover:bg-[#FFFFFF] focus:outline-none focus-visible:border-[#B8860B]/40 focus-visible:bg-[#FFFFFF]">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1 font-medium text-[#1A1A1A]">
            {component.label}
            <Info className="h-3 w-3 text-[#8F8E82] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </span>
          <span className={cn("font-mono font-semibold", tone)}>
            {positive ? "+" : ""}
            {component.contribution}
            <span className="ml-0.5 text-[9px] text-[#707064]">
              (w {component.weight})
            </span>
          </span>
        </div>
        <div className="mt-1 relative h-1.5 w-full overflow-hidden rounded-full bg-[#F7F7F4]">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", bar)}
            style={{ width: `${width}%` }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-80 text-[12px]">
        <div className="flex items-center justify-between gap-2 border-b border-[#E8E5DE] pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            {component.label}
          </p>
          <span className={cn("font-mono text-[13px] font-bold", tone)}>
            {positive ? "+" : ""}
            {component.contribution}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <dt className="uppercase tracking-wider text-[#707064]">Weight</dt>
            <dd className="font-mono text-[#1A1A1A]">{component.weight}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-[#707064]">Points</dt>
            <dd className={cn("font-mono", tone)}>
              {positive ? "+" : ""}
              {component.contribution}
            </dd>
          </div>
        </dl>
        <p className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-[#1A1A1A]">
          {component.reasoning}
        </p>
      </PopoverContent>
    </Popover>
  )
}

function ScoreBreakdownInline({ components }: { components: WarroomScoreComponent[] }) {
  const ranked = [...components].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  )
  if (ranked.length === 0) return null

  return (
    <div className="space-y-0.5">
      <p className="px-1.5 pb-1 text-[10px] italic text-[#707064]">
        Click any component for its reasoning.
      </p>
      {ranked.map((component) => (
        <ScoreComponentRow key={component.label} component={component} />
      ))}
    </div>
  )
}

function SignalFlagCard({
  label,
  color,
  icon: Icon,
  reasoning,
  extras,
}: {
  label: string
  color: string
  icon: typeof Sparkles
  reasoning: string | null
  extras: { label: string; value: string }[]
}) {
  return (
    <article
      className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
        <p className="text-[13px] font-semibold text-[#1A1A1A]">{label}</p>
      </div>
      {reasoning && (
        <p className="mt-1.5 text-[11px] leading-snug text-[#6B6B60]">{reasoning}</p>
      )}
      {extras.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {extras.map((extra) => (
            <div key={extra.label} className="flex items-center gap-1">
              <dt className="uppercase tracking-wider text-[#707064]">{extra.label}</dt>
              <dd className="font-mono font-semibold text-[#1A1A1A]">{extra.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-[12px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F7F7F4]"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#2D8B4E]" /> : <Copy className="h-3.5 w-3.5 text-[#6B6B60]" />}
      {copied ? "Copied" : label}
    </button>
  )
}

function DossierField({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | null | undefined
  icon?: typeof Sparkles
}) {
  const empty = value == null || value === ""
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-[#707064]" />}
        <p
          className={cn(
            "truncate text-[13px]",
            empty ? "text-[#8F8E82]" : "text-[#1A1A1A]"
          )}
        >
          {empty ? "—" : value}
        </p>
      </div>
    </div>
  )
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

function gatherPracticeFlags(
  signal: WarroomPracticeSignalRecord | null
): { spec: SignalFlagSpec; reasoning: string | null; extras: { label: string; value: string }[] }[] {
  if (!signal) return []
  return PRACTICE_SIGNAL_SPECS.filter((spec) => {
    const value = signal[spec.key]
    return typeof value === "boolean" ? value : Boolean(value)
  }).map((spec) => {
    const reasoning = spec.reasoningKey
      ? (signal[spec.reasoningKey] as string | null) ?? null
      : null
    const extras: { label: string; value: string }[] = []
    spec.extraKeys?.forEach((key) => {
      const raw = signal[key]
      const formatted = formatFieldValue(raw)
      if (formatted) extras.push({ label: humanizeFieldName(String(key)), value: formatted })
    })
    return { spec, reasoning, extras }
  })
}

function gatherZipFlags(
  zipSignal: WarroomZipSignalRecord | null
): { spec: (typeof ZIP_SIGNAL_SPECS)[number]; reasoning: string | null }[] {
  if (!zipSignal) return []
  return ZIP_SIGNAL_SPECS.filter((spec) => Boolean(zipSignal[spec.key])).map((spec) => ({
    spec,
    reasoning: spec.reasoningKey ? (zipSignal[spec.reasoningKey] as string | null) ?? null : null,
  }))
}

function buildSimilarIntent(target: RankedTarget): string {
  const parts: string[] = []
  if (target.ownershipGroup === "independent") parts.push("independent practices")
  if (target.ownershipGroup === "corporate") parts.push("corporate practices")
  if (target.buyabilityScore && target.buyabilityScore >= 50) parts.push("buyability over 50")
  if (target.yearEstablished && target.yearEstablished < 1995) parts.push("retirement risk")
  const topFlag = target.flags[0]
  if (topFlag) parts.push(topFlag.replace(/_/g, " "))
  if (target.zip) parts.push(`near ZIP ${target.zip}`)
  return parts.length > 0 ? `similar ${parts.join(" ")}` : "similar acquisition targets"
}

function googleMapsUrl(target: RankedTarget): string {
  const practice = target.candidate.practice
  const parts = [practice.practice_name, practice.address, practice.city, practice.state, practice.zip]
    .filter((part): part is string => Boolean(part && part.trim()))
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`
}

function zocdocUrl(target: RankedTarget): string {
  const query = [target.practiceName, target.city].filter(Boolean).join(" ")
  return `https://www.zocdoc.com/search?query=${encodeURIComponent(query)}`
}

function healthgradesUrl(target: RankedTarget): string {
  const query = [target.practiceName, target.city, target.candidate.practice.state]
    .filter(Boolean)
    .join(" ")
  return `https://www.healthgrades.com/providers/search?what=${encodeURIComponent(query)}`
}

export function DossierDrawer({
  target,
  onClose,
  onPin,
  onUnpin,
  isPinned,
  onIntentRequest,
  nearbyDeals = [],
  recentChanges = [],
}: DossierDrawerProps) {
  const isOpen = target != null

  const practice = target?.candidate.practice ?? null
  const signal = target?.candidate.signal ?? null
  const zipScore = target?.candidate.zipScore ?? null
  const zipSignal = target?.candidate.zipSignal ?? null

  const practiceFlags = useMemo(() => gatherPracticeFlags(signal), [signal])
  const zipFlags = useMemo(() => gatherZipFlags(zipSignal), [zipSignal])

  const nearbyDealMatches = useMemo<NearbyDealMatch[]>(() => {
    if (!target) return []
    return filterNearbyDealsWithin(nearbyDeals, target, {
      withinMiles: 2,
      withinMonths: 24,
    }).slice(0, 8)
  }, [nearbyDeals, target])

  const localChanges = useMemo(() => {
    if (!practice) return []
    return recentChanges.filter((change) => change.npi === practice.npi).slice(0, 10)
  }, [practice, recentChanges])

  if (!target || !practice) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent className="border-[#E8E5DE] bg-[#FFFFFF]" />
      </Sheet>
    )
  }

  const tier = TIER_STYLES[target.tier]
  const TierIcon = tier.icon
  const entityLabel = getEntityClassificationLabel(target.entityClassification)
  const addressLine = [practice.address, practice.city, practice.state, practice.zip]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ")

  const similarIntent = buildSimilarIntent(target)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-[640px]"
      >
        <SheetHeader className="space-y-3 border-b border-[#E8E5DE] bg-[#FAFAF7] p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B6B60]">
            <span className="font-mono text-[#B8860B]">#{target.rank}</span>
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
            <span className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 uppercase tracking-wider text-[#6B6B60]">
              {target.ownershipGroup}
            </span>
            <span className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 text-[#6B6B60]">
              {entityLabel}
            </span>
            {target.candidate.practice.data_axle_import_date && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#2D8B4E]/30 bg-[#2D8B4E]/10 px-1.5 py-0.5 text-[10px] text-[#2D8B4E]">
                <BadgeCheck className="h-3 w-3" />
                Data Axle
              </span>
            )}
          </div>
          <SheetTitle className="pr-12 text-xl font-bold leading-tight text-[#1A1A1A]">
            {target.practiceName}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-[13px] text-[#6B6B60]">
            <MapPin className="h-3.5 w-3.5" />
            {addressLine || "Address not recorded"}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-baseline gap-1 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/10 px-3 py-1.5">
              <span className="font-mono text-2xl font-bold text-[#1A1A1A]">
                {target.score}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#6B6B60]">
                / 100
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                isPinned ? onUnpin?.(target.npi) : onPin?.(target.npi)
              }
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors",
                isPinned
                  ? "border-[#B8860B]/40 bg-[#B8860B]/15 text-[#B8860B]"
                  : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4]"
              )}
            >
              {isPinned ? (
                <Star className="h-3.5 w-3.5" fill="currentColor" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
              {isPinned ? "Pinned" : "Pin target"}
            </button>
            {onIntentRequest && (
              <button
                type="button"
                onClick={() => onIntentRequest(similarIntent)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/5 px-3 text-[12px] font-medium text-[#B8860B] transition-colors hover:bg-[#B8860B]/15"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Find similar
              </button>
            )}
          </div>
          <p className="text-[11px] italic text-[#6B6B60]">{target.headline}</p>
        </SheetHeader>

        <Tabs defaultValue="snapshot" className="flex flex-1 min-h-0 flex-col">
          <div className="border-b border-[#E8E5DE] bg-[#FFFFFF] px-4 pt-3">
            <TabsList variant="line" className="h-9 w-full justify-start">
              <TabsTrigger value="snapshot" className="flex-none">
                Snapshot
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex-none">
                Evidence
                {(practiceFlags.length + zipFlags.length) > 0 && (
                  <span className="ml-1 rounded-full bg-[#B8860B]/15 px-1.5 text-[10px] font-semibold text-[#B8860B]">
                    {practiceFlags.length + zipFlags.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="market" className="flex-none">
                Market
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex-none">
                Actions
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="snapshot" className="px-5 py-4">
              <SnapshotTab
                target={target}
                entityLabel={entityLabel}
                signal={signal}
              />
            </TabsContent>

            <TabsContent value="evidence" className="px-5 py-4">
              <EvidenceTab
                practiceFlags={practiceFlags}
                zipFlags={zipFlags}
                signal={signal}
                recentChanges={localChanges}
              />
            </TabsContent>

            <TabsContent value="market" className="px-5 py-4">
              <MarketTab
                zipScore={zipScore}
                zipSignal={zipSignal}
                nearbyDealMatches={nearbyDealMatches}
              />
            </TabsContent>

            <TabsContent value="actions" className="px-5 py-4">
              <ActionsTab target={target} similarIntent={similarIntent} onIntentRequest={onIntentRequest} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function SnapshotTab({
  target,
  entityLabel,
  signal,
}: {
  target: RankedTarget
  entityLabel: string
  signal: WarroomPracticeSignalRecord | null
}) {
  const practice = target.candidate.practice

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
          Score Composition
        </h3>
        <div className="mt-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <ScoreBreakdownInline components={target.components} />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
          Practice Economics
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBlock
            label="Buyability"
            value={target.buyabilityScore != null ? target.buyabilityScore : "—"}
            subtitle="Algorithmic score"
            accent="#2D8B4E"
          />
          <StatBlock
            label="Year Established"
            value={target.yearEstablished ?? "—"}
            subtitle={
              target.yearEstablished
                ? `${new Date().getFullYear() - target.yearEstablished} yrs old`
                : undefined
            }
            accent="#D4920B"
          />
          <StatBlock
            label="Providers"
            value={target.numProviders ?? "—"}
            accent="#7C3AED"
          />
          <StatBlock
            label="Employees"
            value={target.employeeCount != null ? formatNumber(target.employeeCount) : "—"}
            accent="#2563EB"
          />
          <StatBlock
            label="Revenue"
            value={
              target.estimatedRevenue != null
                ? formatCurrency(target.estimatedRevenue)
                : "—"
            }
            accent="#0D9488"
          />
          <StatBlock
            label="Providers at Loc."
            value={signal?.retirement_combo_score != null ? formatNumber(signal.retirement_combo_score) : "—"}
            subtitle="Retirement combo pts"
            accent="#C23B3B"
          />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
          Identity & Contact
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <DossierField label="NPI" value={practice.npi} />
          <DossierField label="Doing Business As" value={practice.doing_business_as} />
          <DossierField label="Phone" value={practice.phone} icon={Phone} />
          <DossierField label="Website" value={practice.website} icon={Globe} />
          <DossierField label="Taxonomy" value={practice.taxonomy_description ?? practice.taxonomy_code} />
          <DossierField label="Location Type" value={practice.location_type} />
          <DossierField
            label="Classification"
            value={`${entityLabel} · ${practice.ownership_status ?? "—"}`}
          />
          <DossierField
            label="Confidence"
            value={
              practice.classification_confidence != null
                ? `${practice.classification_confidence}/100`
                : null
            }
          />
        </div>
      </section>

      {practice.classification_reasoning && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Classification Reasoning
          </h3>
          <p className="mt-2 whitespace-pre-wrap rounded-md border-l-2 border-[#B8860B] bg-[#FAFAF7] p-3 font-mono text-[11px] leading-relaxed text-[#1A1A1A]">
            {practice.classification_reasoning}
          </p>
        </section>
      )}

      {(practice.parent_company || practice.ein || practice.franchise_name || practice.affiliated_dso) && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Corporate Signals
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <DossierField label="Parent Company" value={practice.parent_company} icon={Building2} />
            <DossierField label="EIN" value={practice.ein} />
            <DossierField label="Franchise" value={practice.franchise_name} />
            <DossierField label="Affiliated DSO" value={practice.affiliated_dso} icon={Handshake} />
            {practice.affiliated_pe_sponsor && (
              <DossierField
                label="PE Sponsor"
                value={practice.affiliated_pe_sponsor}
                icon={Handshake}
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function EvidenceTab({
  practiceFlags,
  zipFlags,
  signal,
  recentChanges,
}: {
  practiceFlags: ReturnType<typeof gatherPracticeFlags>
  zipFlags: ReturnType<typeof gatherZipFlags>
  signal: WarroomPracticeSignalRecord | null
  recentChanges: WarroomChangeRecord[]
}) {
  const hasAnyFlags = practiceFlags.length > 0 || zipFlags.length > 0

  return (
    <div className="space-y-5">
      {!hasAnyFlags && (
        <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] px-4 py-10 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-[#B8860B]" />
          <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
            No signals flagged for this practice yet.
          </p>
          <p className="mt-1 text-xs text-[#6B6B60]">
            Signal layer still refreshing, or practice has no hidden-gold triggers.
          </p>
        </div>
      )}

      {practiceFlags.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Practice-Level Signals
            <span className="ml-2 rounded-full bg-[#F7F7F4] px-1.5 py-0.5 text-[10px] font-medium text-[#6B6B60]">
              {practiceFlags.length}
            </span>
          </h3>
          <div className="mt-2 space-y-2">
            {practiceFlags.map(({ spec, reasoning, extras }) => (
              <SignalFlagCard
                key={String(spec.key)}
                label={spec.label}
                color={spec.color}
                icon={spec.icon}
                reasoning={reasoning}
                extras={extras}
              />
            ))}
          </div>
        </section>
      )}

      {zipFlags.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            ZIP-Level Signals
            <span className="ml-2 rounded-full bg-[#F7F7F4] px-1.5 py-0.5 text-[10px] font-medium text-[#6B6B60]">
              {zipFlags.length}
            </span>
          </h3>
          <div className="mt-2 space-y-2">
            {zipFlags.map(({ spec, reasoning }) => (
              <SignalFlagCard
                key={String(spec.key)}
                label={spec.label}
                color={spec.color}
                icon={spec.icon}
                reasoning={reasoning}
                extras={[]}
              />
            ))}
          </div>
        </section>
      )}

      {signal?.data_limitations && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Data Limitations
          </h3>
          <p className="mt-2 rounded-md border border-[#D4920B]/30 bg-[#D4920B]/5 p-3 text-[11px] leading-snug text-[#1A1A1A]">
            {signal.data_limitations}
          </p>
        </section>
      )}

      {recentChanges.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Change Timeline ({recentChanges.length})
          </h3>
          <ol className="mt-3 relative ml-1.5 border-l-2 border-[#E8E5DE]">
            {recentChanges.map((change) => {
              const dotColor = changeDotColor(change.change_type ?? change.field_changed)
              return (
                <li key={change.id} className="relative pl-4 pb-4 last:pb-0">
                  <span
                    className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-[#FFFFFF] shadow-sm"
                    style={{ backgroundColor: dotColor }}
                    aria-hidden
                  />
                  <div className="flex items-baseline justify-between gap-2 text-[11px] text-[#707064]">
                    <span className="font-mono uppercase tracking-wider" style={{ color: dotColor }}>
                      {change.change_type ?? change.field_changed ?? "Change"}
                    </span>
                    <span className="font-mono">{formatDate(change.change_date)}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#1A1A1A]">
                    <span className="font-semibold">{change.field_changed ?? "field"}</span>
                    {(change.old_value || change.new_value) && (
                      <>
                        {" — "}
                        <span className="text-[#C23B3B] line-through decoration-[#C23B3B]/50">
                          {change.old_value ?? "—"}
                        </span>
                        {" → "}
                        <span className="font-semibold text-[#2D8B4E]">
                          {change.new_value ?? "—"}
                        </span>
                      </>
                    )}
                  </p>
                  {change.notes && (
                    <p className="mt-1 text-[11px] italic text-[#6B6B60]">{change.notes}</p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

function changeDotColor(type: string | null | undefined): string {
  if (!type) return "#9C9C90"
  const key = type.toLowerCase()
  if (key.includes("ownership") || key.includes("dso") || key.includes("acquisition")) return "#C23B3B"
  if (key.includes("phone") || key.includes("website") || key.includes("name")) return "#2563EB"
  if (key.includes("address")) return "#7C3AED"
  if (key.includes("hours") || key.includes("status")) return "#D4920B"
  return "#B8860B"
}

function MarketTab({
  zipScore,
  zipSignal,
  nearbyDealMatches,
}: {
  zipScore: WarroomZipScoreRecord | null
  zipSignal: WarroomZipSignalRecord | null
  nearbyDealMatches: NearbyDealMatch[]
}) {
  if (!zipScore && !zipSignal) {
    return (
      <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] px-4 py-10 text-center">
        <Layers className="mx-auto h-5 w-5 text-[#B8860B]" />
        <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
          No ZIP-level context available
        </p>
        <p className="mt-1 text-xs text-[#6B6B60]">
          Practice may be outside watched ZIPs, or scoring pipeline has not covered this ZIP yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {zipScore && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            ZIP {zipScore.zip_code} · {zipScore.city ?? "—"}
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatBlock
              label="Opportunity"
              value={zipScore.opportunity_score != null ? formatNumber(zipScore.opportunity_score) : "—"}
              subtitle="/ 100"
              accent="#B8860B"
            />
            <StatBlock
              label="Corporate Share"
              value={
                zipScore.corporate_share_pct != null
                  ? formatPercent(zipScore.corporate_share_pct)
                  : "—"
              }
              subtitle={
                zipScore.corporate_highconf_count != null
                  ? `${formatNumber(zipScore.corporate_highconf_count)} high-conf`
                  : undefined
              }
              accent="#C23B3B"
            />
            <StatBlock
              label="Buyable Ratio"
              value={
                zipScore.buyable_practice_ratio != null
                  ? formatPercent(zipScore.buyable_practice_ratio)
                  : "—"
              }
              accent="#2D8B4E"
            />
            <StatBlock
              label="Density (GP/10k)"
              value={zipScore.dld_gp_per_10k != null ? formatNumber(zipScore.dld_gp_per_10k) : "—"}
              accent="#2563EB"
            />
            <StatBlock
              label="People / Door"
              value={
                zipScore.people_per_gp_door != null
                  ? formatNumber(zipScore.people_per_gp_door)
                  : "—"
              }
              accent="#7C3AED"
            />
            <StatBlock
              label="Market Type"
              value={zipScore.market_type ?? "—"}
              subtitle={zipScore.market_type_confidence ?? undefined}
              accent="#0D9488"
            />
          </div>
        </section>
      )}

      {zipSignal && (zipSignal.mirror_pair_flag || zipSignal.compound_demand_flag || zipSignal.white_space_flag) && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            ZIP Signals Summary
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 text-[12px]">
            {zipSignal.white_space_score != null && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#707064]">
                  White-space score
                </dt>
                <dd className="font-mono text-[13px] font-semibold text-[#1A1A1A]">
                  {formatNumber(zipSignal.white_space_score)}
                </dd>
              </div>
            )}
            {zipSignal.compound_demand_score != null && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#707064]">
                  Compound demand
                </dt>
                <dd className="font-mono text-[13px] font-semibold text-[#1A1A1A]">
                  {formatNumber(zipSignal.compound_demand_score)}
                </dd>
              </div>
            )}
            {zipSignal.top_mirror_zip && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#707064]">
                  Mirror pair
                </dt>
                <dd className="font-mono text-[13px] font-semibold text-[#1A1A1A]">
                  {zipSignal.top_mirror_zip}
                </dd>
              </div>
            )}
            {zipSignal.contested_platform_count != null && zipSignal.contested_platform_count > 0 && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#707064]">
                  Contested platforms
                </dt>
                <dd className="font-mono text-[13px] font-semibold text-[#1A1A1A]">
                  {zipSignal.contested_platform_count}
                </dd>
              </div>
            )}
            {zipSignal.ada_benchmark_gap_pp != null && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#707064]">
                  ADA gap (pp)
                </dt>
                <dd className="font-mono text-[13px] font-semibold text-[#1A1A1A]">
                  {formatNumber(zipSignal.ada_benchmark_gap_pp)}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Deal catchment
            <span className="ml-2 text-[10px] normal-case tracking-normal text-[#6B6B60]">
              within 2 mi · last 24 mo
            </span>
          </h3>
          {nearbyDealMatches.length > 0 && (
            <span className="rounded-full bg-[#7C3AED]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#7C3AED]">
              {nearbyDealMatches.length} deals
            </span>
          )}
        </div>
        {nearbyDealMatches.length === 0 ? (
          <p className="mt-2 rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] px-3 py-4 text-center text-[11px] italic text-[#6B6B60]">
            No PE deals within 2 miles in the last 24 months.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {nearbyDealMatches.map(({ deal, distanceMiles }) => (
              <li
                key={deal.id}
                className="rounded-md border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-3 text-[12px]"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#6B6B60]">
                  <span>{formatDate(deal.deal_date)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-[#7C3AED]/30 bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#7C3AED]">
                      {distanceMiles.toFixed(1)} mi
                    </span>
                    <span className="font-semibold text-[#7C3AED]">
                      {deal.deal_type ?? "Deal"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 font-semibold text-[#1A1A1A]">
                  {deal.target_name ?? "Unnamed target"}
                </p>
                <p className="text-[11px] text-[#6B6B60]">
                  Acquired by {deal.platform_company ?? "unknown platform"}
                  {deal.pe_sponsor ? ` · ${deal.pe_sponsor}` : ""}
                </p>
                {(deal.target_city || deal.target_zip) && (
                  <p className="mt-0.5 text-[11px] text-[#707064]">
                    {[deal.target_city, deal.target_zip].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ActionsTab({
  target,
  similarIntent,
  onIntentRequest,
}: {
  target: RankedTarget
  similarIntent: string
  onIntentRequest?: (intentText: string) => void
}) {
  const practice = target.candidate.practice
  const addressLine = [practice.address, practice.city, practice.state, practice.zip]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ")
  const deepLinks = buildDeepLinks(target)

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
          Dashboard deep-links
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {deepLinks.map((link) => (
            <DeepLinkRow key={link.href} {...link} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
          Copy to Clipboard
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton value={practice.npi} label={`NPI ${practice.npi}`} />
          {addressLine && <CopyButton value={addressLine} label="Full address" />}
          {practice.phone && <CopyButton value={practice.phone} label="Phone" />}
          {practice.website && <CopyButton value={practice.website} label="Website URL" />}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
          External Lookups
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ExternalLinkRow
            label="Google Maps"
            description="Visual + Street View"
            href={googleMapsUrl(target)}
          />
          <ExternalLinkRow
            label="Zocdoc"
            description="Reviews + booking"
            href={zocdocUrl(target)}
          />
          <ExternalLinkRow
            label="Healthgrades"
            description="Doctor profile"
            href={healthgradesUrl(target)}
          />
          {practice.website && (
            <ExternalLinkRow
              label="Practice Website"
              description="Direct link"
              href={safeExternalUrl(practice.website)}
            />
          )}
          <ExternalLinkRow
            label="NPPES Registry"
            description="Federal record"
            href={`https://npiregistry.cms.hhs.gov/provider-view/${practice.npi}`}
          />
        </div>
      </section>

      {onIntentRequest && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
            Hunt Actions
          </h3>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => onIntentRequest(similarIntent)}
              className="flex w-full items-start justify-between gap-3 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/5 p-3 text-left transition-colors hover:bg-[#B8860B]/15"
            >
              <div>
                <p className="text-[13px] font-semibold text-[#1A1A1A]">
                  Find similar targets
                </p>
                <p className="mt-0.5 text-[11px] text-[#6B6B60]">
                  &quot;{similarIntent}&quot;
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#B8860B]" />
            </button>
            {practice.zip && (
              <button
                type="button"
                onClick={() => onIntentRequest(`all acquisition targets in ZIP ${practice.zip}`)}
                className="flex w-full items-start justify-between gap-3 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3 text-left transition-colors hover:bg-[#F7F7F4]"
              >
                <div>
                  <p className="text-[13px] font-semibold text-[#1A1A1A]">
                    Expand to full ZIP
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B6B60]">
                    Hunt the rest of ZIP {practice.zip}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#6B6B60]" />
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ExternalLinkRow({
  label,
  description,
  href,
}: {
  label: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3 transition-colors hover:border-[#B8860B]/40 hover:bg-[#FAFAF7]"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[#1A1A1A]">{label}</p>
        <p className="truncate text-[11px] text-[#6B6B60]">{description}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-[#707064] group-hover:text-[#B8860B]" />
    </a>
  )
}

interface DeepLink {
  href: string
  label: string
  description: string
  icon: typeof Sparkles
  color: string
}

function buildDeepLinks(target: RankedTarget): DeepLink[] {
  const practice = target.candidate.practice
  const links: DeepLink[] = []

  links.push({
    href: "/market-intel?tab=consolidation",
    label: "Market Intel",
    description: "ZIP consolidation landscape",
    icon: Compass,
    color: "#2563EB",
  })

  links.push({
    href: "/job-market?location=all_chicagoland&tab=directory",
    label: "Job Market · Directory",
    description: "All Chicagoland practice directory",
    icon: Briefcase,
    color: "#0D9488",
  })

  if (practice.affiliated_pe_sponsor) {
    const sponsor = practice.affiliated_pe_sponsor
    links.push({
      href: `/deal-flow?tab=deals&sponsors=${encodeURIComponent(sponsor)}`,
      label: "Deal Flow · Sponsor",
      description: `Filter deals by ${sponsor}`,
      icon: TrendingUp,
      color: "#7C3AED",
    })
    links.push({
      href: "/research?tab=sponsor",
      label: "Research · Sponsor",
      description: `Profile ${sponsor}`,
      icon: Search,
      color: "#B8860B",
    })
  }

  if (practice.affiliated_dso) {
    const dso = practice.affiliated_dso
    links.push({
      href: `/deal-flow?tab=deals&platforms=${encodeURIComponent(dso)}`,
      label: "Deal Flow · Platform",
      description: `Filter deals by ${dso}`,
      icon: TrendingUp,
      color: "#C23B3B",
    })
    links.push({
      href: "/research?tab=platform",
      label: "Research · Platform",
      description: `Profile ${dso}`,
      icon: Search,
      color: "#B8860B",
    })
  }

  if (practice.state) {
    links.push({
      href: `/deal-flow?tab=geography&states=${encodeURIComponent(practice.state)}`,
      label: "Deal Flow · State",
      description: `All ${practice.state} deals`,
      icon: TrendingUp,
      color: "#D4920B",
    })
  }

  return links
}

function DeepLinkRow({ href, label, description, icon: Icon, color }: DeepLink) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3 transition-colors hover:border-[#B8860B]/40 hover:bg-[#FAFAF7]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#1A1A1A]">{label}</p>
        <p className="truncate text-[11px] text-[#6B6B60]">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#707064] group-hover:text-[#B8860B]" />
    </Link>
  )
}
