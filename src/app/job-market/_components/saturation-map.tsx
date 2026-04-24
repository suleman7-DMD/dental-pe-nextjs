'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { ZIP_CENTROIDS } from '@/lib/constants/zip-centroids'
import type { ZipScore, WatchedZip } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface SaturationMapProps {
  zipScores: ZipScore[]
  watchedZips: WatchedZip[]
  centerLat: number
  centerLon: number
}

type MetricKey = 'dld' | 'buyable' | 'corporate'

interface MetricConfig {
  label: string
  shortLabel: string
  description: string
  field: keyof ZipScore
  /** Transform raw value to display value (e.g. * 100 for percentage) */
  transform: (v: number) => number
  /** Format for display in tooltip and legend */
  format: (v: number) => string
  /** Color interpolation: [min, mid, max] with green-yellow-red or reverse */
  colorStops: { value: number; color: [number, number, number] }[]
  /** Legend range labels */
  legendMin: string
  legendMax: string
  legendNote: string
}

// ────────────────────────────────────────────────────────────────────────────
// Metric configurations
// ────────────────────────────────────────────────────────────────────────────

const METRICS: Record<MetricKey, MetricConfig> = {
  dld: {
    label: 'Dental Density (DLD-GP/10k)',
    shortLabel: 'DLD-GP/10k',
    description: 'GP dental offices per 10,000 residents. National avg ~6.1. Lower = less competition.',
    field: 'dld_gp_per_10k',
    transform: (v) => v,
    format: (v) => v.toFixed(1),
    // Low DLD (green/good) -> mid (yellow) -> high DLD (red/saturated)
    colorStops: [
      { value: 0, color: [45, 139, 78] },     // #2D8B4E — green
      { value: 6, color: [212, 146, 11] },     // #D4920B — yellow/amber
      { value: 12, color: [194, 59, 59] },     // #C23B3B — red
    ],
    legendMin: '0',
    legendMax: '12+',
    legendNote: 'GP offices per 10k residents',
  },
  buyable: {
    label: 'Buyable Practice Ratio',
    shortLabel: 'Buyable %',
    description: '% of GP offices that are independently owned solos — potential acquisition targets. Higher = more opportunity.',
    field: 'buyable_practice_ratio',
    transform: (v) => v * 100,
    format: (v) => `${v.toFixed(0)}%`,
    // High buyable (green/good) -> mid (yellow) -> low buyable (red/limited)
    colorStops: [
      { value: 0, color: [194, 59, 59] },     // #C23B3B — red (low buyable = bad)
      { value: 35, color: [212, 146, 11] },    // #D4920B — yellow
      { value: 70, color: [45, 139, 78] },     // #2D8B4E — green (high buyable = good)
    ],
    legendMin: '0%',
    legendMax: '70%+',
    legendNote: '% of GP offices that are buyable solos',
  },
  corporate: {
    label: 'Corporate Share',
    shortLabel: 'Corporate %',
    description: '% of GP offices classified as DSO/PE-affiliated. Higher = more consolidated market.',
    field: 'corporate_share_pct',
    transform: (v) => v * 100,
    format: (v) => `${v.toFixed(0)}%`,
    // Low corporate (green/good) -> mid (yellow) -> high corporate (red/consolidated)
    colorStops: [
      { value: 0, color: [45, 139, 78] },     // #2D8B4E — green
      { value: 15, color: [212, 146, 11] },    // #D4920B — yellow
      { value: 35, color: [194, 59, 59] },     // #C23B3B — red
    ],
    legendMin: '0%',
    legendMax: '35%+',
    legendNote: '% of GP offices that are DSO/PE-affiliated',
  },
}

const METRIC_KEYS: MetricKey[] = ['dld', 'buyable', 'corporate']

// ────────────────────────────────────────────────────────────────────────────
// Color interpolation helper
// ────────────────────────────────────────────────────────────────────────────

