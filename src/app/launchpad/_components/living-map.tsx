"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Info, Layers, MapPinOff } from "lucide-react"
import { Marker, Popup } from "react-map-gl/mapbox"
import { MapContainer } from "@/components/maps/map-container"
import { PanelErrorBoundary } from "@/components/ui/panel-error-boundary"
import { ZIP_CENTROIDS } from "@/lib/constants/zip-centroids"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/utils/formatting"
import {
  LAUNCHPAD_TIER_LABELS,
  LAUNCHPAD_TIERS,
  type LaunchpadBundle,
  type LaunchpadRankedTarget,
  type LaunchpadTier,
} from "@/lib/launchpad/signals"
import { getLaunchpadScopeOption, type LaunchpadScope } from "@/lib/launchpad/scope"
import { getPracticeDisplayName } from "@/lib/launchpad/display"

const HAS_MAPBOX_TOKEN = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)

export type LaunchpadMapView = "practices" | "zips"

// ---------------------------------------------------------------------------
// Lens types
// ---------------------------------------------------------------------------

export type LaunchpadMapLens =
  | "tier"
  | "mentor_density"
  | "dso_avoid"

interface LensOption {
  id: LaunchpadMapLens
  label: string
  description: string
}

const LENS_OPTIONS: LensOption[] = [
  {
    id: "tier",
    label: "Fit Tier",
    description: "ZIP or practice colored by dominant fit tier",
  },
  {
    id: "mentor_density",
    label: "Mentor Density",
    description: "ZIPs with more mentor-rich practices shine brighter",
  },
  {
    id: "dso_avoid",
    label: "DSO Avoid",
    description: "ZIPs with more avoid-tier DSO practices highlighted",
  },
]

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface LaunchpadLivingMapProps {
  bundle: LaunchpadBundle | null
  scope: LaunchpadScope
  view: LaunchpadMapView
  onViewChange: (view: LaunchpadMapView) => void
  selectedNpi: string | null
  selectedZip: string | null
  onSelectNpi: (npi: string) => void
  onSelectZip: (zip: string | null) => void
  onOpenZipDossier?: (zip: string) => void
  height?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Tier colors (unchanged from Phase 2)
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<LaunchpadTier, string> = {
  best_fit: "#2D8B4E",
  strong: "#B8860B",
  maybe: "#2563EB",
  low: "#9C9C90",
  avoid: "#C23B3B",
}

const TIER_PRIORITY: Record<LaunchpadTier, number> = {
  best_fit: 5,
  strong: 4,
  maybe: 3,
  low: 2,
  avoid: 1,
}

// Mentor density color ramp (green tones, brighter = more mentors)
const MENTOR_COLORS = ["#D1FAE5", "#6EE7B7", "#34D399", "#10B981", "#059669", "#047857"]

// DSO avoid color ramp (red-orange tones, brighter = more avoid-tier)
const AVOID_COLORS = ["#FEE2E2", "#FCA5A5", "#F87171", "#EF4444", "#DC2626", "#B91C1C"]

function mentorColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "#E8E5DE"
  const idx = Math.min(
    Math.floor((count / maxCount) * MENTOR_COLORS.length),
    MENTOR_COLORS.length - 1
  )
  return MENTOR_COLORS[idx]
}

function avoidColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "#E8E5DE"
  const idx = Math.min(
    Math.floor((count / maxCount) * AVOID_COLORS.length),
    AVOID_COLORS.length - 1
  )
  return AVOID_COLORS[idx]
}

const PRACTICE_DOT_LIMIT = 250

// ---------------------------------------------------------------------------
// Aggregation types
// ---------------------------------------------------------------------------

interface ZipAggregate {
  zip: string
  lat: number
  lng: number
  city: string | null
  total: number
  bestFit: number
  strong: number
  maybe: number
  low: number
  avoid: number
  mentorCount: number
  dsoAvoidCount: number
  dominantTier: LaunchpadTier
  bestScore: number
  topTargets: LaunchpadRankedTarget[]
  /** From zipScore.metrics_confidence */
  metricsConfidence: string | null
}

