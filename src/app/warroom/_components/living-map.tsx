"use client"

import { useMemo, useState } from "react"
import { Layer, Source, Marker, Popup } from "react-map-gl/mapbox"
import type { FeatureCollection, Feature, Point } from "geojson"
import { MapContainer } from "@/components/maps/map-container"
import { ZIP_CENTROIDS } from "@/lib/constants/zip-centroids"
import { cn } from "@/lib/utils"
import { formatNumber, formatPercent } from "@/lib/utils/formatting"
import {
  WARROOM_LENSES,
  getWarroomLensLabel,
  type WarroomLens,
} from "@/lib/warroom/mode"
import type {
  RankedTarget,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "@/lib/warroom/signals"

interface LivingMapProps {
  lens: WarroomLens
  onLensChange: (lens: WarroomLens) => void
  zipScores: WarroomZipScoreRecord[]
  zipSignals: WarroomZipSignalRecord[]
  rankedTargets: RankedTarget[]
  selectedZip: string | null
  onZipSelect: (zip: string | null) => void
  onTargetSelect?: (npi: string) => void
  onZipDossierOpen?: (zip: string) => void
  height?: number
  className?: string
}

interface LensComputation {
  label: string
  unit: string
  description: string
  get: (args: {
    zipScore: WarroomZipScoreRecord | null
    zipSignal: WarroomZipSignalRecord | null
  }) => number | null
  invertScale?: boolean
  format: (value: number | null) => string
}

const LENS_COMPUTATIONS: Record<WarroomLens, LensComputation> = {
  consolidation: {
    label: "Corporate share",
    unit: "%",
    description: "dso_regional + dso_national share of GP locations.",
    get: ({ zipScore }) => zipScore?.corporate_share_pct ?? null,
    format: (value) => (value == null ? "--" : formatPercent(value)),
  },
  density: {
    label: "Density",
    unit: "/10k",
    description: "GP dental offices per 10,000 residents. National avg ~6.1.",
    get: ({ zipScore }) => zipScore?.dld_gp_per_10k ?? null,
    format: (value) => (value == null ? "--" : formatNumber(value)),
  },
  buyability: {
    label: "Buyable ratio",
    unit: "%",
    description: "% of GP offices classified as solo_established/solo_inactive/solo_high_volume.",
    get: ({ zipScore }) => zipScore?.buyable_practice_ratio ?? null,
    format: (value) => (value == null ? "--" : formatPercent(value)),
  },
  retirement: {
    label: "Retirement combos",
    unit: "practices",
    description: "Practices with high retirement combo score.",
    get: ({ zipSignal }) => zipSignal?.retirement_combo_high_count ?? null,
    format: (value) => (value == null ? "--" : formatNumber(value)),
  },
  pe_exposure: {
    label: "Deal catchment (24mo)",
    unit: "deals",
    description: "Aggregated nearby PE deals in last 24 months.",
    get: ({ zipSignal }) => zipSignal?.deal_catchment_sum_24mo ?? null,
    format: (value) => (value == null ? "--" : formatNumber(value)),
  },
  saturation: {
    label: "People per GP door",
    unit: "residents",
    description: "Population / GP locations. Higher = thinner coverage → less saturated.",
    get: ({ zipScore }) => zipScore?.people_per_gp_door ?? null,
    invertScale: true,
    format: (value) => (value == null ? "--" : formatNumber(value)),
  },
  whitespace: {
    label: "White-space score",
    unit: "/100",
    description: "High demand, low supply composite score.",
    get: ({ zipSignal }) => zipSignal?.white_space_score ?? null,
    format: (value) => (value == null ? "--" : formatNumber(value)),
  },
  disagreement: {
    label: "Intel disagreements",
    unit: "practices",
    description: "Practices where intel and quant signals diverge.",
    get: ({ zipSignal }) => zipSignal?.intel_quant_disagreement_count ?? null,
    format: (value) => (value == null ? "--" : formatNumber(value)),
  },
}

interface ZipMarker {
  zip: string
  lat: number
  lng: number
  value: number | null
  zipScore: WarroomZipScoreRecord | null
  zipSignal: WarroomZipSignalRecord | null
}

const LENS_COLOR_STOPS: [string, string, string] = ["#2D8B4E", "#D4920B", "#C23B3B"]

function colorForNormalized(normalized: number): string {
  const clamped = Math.max(0, Math.min(1, normalized))
  if (clamped < 0.5) {
    const t = clamped / 0.5
    return interpolateColor(LENS_COLOR_STOPS[0], LENS_COLOR_STOPS[1], t)
  }
  const t = (clamped - 0.5) / 0.5
  return interpolateColor(LENS_COLOR_STOPS[1], LENS_COLOR_STOPS[2], t)
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

function interpolateColor(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export function LivingMap({
  lens,
  onLensChange,
  zipScores,
  zipSignals,
  rankedTargets,
  selectedZip,
  onZipSelect,
  onTargetSelect,
  onZipDossierOpen,
  height = 560,
  className,
}: LivingMapProps) {
  const computation = LENS_COMPUTATIONS[lens]
  const [hoveredZip, setHoveredZip] = useState<string | null>(null)

  const { markers, minValue, maxValue } = useMemo(() => {
    const zipScoreByZip = new Map(zipScores.map((row) => [row.zip_code, row] as const))
    const zipSignalByZip = new Map(zipSignals.map((row) => [row.zip_code, row] as const))
    const allZips = new Set<string>([...zipScoreByZip.keys(), ...zipSignalByZip.keys()])

    const entries: ZipMarker[] = []
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    allZips.forEach((zip) => {
      const coords = ZIP_CENTROIDS[zip]
      if (!coords) return
      const [lat, lng] = coords
      const zipScore = zipScoreByZip.get(zip) ?? null
      const zipSignal = zipSignalByZip.get(zip) ?? null
      const value = computation.get({ zipScore, zipSignal })
      if (value != null && Number.isFinite(value)) {
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
      entries.push({ zip, lat, lng, value, zipScore, zipSignal })
    })

    return {
      markers: entries,
      minValue: Number.isFinite(min) ? min : 0,
      maxValue: Number.isFinite(max) ? max : 1,
    }
  }, [computation, zipScores, zipSignals])

  const normalize = (value: number | null): number => {
    if (value == null || !Number.isFinite(value)) return 0
    const range = maxValue - minValue
    if (range === 0) return 0.5
    const normalized = (value - minValue) / range
    return computation.invertScale ? 1 - normalized : normalized
  }

  const targetsGeoJson: FeatureCollection<Point> = useMemo(() => {
    const features: Feature<Point>[] = rankedTargets
      .filter((target) => target.latitude != null && target.longitude != null)
      .slice(0, 150)
      .map((target) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [target.longitude ?? 0, target.latitude ?? 0],
        },
        properties: {
          npi: target.npi,
          name: target.practiceName,
          score: target.score,
          tier: target.tier,
        },
      }))
    return { type: "FeatureCollection", features }
  }, [rankedTargets])

  const legendStops = [0, 0.25, 0.5, 0.75, 1]

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]",
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Living Map</h2>
          <p className="text-xs text-[#707064]">{computation.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {WARROOM_LENSES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onLensChange(option.id)}
              className={cn(
                "h-7 rounded-md border px-2 text-[11px] font-medium transition-colors",
                lens === option.id
                  ? "border-[#B8860B] bg-[#B8860B]/10 text-[#B8860B]"
                  : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:border-[#D4D0C8] hover:text-[#1A1A1A]"
              )}
              aria-pressed={lens === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="relative">
        <MapContainer height={height} zoom={9} center={[41.83, -87.95]}>
          {markers.map((marker) => {
            const normalized = normalize(marker.value)
            const color = marker.value != null ? colorForNormalized(normalized) : "#B5B5A8"
            const size = 14 + normalized * 22
            const selected = selectedZip === marker.zip
            const hovered = hoveredZip === marker.zip
            return (
              <Marker
                key={marker.zip}
                longitude={marker.lng}
                latitude={marker.lat}
                anchor="center"
              >
                <button
                  type="button"
                  onClick={() =>
                    onZipSelect(selectedZip === marker.zip ? null : marker.zip)
                  }
                  onMouseEnter={() => setHoveredZip(marker.zip)}
                  onMouseLeave={() => setHoveredZip((current) => (current === marker.zip ? null : current))}
                  className={cn(
                    "rounded-full border-2 transition-transform",
                    selected ? "ring-2 ring-[#B8860B] ring-offset-1" : "",
                    hovered ? "scale-110" : ""
                  )}
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: color,
                    borderColor: "#FFFFFF",
                    opacity: marker.value == null ? 0.45 : 0.85,
                  }}
                  aria-label={`ZIP ${marker.zip} — ${computation.label}: ${computation.format(marker.value)}`}
                  title={`${marker.zip} · ${computation.label}: ${computation.format(marker.value)}`}
                />
              </Marker>
            )
          })}

          {hoveredZip && !selectedZip && (() => {
            const hovered = markers.find((m) => m.zip === hoveredZip)
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
                <div className="min-w-[180px] space-y-1 text-xs">
                  <p className="font-semibold text-[#1A1A1A]">
                    ZIP {hovered.zip}
                    {hovered.zipScore?.city ? ` · ${hovered.zipScore.city}` : ""}
                  </p>
                  <p className="text-[#6B6B60]">
                    {computation.label}:{" "}
                    <span className="font-mono font-semibold text-[#1A1A1A]">
                      {computation.format(hovered.value)}
                    </span>
                  </p>
                  {hovered.zipScore?.total_gp_locations != null && (
                    <p className="text-[#707064]">
                      {formatNumber(hovered.zipScore.total_gp_locations)} GP locations
                    </p>
                  )}
                </div>
              </Popup>
            )
          })()}

          {targetsGeoJson.features.length > 0 && (
            <Source id="warroom-targets" type="geojson" data={targetsGeoJson}>
              <Layer
                id="warroom-target-halo"
                type="circle"
                paint={{
                  "circle-radius": 5,
                  "circle-color": [
                    "match",
                    ["get", "tier"],
                    "hot", "#C23B3B",
                    "warm", "#D4920B",
                    "cool", "#2563EB",
                    "#6B6B60",
                  ],
                  "circle-opacity": 0.35,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#1A1A1A",
                  "circle-stroke-opacity": 0.25,
                }}
              />
            </Source>
          )}
        </MapContainer>

        <div className="pointer-events-none absolute bottom-3 left-3 flex min-w-[220px] flex-col gap-1 rounded-md border border-[#E8E5DE] bg-[#FFFFFF]/95 px-3 py-2 text-[11px] shadow-sm">
          <p className="font-semibold uppercase tracking-wider text-[#707064]">
            {getWarroomLensLabel(lens)}
          </p>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[#6B6B60]">{computation.format(minValue)}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, ${legendStops
                    .map((stop) => colorForNormalized(stop))
                    .join(", ")})`,
                }}
              />
            </div>
            <span className="font-mono text-[#6B6B60]">{computation.format(maxValue)}</span>
          </div>
          <p className="text-[10px] text-[#707064]">
            {markers.length} ZIPs · {targetsGeoJson.features.length} target pins
          </p>
        </div>

        {selectedZip && (() => {
          const selected = markers.find((m) => m.zip === selectedZip)
          if (!selected) return null
          const topTargets = rankedTargets.filter((target) => target.zip === selectedZip).slice(0, 5)
          return (
            <div className="absolute right-3 top-3 w-[260px] space-y-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3 text-xs shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#707064]">Selected ZIP</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {selected.zip}
                    {selected.zipScore?.city ? ` · ${selected.zipScore.city}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onZipSelect(null)}
                  className="text-[#707064] hover:text-[#1A1A1A]"
                  aria-label="Dismiss ZIP selection"
                >
                  ×
                </button>
              </div>
              {onZipDossierOpen && (
                <button
                  type="button"
                  onClick={() => onZipDossierOpen(selected.zip)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-1.5 text-[11px] font-semibold text-[#B8860B] transition-colors hover:bg-[#B8860B]/20"
                >
                  Open ZIP dossier →
                </button>
              )}
              <div className="rounded-md bg-[#FAFAF7] px-2 py-1">
                <p className="text-[#6B6B60]">
                  {computation.label}:{" "}
                  <span className="font-mono font-semibold text-[#1A1A1A]">
                    {computation.format(selected.value)}
                  </span>
                </p>
              </div>
              {selected.zipScore?.opportunity_score != null && (
                <p className="text-[#6B6B60]">
                  Opportunity score:{" "}
                  <span className="font-mono text-[#1A1A1A]">
                    {formatNumber(selected.zipScore.opportunity_score)}/100
                  </span>
                </p>
              )}
              {selected.zipSignal?.compound_demand_flag && (
                <p className="rounded bg-[#2D8B4E]/10 px-2 py-1 text-[#2D8B4E]">
                  Compound demand flag active
                </p>
              )}
              {selected.zipSignal?.white_space_flag && (
                <p className="rounded bg-[#2563EB]/10 px-2 py-1 text-[#2563EB]">
                  White-space flag active
                </p>
              )}
              {topTargets.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-[#707064]">
                    Top targets in ZIP
                  </p>
                  <ul className="space-y-1">
                    {topTargets.map((target) => (
                      <li key={target.npi}>
                        <button
                          type="button"
                          onClick={() => onTargetSelect?.(target.npi)}
                          className="w-full rounded border border-transparent px-1 py-0.5 text-left text-[#1A1A1A] transition-colors hover:border-[#B8860B]/30 hover:bg-[#B8860B]/5"
                        >
                          <span className="font-mono text-[11px] text-[#6B6B60]">
                            #{target.rank}
                          </span>{" "}
                          <span className="font-medium">{target.practiceName}</span>{" "}
                          <span className="font-mono text-[11px] text-[#6B6B60]">
                            {target.score}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </section>
  )
}