function interpolateColor(
  value: number,
  stops: { value: number; color: [number, number, number] }[]
): [number, number, number] {
  if (stops.length === 0) return [128, 128, 128]
  if (value <= stops[0].value) return stops[0].color
  if (value >= stops[stops.length - 1].value) return stops[stops.length - 1].color

  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i]
    const hi = stops[i + 1]
    if (value >= lo.value && value <= hi.value) {
      const t = (value - lo.value) / (hi.value - lo.value)
      return [
        Math.round(lo.color[0] + (hi.color[0] - lo.color[0]) * t),
        Math.round(lo.color[1] + (hi.color[1] - lo.color[1]) * t),
        Math.round(lo.color[2] + (hi.color[2] - lo.color[2]) * t),
      ]
    }
  }

  return stops[stops.length - 1].color
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// ────────────────────────────────────────────────────────────────────────────
// Marker size from GP locations (sqrt scale, clamped)
// ────────────────────────────────────────────────────────────────────────────

function markerSize(gpLocations: number): number {
  return Math.max(7, Math.min(22, 5 + Math.sqrt(gpLocations) * 1.4))
}

// ────────────────────────────────────────────────────────────────────────────
// Inner map component (re-creates mapbox on data/metric change)
// ────────────────────────────────────────────────────────────────────────────