function dominantTierOf(counts: Record<LaunchpadTier, number>): LaunchpadTier {
  let best: LaunchpadTier = "low"
  let bestCount = -1
  let bestPriority = -1
  for (const tier of LAUNCHPAD_TIERS) {
    const count = counts[tier]
    if (count === 0) continue
    const priority = TIER_PRIORITY[tier]
    if (
      count > bestCount ||
      (count === bestCount && priority > bestPriority)
    ) {
      best = tier
      bestCount = count
      bestPriority = priority
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LaunchpadLivingMap({
  bundle,
  scope,
  view,
  onViewChange,
  selectedNpi,
  selectedZip,
  onSelectNpi,
  onSelectZip,
  onOpenZipDossier,
  height = 560,
  className,
}: LaunchpadLivingMapProps) {
  const [hoveredZip, setHoveredZip] = useState<string | null>(null)
  const [hoveredNpi, setHoveredNpi] = useState<string | null>(null)
  const [activeLens, setActiveLens] = useState<LaunchpadMapLens>("tier")

  const scopeOption = getLaunchpadScopeOption(scope)
  const rankedTargets = bundle?.rankedTargets ?? []

  const mapCenter: [number, number] = useMemo(
    () => [scopeOption.centerLat, scopeOption.centerLon],
    [scopeOption.centerLat, scopeOption.centerLon]
  )

  const mapZoom = scope === "all_chicagoland" ? 9 : 10

  // ---------------------------------------------------------------------------
  // ZIP aggregation
  // ---------------------------------------------------------------------------
  const zipAggregates = useMemo(() => {
    const map = new Map<string, ZipAggregate>()
    for (const target of rankedTargets) {
      const zip = target.practice.zip
      if (!zip) continue
      const coords = ZIP_CENTROIDS[zip]
      if (!coords) continue
      let agg = map.get(zip)
      if (!agg) {
        agg = {
          zip,
          lat: coords[0],
          lng: coords[1],
          city: target.zipScore?.city ?? target.practice.city ?? null,
          total: 0,
          bestFit: 0,
          strong: 0,
          maybe: 0,
          low: 0,
          avoid: 0,
          mentorCount: 0,
          dsoAvoidCount: 0,
          dominantTier: "low",
          bestScore: 0,
          topTargets: [],
          metricsConfidence: target.zipScore?.metrics_confidence ?? null,
        }
        map.set(zip, agg)
      }
      agg.total += 1
      if (target.displayTier === "best_fit") agg.bestFit += 1
      else if (target.displayTier === "strong") agg.strong += 1
      else if (target.displayTier === "maybe") agg.maybe += 1
      else if (target.displayTier === "low") agg.low += 1
      else if (target.displayTier === "avoid") agg.avoid += 1
      if (target.displayScore > agg.bestScore) agg.bestScore = target.displayScore

      // Mentor density — count mentor_rich_signal or practices with num_providers >= 3
      const hasMentorSignal = target.activeSignalIds.includes("mentor_rich_signal")
      const isMultiProvider = (target.practice.num_providers ?? 0) >= 3
      if (hasMentorSignal || isMultiProvider) agg.mentorCount += 1

      // DSO avoid — count dso_avoid_warning signal
      if (target.warningSignalIds.includes("dso_avoid_warning")) agg.dsoAvoidCount += 1
    }

    for (const agg of map.values()) {
      agg.dominantTier = dominantTierOf({
        best_fit: agg.bestFit,
        strong: agg.strong,
        maybe: agg.maybe,
        low: agg.low,
        avoid: agg.avoid,
      })
    }

    const zipToTargets = new Map<string, LaunchpadRankedTarget[]>()
    for (const target of rankedTargets) {
      const zip = target.practice.zip
      if (!zip || !map.has(zip)) continue
      const list = zipToTargets.get(zip) ?? []
      list.push(target)
      zipToTargets.set(zip, list)
    }
    for (const [zip, list] of zipToTargets.entries()) {
      const agg = map.get(zip)
      if (!agg) continue
      agg.topTargets = list.slice(0, 5)
    }

    return Array.from(map.values())
  }, [rankedTargets])

  // ---------------------------------------------------------------------------
  // Practice markers
  // ---------------------------------------------------------------------------
  const practiceMarkers = useMemo(() => {
    return rankedTargets
      .filter(
        (t) =>
          t.practice.latitude != null &&
          t.practice.longitude != null &&
          Number.isFinite(t.practice.latitude) &&
          Number.isFinite(t.practice.longitude)
      )
      .slice(0, PRACTICE_DOT_LIMIT)
  }, [rankedTargets])

  const maxZipTotal = useMemo(
    () => zipAggregates.reduce((m, z) => Math.max(m, z.total), 0) || 1,
    [zipAggregates]
  )

  const maxMentorCount = useMemo(
    () => zipAggregates.reduce((m, z) => Math.max(m, z.mentorCount), 0) || 1,
    [zipAggregates]
  )

  const maxAvoidCount = useMemo(
    () => zipAggregates.reduce((m, z) => Math.max(m, z.dsoAvoidCount), 0) || 1,
    [zipAggregates]
  )

  const tierCounts = useMemo(() => {
    const counts: Record<LaunchpadTier, number> = {
      best_fit: 0,
      strong: 0,
      maybe: 0,
      low: 0,
      avoid: 0,
    }
    for (const target of rankedTargets) {
      counts[target.displayTier] = (counts[target.displayTier] ?? 0) + 1
    }
    return counts
  }, [rankedTargets])

  const selectedZipAgg = useMemo(() => {
    if (!selectedZip) return null
    return zipAggregates.find((z) => z.zip === selectedZip) ?? null
  }, [selectedZip, zipAggregates])

  // ---------------------------------------------------------------------------
  // Low metrics confidence warning
  // ---------------------------------------------------------------------------
  const selectedZipLowConfidence =
    selectedZipAgg?.metricsConfidence === "low"

  // ---------------------------------------------------------------------------
  // Lens color resolver for ZIP circles
  // ---------------------------------------------------------------------------
  function getZipColor(agg: ZipAggregate): string {
    if (activeLens === "mentor_density") return mentorColor(agg.mentorCount, maxMentorCount)
    if (activeLens === "dso_avoid") return avoidColor(agg.dsoAvoidCount, maxAvoidCount)
    return TIER_COLORS[agg.dominantTier]
  }

  const activeLensOption = LENS_OPTIONS.find((l) => l.id === activeLens) ?? LENS_OPTIONS[0]

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]",
        className
      )}
      aria-label="Launchpad living map"
    >
      {/* Low confidence warning banner */}
      {selectedZipLowConfidence && (
        <div
          className="flex items-center gap-2 border-b border-[#D4920B]/30 bg-[#D4920B]/10 px-4 py-2"
          role="alert"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#D4920B]" aria-hidden="true" />
          <p className="text-xs text-[#D4920B]">
            <span className="font-semibold">Low metrics confidence</span> for ZIP {selectedZip} —
            interpretations may be unreliable due to insufficient classification data.
          </p>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Living Map</h2>
          <p className="text-xs text-[#707064]">
            {view === "practices"
              ? `Top ${practiceMarkers.length.toLocaleString()} practices colored by fit tier`
              : activeLens === "tier"
                ? `${zipAggregates.length.toLocaleString()} ZIPs colored by dominant tier · sized by practice count`
                : activeLens === "mentor_density"
                  ? `${zipAggregates.length.toLocaleString()} ZIPs colored by mentor-rich practice density`
                  : `${zipAggregates.length.toLocaleString()} ZIPs colored by avoid-tier DSO presence`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lens selector — only shown in ZIP view */}
          {view === "zips" && (
            <div
              className="inline-flex overflow-hidden rounded-md border border-[#E8E5DE]"
              role="group"
              aria-label="Map lens"
            >
              <span className="flex items-center gap-1 border-r border-[#E8E5DE] bg-[#FAFAF7] px-2 text-[10px] uppercase tracking-wider text-[#9C9C90]">
                <Layers className="h-3 w-3" aria-hidden="true" />
                Lens
              </span>
              {LENS_OPTIONS.map((lens) => (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => setActiveLens(lens.id)}
                  aria-pressed={activeLens === lens.id}
                  title={lens.description}
                  className={cn(
                    "h-7 px-2.5 text-[11px] font-medium transition-colors",
                    lens.id !== "tier" && "border-l border-[#E8E5DE]",
                    activeLens === lens.id
                      ? lens.id === "dso_avoid"
                        ? "bg-[#C23B3B]/10 text-[#C23B3B]"
                        : lens.id === "mentor_density"
                          ? "bg-[#2D8B4E]/10 text-[#2D8B4E]"
                          : "bg-[#B8860B]/10 text-[#B8860B]"
                      : "bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#FAFAF7] hover:text-[#1A1A1A]"
                  )}
                >
                  {lens.label}
                </button>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div className="inline-flex overflow-hidden rounded-md border border-[#E8E5DE]">
            <button
              type="button"
              onClick={() => onViewChange("practices")}
              aria-pressed={view === "practices"}
              className={cn(
                "h-7 px-3 text-[11px] font-medium transition-colors",
                view === "practices"
                  ? "bg-[#B8860B]/10 text-[#B8860B]"
                  : "bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#FAFAF7] hover:text-[#1A1A1A]"
              )}
            >
              Practices
            </button>
            <button
              type="button"
              onClick={() => onViewChange("zips")}
              aria-pressed={view === "zips"}
              className={cn(
                "h-7 px-3 text-[11px] font-medium transition-colors border-l border-[#E8E5DE]",
                view === "zips"
                  ? "bg-[#B8860B]/10 text-[#B8860B]"
                  : "bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#FAFAF7] hover:text-[#1A1A1A]"
              )}
            >
              ZIPs
            </button>
          </div>
        </div>
      </header>

      {/* Practices view hint */}
      {view === "practices" && (
        <div className="flex items-center gap-2 border-b border-[#E8E5DE] bg-[#FAFAF7] px-4 py-1.5">
          <Info className="h-3 w-3 shrink-0 text-[#9C9C90]" aria-hidden="true" />
          <p className="text-[11px] text-[#9C9C90]">
            Tip: Switch to{" "}
            <button
              type="button"
              onClick={() => onViewChange("zips")}
              className="font-medium text-[#6B6B60] underline-offset-2 hover:underline"
            >
              ZIP view
            </button>{" "}
            to see market-level patterns and use the mentor density / DSO avoid lenses.
          </p>
        </div>
      )}

      <div className="relative">
        <PanelErrorBoundary panelName="Living Map">
        <MapContainer height={height} zoom={mapZoom} center={mapCenter}>
          {view === "zips" &&
            zipAggregates.map((agg) => {
              const selected = selectedZip === agg.zip
              const hovered = hoveredZip === agg.zip
              const sizeBase = 16 + Math.sqrt(agg.total / maxZipTotal) * 28
              const size = selected ? sizeBase + 4 : sizeBase
              const color = getZipColor(agg)
              return (
                <Marker
                  key={agg.zip}
                  longitude={agg.lng}
                  latitude={agg.lat}
                  anchor="center"
                >
                  <button
                    type="button"
                    onClick={() => onSelectZip(selected ? null : agg.zip)}
                    onMouseEnter={() => setHoveredZip(agg.zip)}
                    onMouseLeave={() =>
                      setHoveredZip((cur) => (cur === agg.zip ? null : cur))
                    }
                    className={cn(
                      "rounded-full border-2 transition-transform",
                      selected ? "ring-2 ring-[#1A1A1A] ring-offset-1" : "",
                      hovered && !selected ? "scale-110" : ""
                    )}
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: color,
                      borderColor: "#FFFFFF",
                      opacity: 0.85,
                    }}
                    aria-label={`ZIP ${agg.zip} — ${agg.total} practices${activeLens === "mentor_density" ? `, ${agg.mentorCount} mentor-rich` : activeLens === "dso_avoid" ? `, ${agg.dsoAvoidCount} avoid-tier DSO` : `, dominant tier ${LAUNCHPAD_TIER_LABELS[agg.dominantTier]}`}`}
                    title={`${agg.zip} · ${agg.total} practices · ${activeLens === "mentor_density" ? `${agg.mentorCount} mentor-rich` : activeLens === "dso_avoid" ? `${agg.dsoAvoidCount} avoid-tier DSO` : LAUNCHPAD_TIER_LABELS[agg.dominantTier]}`}
                  />
                </Marker>
              )
            })}

          {view === "zips" && hoveredZip && !selectedZip && (() => {
            const hovered = zipAggregates.find((z) => z.zip === hoveredZip)
            if (!hovered) return null
            return (
              <Popup
                longitude={hovered.lng}
                latitude={hovered.lat}
                anchor="top"
                closeButton={false}
                closeOnClick={false}
                offset={12}
              >
                <div className="min-w-[200px] space-y-1 text-xs">
                  <p className="font-semibold text-[#1A1A1A]">
                    ZIP {hovered.zip}
                    {hovered.city ? ` · ${hovered.city}` : ""}
                  </p>
                  <p className="text-[#6B6B60]">
                    {hovered.total} practices · best score{" "}
                    <span className="font-mono font-semibold text-[#1A1A1A]">
                      {Math.round(hovered.bestScore)}
                    </span>
                  </p>
                  {activeLens === "mentor_density" && (
                    <p className="text-[#2D8B4E]">
                      <span className="font-semibold">{hovered.mentorCount}</span> mentor-rich
                    </p>
                  )}
                  {activeLens === "dso_avoid" && (
                    <p className="text-[#C23B3B]">
                      <span className="font-semibold">{hovered.dsoAvoidCount}</span> avoid-tier DSO
                    </p>
                  )}
                  {hovered.metricsConfidence === "low" && (
                    <p className="text-[10px] text-[#D4920B]">⚠ Low metrics confidence</p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {hovered.bestFit > 0 && (
                      <span className="rounded-full bg-[#2D8B4E]/10 px-1.5 py-0.5 text-[10px] text-[#2D8B4E]">
                        {hovered.bestFit} best-fit
                      </span>
                    )}
                    {hovered.strong > 0 && (
                      <span className="rounded-full bg-[#B8860B]/10 px-1.5 py-0.5 text-[10px] text-[#B8860B]">
                        {hovered.strong} strong
                      </span>
                    )}
                    {hovered.avoid > 0 && (
                      <span className="rounded-full bg-[#C23B3B]/10 px-1.5 py-0.5 text-[10px] text-[#C23B3B]">
                        {hovered.avoid} avoid
                      </span>
                    )}
                  </div>
                </div>
              </Popup>
            )
          })()}

          {view === "practices" &&
            practiceMarkers.map((target) => {
              const lat = target.practice.latitude
              const lng = target.practice.longitude
              if (lat == null || lng == null) return null
              const selected = selectedNpi === target.npi
              const hovered = hoveredNpi === target.npi
              const color = TIER_COLORS[target.displayTier]
              const base =
                target.displayTier === "best_fit"
                  ? 12
                  : target.displayTier === "strong"
                    ? 10
                    : 8
              const size = selected ? base + 6 : base
              return (
                <Marker
                  key={target.npi}
                  longitude={lng}
                  latitude={lat}
                  anchor="center"
                >
                  <button
                    type="button"
                    onClick={() => onSelectNpi(target.npi)}
                    onMouseEnter={() => setHoveredNpi(target.npi)}
                    onMouseLeave={() =>
                      setHoveredNpi((cur) => (cur === target.npi ? null : cur))
                    }
                    className={cn(
                      "rounded-full border transition-transform",
                      selected ? "ring-2 ring-[#1A1A1A] ring-offset-1" : "",
                      hovered && !selected ? "scale-125" : ""
                    )}
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: color,
                      borderColor: "#FFFFFF",
                      borderWidth: 1.5,
                      opacity: 0.9,
                    }}
                    aria-label={`${getPracticeDisplayName(target.practice)} — score ${Math.round(target.displayScore)}`}
                    title={`${getPracticeDisplayName(target.practice)} · ${Math.round(target.displayScore)} · ${LAUNCHPAD_TIER_LABELS[target.displayTier]}`}
                  />
                </Marker>
              )
            })}

          {view === "practices" && hoveredNpi && (() => {
            const hovered = practiceMarkers.find((t) => t.npi === hoveredNpi)
            if (!hovered) return null
            const lat = hovered.practice.latitude
            const lng = hovered.practice.longitude
            if (lat == null || lng == null) return null
            const displayName = getPracticeDisplayName(hovered.practice)
            return (
              <Popup
                longitude={lng}
                latitude={lat}
                anchor="top"
                closeButton={false}
                closeOnClick={false}
                offset={10}
              >
                <div className="min-w-[200px] space-y-1 text-xs">
                  <p className="font-semibold text-[#1A1A1A]">{displayName}</p>
                  <p className="text-[#6B6B60]">
                    Score{" "}
                    <span className="font-mono font-semibold text-[#1A1A1A]">
                      {Math.round(hovered.displayScore)}
                    </span>{" "}
                    · {LAUNCHPAD_TIER_LABELS[hovered.displayTier]}
                  </p>
                  {hovered.practice.zip && (
                    <p className="text-[#707064]">
                      ZIP {hovered.practice.zip}
                      {hovered.practice.city ? ` · ${hovered.practice.city}` : ""}
                    </p>
                  )}
                  {hovered.dsoTier && (
                    <p className="text-[10px] uppercase tracking-wider text-[#707064]">
                      {hovered.dsoTier.toUpperCase()} DSO
                    </p>
                  )}
                </div>
              </Popup>
            )
          })()}
        </MapContainer>
        </PanelErrorBoundary>

        {/* Empty-data overlay — only when token is present (otherwise MapContainer shows its own fallback) */}
        {HAS_MAPBOX_TOKEN &&
          ((view === "zips" && zipAggregates.length === 0) ||
            (view === "practices" && practiceMarkers.length === 0)) && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#FAFAF7]/70 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <div className="pointer-events-auto flex max-w-[280px] flex-col items-center gap-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-4 py-3 text-center shadow-sm">
                <MapPinOff className="h-5 w-5 text-[#9C9C90]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#1A1A1A]">
                  {bundle === null
                    ? "Map data unavailable"
                    : view === "practices"
                      ? "No geocoded practices in scope"
                      : "No ZIP-level data in scope"}
                </p>
                <p className="text-[11px] text-[#6B6B60]">
                  {bundle === null
                    ? "Couldn't load the practice ranking. Try refreshing the page."
                    : view === "practices"
                      ? "Try the ZIP view, switch scope, or relax filters to see results."
                      : "Try a wider scope or switch to the practices view."}
                </p>
              </div>
            </div>
          )}

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex min-w-[240px] flex-col gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF]/95 px-3 py-2 text-[11px] shadow-sm">
          {activeLens === "tier" || view === "practices" ? (
            <>
              <p className="font-semibold uppercase tracking-wider text-[#707064]">
                {view === "practices" ? "Practice tier" : "Dominant tier in ZIP"}
              </p>
              <div className="grid grid-cols-5 gap-1">
                {LAUNCHPAD_TIERS.map((tier) => (
                  <div key={tier} className="flex flex-col items-center gap-0.5">
                    <span
                      className="h-3 w-3 rounded-full border border-white"
                      style={{ backgroundColor: TIER_COLORS[tier] }}
                      aria-hidden="true"
                    />
                    <span className="text-[10px] leading-tight text-[#6B6B60]">
                      {LAUNCHPAD_TIER_LABELS[tier]}
                    </span>
                    <span className="font-mono text-[10px] text-[#9C9C90]">
                      {formatNumber(tierCounts[tier] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : activeLens === "mentor_density" ? (
            <>
              <p className="font-semibold uppercase tracking-wider text-[#707064]">
                Mentor density
              </p>
              <div className="flex items-center gap-1">
                {MENTOR_COLORS.map((c, i) => (
                  <span
                    key={i}
                    className="h-3 flex-1 rounded-sm"
                    style={{ backgroundColor: c }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[#9C9C90]">
                <span>Few mentors</span>
                <span>Many mentors</span>
              </div>
              <p className="text-[10px] text-[#707064]">
                Mentor-rich = mentor_rich signal or 3+ providers
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold uppercase tracking-wider text-[#707064]">
                DSO avoid presence
              </p>
              <div className="flex items-center gap-1">
                {AVOID_COLORS.map((c, i) => (
                  <span
                    key={i}
                    className="h-3 flex-1 rounded-sm"
                    style={{ backgroundColor: c }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[#9C9C90]">
                <span>None</span>
                <span>High</span>
              </div>
              <p className="text-[10px] text-[#707064]">
                Aspen, Sage, Western, Smile Brands, Risas
              </p>
            </>
          )}
          <p className="text-[10px] text-[#707064]">
            {view === "practices"
              ? `Showing up to ${PRACTICE_DOT_LIMIT} geocoded practices`
              : `${zipAggregates.length} ZIPs with ranked targets`}
          </p>
        </div>

        {/* Selected ZIP panel */}
        {selectedZipAgg && view === "zips" && (
          <div className="absolute right-3 top-3 w-[272px] space-y-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3 text-xs shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#707064]">
                  Selected ZIP
                </p>
                <p className="text-sm font-semibold text-[#1A1A1A]">
                  {selectedZipAgg.zip}
                  {selectedZipAgg.city ? ` · ${selectedZipAgg.city}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectZip(null)}
                className="text-[#707064] hover:text-[#1A1A1A]"
                aria-label="Dismiss ZIP selection"
              >
                ×
              </button>
            </div>
            {onOpenZipDossier && (
              <button
                type="button"
                onClick={() => onOpenZipDossier(selectedZipAgg.zip)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-1.5 text-[11px] font-semibold text-[#B8860B] transition-colors hover:bg-[#B8860B]/20"
              >
                Open ZIP dossier →
              </button>
            )}
            <div className="rounded-md bg-[#FAFAF7] px-2 py-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6B6B60]">Practices</span>
                <span className="font-mono font-semibold text-[#1A1A1A]">
                  {selectedZipAgg.total}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6B6B60]">Best score</span>
                <span className="font-mono font-semibold text-[#1A1A1A]">
                  {Math.round(selectedZipAgg.bestScore)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6B6B60]">Dominant tier</span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: TIER_COLORS[selectedZipAgg.dominantTier] }}
                >
                  {LAUNCHPAD_TIER_LABELS[selectedZipAgg.dominantTier]}
                </span>
              </div>
              {activeLens === "mentor_density" && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6B60]">Mentor-rich</span>
                  <span className="font-mono font-semibold text-[#2D8B4E]">
                    {selectedZipAgg.mentorCount}
                  </span>
                </div>
              )}
              {activeLens === "dso_avoid" && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6B60]">Avoid-tier DSO</span>
                  <span className="font-mono font-semibold text-[#C23B3B]">
                    {selectedZipAgg.dsoAvoidCount}
                  </span>
                </div>
              )}
              {selectedZipAgg.metricsConfidence && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6B60]">Data confidence</span>
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color:
                        selectedZipAgg.metricsConfidence === "high"
                          ? "#2D8B4E"
                          : selectedZipAgg.metricsConfidence === "medium"
                            ? "#D4920B"
                            : "#C23B3B",
                    }}
                  >
                    {selectedZipAgg.metricsConfidence}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedZipAgg.bestFit > 0 && (
                <span className="rounded-full bg-[#2D8B4E]/10 px-1.5 py-0.5 text-[10px] text-[#2D8B4E]">
                  {selectedZipAgg.bestFit} best-fit
                </span>
              )}
              {selectedZipAgg.strong > 0 && (
                <span className="rounded-full bg-[#B8860B]/10 px-1.5 py-0.5 text-[10px] text-[#B8860B]">
                  {selectedZipAgg.strong} strong
                </span>
              )}
              {selectedZipAgg.maybe > 0 && (
                <span className="rounded-full bg-[#2563EB]/10 px-1.5 py-0.5 text-[10px] text-[#2563EB]">
                  {selectedZipAgg.maybe} maybe
                </span>
              )}
              {selectedZipAgg.low > 0 && (
                <span className="rounded-full bg-[#E8E5DE] px-1.5 py-0.5 text-[10px] text-[#6B6B60]">
                  {selectedZipAgg.low} low
                </span>
              )}
              {selectedZipAgg.avoid > 0 && (
                <span className="rounded-full bg-[#C23B3B]/10 px-1.5 py-0.5 text-[10px] text-[#C23B3B]">
                  {selectedZipAgg.avoid} avoid
                </span>
              )}
            </div>
            {selectedZipAgg.topTargets.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-[#707064]">
                  Top in ZIP
                </p>
                <ul className="space-y-1">
                  {selectedZipAgg.topTargets.map((target) => {
                    const name = getPracticeDisplayName(target.practice)
                    return (
                      <li key={target.npi}>
                        <button
                          type="button"
                          onClick={() => onSelectNpi(target.npi)}
                          className="w-full rounded border border-transparent px-1 py-0.5 text-left text-[#1A1A1A] transition-colors hover:border-[#B8860B]/30 hover:bg-[#B8860B]/5"
                        >
                          <span className="font-mono text-[11px] text-[#6B6B60]">
                            #{target.rank}
                          </span>{" "}
                          <span className="font-medium">{name}</span>{" "}
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: TIER_COLORS[target.displayTier] }}
                          >
                            {Math.round(target.displayScore)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
