"use client"

import { useMemo, useState } from "react"
import { Marker, Popup } from "react-map-gl/mapbox"
import { MapContainer } from "@/components/maps/map-container"
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

export type LaunchpadMapView = "practices" | "zips"

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

const PRACTICE_DOT_LIMIT = 250

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
  dominantTier: LaunchpadTier
  bestScore: number
  topTargets: LaunchpadRankedTarget[]
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

  const scopeOption = getLaunchpadScopeOption(scope)
  const rankedTargets = bundle?.rankedTargets ?? []

  const mapCenter: [number, number] = useMemo(
    () => [scopeOption.centerLat, scopeOption.centerLon],
    [scopeOption.centerLat, scopeOption.centerLon]
  )

  const mapZoom = scope === "all_chicagoland" ? 9 : 10

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
          dominantTier: "low",
          bestScore: 0,
          topTargets: [],
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

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]",
        className
      )}
      aria-label="Launchpad living map"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Living Map</h2>
          <p className="text-xs text-[#707064]">
            {view === "practices"
              ? `Top ${practiceMarkers.length.toLocaleString()} practices colored by fit tier`
              : `${zipAggregates.length.toLocaleString()} ZIPs colored by dominant tier · sized by practice count`}
          </p>
        </div>
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
      </header>

      <div className="relative">
        <MapContainer height={height} zoom={mapZoom} center={mapCenter}>
          {view === "zips" &&
            zipAggregates.map((agg) => {
              const selected = selectedZip === agg.zip
              const hovered = hoveredZip === agg.zip
              const sizeBase = 16 + Math.sqrt(agg.total / maxZipTotal) * 28
              const size = selected ? sizeBase + 4 : sizeBase
              const color = TIER_COLORS[agg.dominantTier]
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
                    aria-label={`ZIP ${agg.zip} — ${agg.total} practices, dominant tier ${LAUNCHPAD_TIER_LABELS[agg.dominantTier]}`}
                    title={`${agg.zip} · ${agg.total} practices · ${LAUNCHPAD_TIER_LABELS[agg.dominantTier]}`}
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
                    aria-label={`${target.practice.practice_name ?? target.practice.doing_business_as ?? `NPI ${target.npi}`} — score ${Math.round(target.displayScore)}`}
                    title={`${target.practice.practice_name ?? target.practice.doing_business_as ?? target.npi} · ${Math.round(target.displayScore)} · ${LAUNCHPAD_TIER_LABELS[target.displayTier]}`}
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
            const displayName =
              hovered.practice.doing_business_as ??
              hovered.practice.practice_name ??
              `NPI ${hovered.npi}`
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

        <div className="pointer-events-none absolute bottom-3 left-3 flex min-w-[240px] flex-col gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FFFFFF]/95 px-3 py-2 text-[11px] shadow-sm">
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
          <p className="text-[10px] text-[#707064]">
            {view === "practices"
              ? `Showing up to ${PRACTICE_DOT_LIMIT} geocoded practices`
              : `${zipAggregates.length} ZIPs with ranked targets`}
          </p>
        </div>

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
                    const name =
                      target.practice.doing_business_as ??
                      target.practice.practice_name ??
                      `NPI ${target.npi}`
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