function SaturationMapInner({
  mapData,
  metric,
  centerLat,
  centerLon,
}: {
  mapData: Array<{
    zip: string
    city: string
    lat: number
    lon: number
    gpLocations: number
    dldVal: number | null
    buyableVal: number | null
    corporateVal: number | null
    confidence: string
    size: number
    color: string
    opacity: number
    displayValue: string
    population: string
  }>
  metric: MetricKey
  centerLat: number
  centerLon: number
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapData.length === 0) return

    let map: mapboxgl.Map | null = null

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      await import('mapbox-gl/dist/mapbox-gl.css')
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

      map = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [centerLon, centerLat],
        zoom: 9,
        attributionControl: false,
      })
      mapObjRef.current = map
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      map.on('load', () => {
        if (!map) return

        const cfg = METRICS[metric]

        // Build GeoJSON
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: mapData.map((d) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [d.lon, d.lat] },
            properties: {
              zip: d.zip,
              city: d.city,
              gpLocations: d.gpLocations,
              dldVal: d.dldVal != null ? d.dldVal.toFixed(1) : '--',
              buyableVal: d.buyableVal != null ? `${d.buyableVal.toFixed(0)}%` : '--',
              corporateVal: d.corporateVal != null ? `${d.corporateVal.toFixed(0)}%` : '--',
              confidence: d.confidence,
              size: d.size,
              color: d.color,
              opacity: d.opacity,
              displayValue: d.displayValue,
              population: d.population,
            },
          })),
        }

        map.addSource('saturation-markers', { type: 'geojson', data: geojson })

        // Circle layer
        map.addLayer({
          id: 'saturation-circles',
          type: 'circle',
          source: 'saturation-markers',
          paint: {
            'circle-radius': ['get', 'size'],
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.7)',
          },
        })

        // Labels for larger ZIPs
        const labelThreshold = mapData.length > 50 ? 25 : 10
        const labelFeatures: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: mapData
            .filter(d => d.gpLocations >= labelThreshold)
            .map(d => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [d.lon, d.lat + 0.012] },
              properties: {
                label: `${d.displayValue}`,
              },
            })),
        }

        map.addSource('saturation-labels', { type: 'geojson', data: labelFeatures })
        map.addLayer({
          id: 'saturation-label-text',
          type: 'symbol',
          source: 'saturation-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-anchor': 'bottom',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#3D3D35',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
        })

        // Popup on hover
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '300px',
        })

        map.on('mouseenter', 'saturation-circles', (e) => {
          if (!map || !e.features?.[0]) return
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features[0].properties!
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]

          // Bold the active metric
          const dldBold = metric === 'dld' ? 'font-weight:700' : ''
          const buyBold = metric === 'buyable' ? 'font-weight:700' : ''
          const corpBold = metric === 'corporate' ? 'font-weight:700' : ''

          popup
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.6;background:#FFFFFF;color:#1A1A1A;border:1px solid #E8E5DE;border-radius:8px;padding:10px 14px;margin:-10px -14px">
                <strong style="font-size:14px;color:#1A1A1A">${props.city}</strong>
                <span style="color:#9C9C90"> &middot; ${props.zip}</span><br/>
                <span style="color:#6B6B60">Pop:</span> <span>${props.population}</span>
                <span style="color:#6B6B60"> &middot; GP Offices:</span> <strong>${props.gpLocations}</strong><br/>
                <span style="color:#6B6B60;${dldBold}">DLD-GP/10k:</span> <span style="${dldBold}">${props.dldVal}</span><br/>
                <span style="color:#6B6B60;${buyBold}">Buyable %:</span> <span style="${buyBold}">${props.buyableVal}</span><br/>
                <span style="color:#6B6B60;${corpBold}">Corporate %:</span> <span style="${corpBold}">${props.corporateVal}</span><br/>
                <span style="color:#9C9C90;font-size:10px">Confidence: ${props.confidence}</span>
              </div>`
            )
            .addTo(map)
        })

        map.on('mouseleave', 'saturation-circles', () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          popup.remove()
        })
      })
    }

    initMap()
    return () => {
      if (map) map.remove()
      mapObjRef.current = null
    }
  }, [mapData, metric, centerLat, centerLon])

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-[#E8E5DE] overflow-hidden"
      style={{ height: 520, boxShadow: '0 0 40px rgba(184, 134, 11, 0.06), 0 4px 24px rgba(0, 0, 0, 0.08)' }}
    />
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function SaturationMap({
  zipScores,
  watchedZips,
  centerLat,
  centerLon,
}: SaturationMapProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('dld')
  const cfg = METRICS[activeMetric]

  // Lookup watched zips for population
  const wzMap = useMemo(() => {
    const m = new Map<string, WatchedZip>()
    for (const wz of watchedZips) m.set(wz.zip_code, wz)
    return m
  }, [watchedZips])

  // Build map data for all ZIPs with valid coordinates
  const mapData = useMemo(() => {
    return zipScores
      .map((zs) => {
        const coords = ZIP_CENTROIDS[zs.zip_code]
        if (!coords) return null

        const rawVal = zs[cfg.field] as number | null
        const transformedVal = rawVal != null ? cfg.transform(rawVal) : null

        const gpLocations = zs.total_gp_locations ?? 0
        if (gpLocations === 0) return null

        // Color from metric value
        const color = transformedVal != null
          ? interpolateColor(transformedVal, cfg.colorStops)
          : [180, 180, 170] as [number, number, number] // muted gray for missing data

        // Opacity: lower for low-confidence or missing data
        const confidence = zs.metrics_confidence ?? 'low'
        const hasData = transformedVal != null
        const opacity = !hasData ? 0.35 : confidence === 'low' ? 0.55 : 0.85

        const wz = wzMap.get(zs.zip_code)

        return {
          zip: zs.zip_code,
          city: zs.city ?? '',
          lat: coords[0],
          lon: coords[1],
          gpLocations,
          dldVal: zs.dld_gp_per_10k,
          buyableVal: zs.buyable_practice_ratio != null ? zs.buyable_practice_ratio * 100 : null,
          corporateVal: zs.corporate_share_pct != null ? zs.corporate_share_pct * 100 : null,
          confidence: confidence.charAt(0).toUpperCase() + confidence.slice(1),
          size: markerSize(gpLocations),
          color: rgbToHex(...color),
          opacity,
          displayValue: transformedVal != null ? cfg.format(transformedVal) : '--',
          population: wz?.population != null ? wz.population.toLocaleString() : '--',
        }
      })
      .filter(Boolean) as Array<{
      zip: string
      city: string
      lat: number
      lon: number
      gpLocations: number
      dldVal: number | null
      buyableVal: number | null
      corporateVal: number | null
      confidence: string
      size: number
      color: string
      opacity: number
      displayValue: string
      population: string
    }>
  }, [zipScores, wzMap, cfg, activeMetric])

  // Summary stats for the current metric
  const summary = useMemo(() => {
    const vals = mapData
      .map((d) => {
        if (activeMetric === 'dld') return d.dldVal
        if (activeMetric === 'buyable') return d.buyableVal
        if (activeMetric === 'corporate') return d.corporateVal
        return null
      })
      .filter((v): v is number => v != null)

    if (vals.length === 0) return null

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    return { avg, min, max, count: vals.length }
  }, [mapData, activeMetric])

  // Build gradient CSS for legend
  const gradientCss = useMemo(() => {
    const stops = cfg.colorStops.map((s) => rgbToHex(...s.color))
    return `linear-gradient(to right, ${stops.join(', ')})`
  }, [cfg])

  if (zipScores.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Saturation Metrics Map"
        helpText="Each dot = one watched ZIP. Size = number of GP offices. Color = selected metric value. Toggle between Density, Buyable %, and Corporate % to visualize different market dimensions. Faded dots = low data confidence or missing metric."
      />

      {/* Metric toggle */}
      <div className="flex items-center gap-1 mb-3 p-1 rounded-lg bg-[#F5F5F0] w-fit">
        {METRIC_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveMetric(key)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeMetric === key
                ? 'bg-[#FFFFFF] text-[#B8860B] shadow-sm border border-[#E8E5DE]'
                : 'text-[#6B6B60] hover:text-[#1A1A1A]'
            }`}
          >
            {METRICS[key].shortLabel}
          </button>
        ))}
      </div>

      {/* Metric description */}
      <p className="text-xs text-[#6B6B60] mb-3">
        {cfg.description}
      </p>

      {mapData.length > 0 ? (
        <>
          <SaturationMapInner
            mapData={mapData}
            metric={activeMetric}
            centerLat={centerLat}
            centerLon={centerLon}
          />

          {/* Legend + summary row */}
          <div className="mt-3 flex flex-col gap-2">
            {/* Color bar legend */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6B6B60] min-w-[28px] text-right">{cfg.legendMin}</span>
              <div
                className="flex-1 h-2.5 rounded-full max-w-sm"
                style={{ background: gradientCss }}
              />
              <span className="text-[10px] text-[#6B6B60] min-w-[28px]">{cfg.legendMax}</span>
              <span className="text-[10px] text-[#707064] ml-1">{cfg.legendNote}</span>
            </div>

            {/* Size legend + dot legend */}
            <div className="flex flex-wrap items-center gap-6">
              <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B60]">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#B4B4AA] opacity-40" />
                No data / low confidence
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B60]">
                <span className="inline-block w-2 h-2 rounded-full border border-[#D4D0C8] bg-[#9C9C90]" />
                Small ZIP
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B60]">
                <span className="inline-block w-4 h-4 rounded-full border border-[#D4D0C8] bg-[#9C9C90]" />
                Large ZIP
              </span>
              <span className="text-[11px] text-[#707064]">
                Circle size = GP office count
              </span>
            </div>

            {/* Summary stats */}
            {summary && (
              <div className="flex items-center gap-4 text-[11px] text-[#6B6B60]">
                <span>
                  <strong className="text-[#1A1A1A]">{summary.count}</strong> ZIPs with data
                </span>
                <span>
                  Avg: <strong className="text-[#1A1A1A] font-mono">{cfg.format(summary.avg)}</strong>
                </span>
                <span>
                  Min: <strong className="text-[#1A1A1A] font-mono">{cfg.format(summary.min)}</strong>
                </span>
                <span>
                  Max: <strong className="text-[#1A1A1A] font-mono">{cfg.format(summary.max)}</strong>
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60] text-sm">
          No ZIP coordinates available for map display.
        </div>
      )}
    </div>
  )
}
