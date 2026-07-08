'use client'

import { useEffect, useRef, useMemo } from 'react'
import type mapboxgl from 'mapbox-gl'
import { SectionHeader } from '@/components/data-display/section-header'
import { ZIP_CENTROIDS, METRO_CENTERS } from '@/lib/constants/zip-centroids'
import { BUCKET_META } from '@/lib/census/ownership-truth'
import { tallyBucketCount, type ZipCensusTally } from '@/lib/census/zip-census'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import { escapeHtml } from '@/lib/utils/escape-html'

interface ConsolidationMapProps {
  zipScores: ZipScore[]
  selectedMetro: string
  tallies: ZipCensusTally[]
}

/** Dot color for a ZIP with zero census-reviewed locations — explicitly neutral. */
const UNREVIEWED_GRAY = '#A9A79C'

/**
 * Interpolate the census-documented DSO/PE floor (0-30+%) into a cream-amber-red
 * ramp. The low end is NEUTRAL cream, not green — a 0% floor means "no documented
 * DSO/PE yet", which is not a claim of independence while coverage is partial.
 * 0% = #EDE8DC, 15% = #D4920B, 30%+ = #C23B3B.
 */
function censusFloorColor(pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 30)
  const ratio = clamped / 30

  if (ratio <= 0.5) {
    // Cream to amber
    const t = ratio / 0.5
    const r = Math.round(237 + (212 - 237) * t)
    const g = Math.round(232 + (146 - 232) * t)
    const b = Math.round(220 + (11 - 220) * t)
    return `rgb(${r},${g},${b})`
  } else {
    // Amber to red
    const t = (ratio - 0.5) / 0.5
    const r = Math.round(212 + (194 - 212) * t)
    const g = Math.round(146 + (59 - 146) * t)
    const b = Math.round(11 + (59 - 11) * t)
    return `rgb(${r},${g},${b})`
  }
}

/**
 * Compute marker size using sqrt scale, clamped to [7, 24].
 */
function markerSize(totalPractices: number): number {
  return Math.max(7, Math.min(24, 5 + Math.sqrt(totalPractices) * 1.3))
}

export function ConsolidationMap({ zipScores, selectedMetro, tallies }: ConsolidationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)

  const tallyByZip = useMemo(() => {
    const map = new Map<string, ZipCensusTally>()
    for (const t of tallies) map.set(t.zip, t)
    return map
  }, [tallies])

  // Build map data — only ZIPs with valid coordinates
  const mapData = useMemo(() => {
    return zipScores
      .map(zs => {
        const coords = ZIP_CENTROIDS[zs.zip_code]
        if (!coords) return null

        const tally = tallyByZip.get(zs.zip_code)

        // GP clinic denominator: zip_scores GP-location count, falling back to
        // tracked census rows. Specialist locations never size/color the map.
        const universe = zs.total_gp_locations
          ?? tally?.rows
          ?? Math.max(0, (zs.total_practices ?? 0) - (zs.total_specialist_locations ?? 0))

        const reviewed = tally?.reviewed ?? 0
        const soloOwner = tally ? tallyBucketCount(tally, 'true_solo_owner_operated') : 0
        const dentistOwned = tally ? tallyBucketCount(tally, 'dentist_owned_not_solo') : 0
        const dsoPe = tally ? tallyBucketCount(tally, 'dso_pe_corporate') : 0
        const institutional = tally ? tallyBucketCount(tally, 'institutional') : 0
        const unresolved = Math.max(universe - reviewed, 0)

        // Census-documented DSO/PE floor: reviewed T4+T5 over ALL GP clinics in
        // the ZIP. A floor by construction — unreviewed clinics add nothing.
        const floorPct = universe > 0 ? (dsoPe / universe) * 100 : 0
        const coveragePct = universe > 0 ? (reviewed / universe) * 100 : 0

        const isUnreviewed = reviewed === 0

        return {
          zip: zs.zip_code,
          city: zs.city ?? '',
          lat: coords[0],
          lon: coords[1],
          universe,
          reviewed,
          soloOwner,
          dentistOwned,
          dsoPe,
          institutional,
          unresolved,
          floorPct,
          coveragePct,
          opacity: isUnreviewed ? 0.45 : coveragePct < 25 ? 0.6 : 0.9,
          size: markerSize(universe),
          color: isUnreviewed ? UNREVIEWED_GRAY : censusFloorColor(floorPct),
        }
      })
      .filter(Boolean) as Array<{
      zip: string
      city: string
      lat: number
      lon: number
      universe: number
      reviewed: number
      soloOwner: number
      dentistOwned: number
      dsoPe: number
      institutional: number
      unresolved: number
      floorPct: number
      coveragePct: number
      opacity: number
      size: number
      color: string
    }>
  }, [zipScores, tallyByZip])

  // Compute map center
  const center = useMemo(() => {
    const metroKey = selectedMetro
    if (metroKey && METRO_CENTERS[metroKey]) {
      return METRO_CENTERS[metroKey]
    }
    if (mapData.length === 0) return { lat: 41.8, lon: -87.85, zoom: 9 }
    const avgLat = mapData.reduce((s, d) => s + d.lat, 0) / mapData.length
    const avgLon = mapData.reduce((s, d) => s + d.lon, 0) / mapData.length
    return { lat: avgLat, lon: avgLon, zoom: 9 }
  }, [mapData, selectedMetro])

  // Label threshold — only show labels for notable ZIPs
  const labelThreshold = mapData.length > 50 ? 25 : 15

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
        center: [center.lon, center.lat],
        zoom: center.zoom,
        attributionControl: false,
      })

      mapInstanceRef.current = map

      map.on('load', () => {
        if (!map) return

        // Add source with GeoJSON
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: mapData.map(d => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
            properties: {
              zip: d.zip,
              city: d.city,
              universe: d.universe,
              reviewed: d.reviewed,
              soloOwner: d.soloOwner,
              dentistOwned: d.dentistOwned,
              dsoPe: d.dsoPe,
              institutional: d.institutional,
              unresolved: d.unresolved,
              floorPct: d.floorPct,
              coveragePct: d.coveragePct,
              size: d.size,
              color: d.color,
              opacity: d.opacity,
            },
          })),
        }

        map.addSource('zip-markers', { type: 'geojson', data: geojson })

        // Circle layer for markers
        map.addLayer({
          id: 'zip-circles',
          type: 'circle',
          source: 'zip-markers',
          paint: {
            'circle-radius': ['get', 'size'],
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(0,0,0,0.15)',
          },
        })

        // Labels for notable ZIPs
        const labelFeatures: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: mapData
            .filter(d => d.universe >= labelThreshold)
            .map(d => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [d.lon, d.lat + 0.015] },
              properties: {
                label: `${d.city} (${d.universe})`,
              },
            })),
        }

        map.addSource('zip-labels', { type: 'geojson', data: labelFeatures })
        map.addLayer({
          id: 'zip-label-text',
          type: 'symbol',
          source: 'zip-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-anchor': 'bottom',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#3D3D35',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          },
        })

        // Tooltip popup
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '320px',
        })

        map.on('mouseenter', 'zip-circles', e => {
          if (!map || !e.features || e.features.length === 0) return
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features[0].properties!
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          const floorPctVal = Number(props.floorPct)
          const reviewedVal = Number(props.reviewed)
          const coverageVal = Number(props.coveragePct)

          const censusLines = reviewedVal > 0
            ? `<span style="color:#2563EB">${escapeHtml(props.soloOwner)} solo owner-op</span> |
               <span style="color:#0D9488">${escapeHtml(props.dentistOwned)} dentist-owned</span> |
               <span style="color:#C23B3B">${escapeHtml(props.dsoPe)} DSO/PE</span> |
               <span style="color:#6B7280">${escapeHtml(props.institutional)} institutional</span><br/>
               <span style="color:${floorPctVal >= 30 ? '#C23B3B' : floorPctVal >= 15 ? '#D4920B' : '#6B6B60'}">
                 DSO/PE floor: ${floorPctVal.toFixed(1)}% of GP clinics (census-documented minimum)
               </span><br/>`
            : `<span style="color:#8F8E82">No census review in this ZIP yet — ownership is unresolved, not assumed.</span><br/>`

          popup
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.5">
                <strong style="font-size:14px">${escapeHtml(props.city)}</strong>
                <span style="color:#90a4ae"> &middot; ${escapeHtml(props.zip)}</span><br/>
                <span style="color:#333"><strong>${escapeHtml(props.universe)}</strong> GP clinics &middot; ${escapeHtml(props.reviewed)} census-reviewed (${coverageVal.toFixed(0)}%)</span><br/>
                ${censusLines}
                <span style="color:#B8860B">${escapeHtml(props.unresolved)} unresolved (no census conclusion)</span>
              </div>`
            )
            .addTo(map)
        })

        map.on('mouseleave', 'zip-circles', () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          popup.remove()
        })
      })
    }

    initMap()

    return () => {
      if (map) map.remove()
      mapInstanceRef.current = null
    }
  }, [mapData, center, labelThreshold])

  // Update map center when metro selection changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (map && map.isStyleLoaded()) {
      map.flyTo({ center: [center.lon, center.lat], zoom: center.zoom, duration: 800 })
    }
  }, [center])

  if (zipScores.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Census Consolidation Map"
        helpText="Each dot = one Chicagoland ZIP code. Size = GP clinic locations. Color = census-documented DSO/PE floor (hand-reviewed T4+T5 as a share of ALL GP clinics in the ZIP — a floor, not the true share). Gray dots = no census review yet. Faded dots = low census coverage. Hover for the full five-bucket breakdown."
      />

      {mapData.length > 0 ? (
        <>
          <div
            ref={mapRef}
            className="w-full rounded-xl border border-[#E8E5DE] overflow-hidden"
            style={{ height: 620, boxShadow: '0 0 40px rgba(184, 134, 11, 0.06), 0 4px 24px rgba(0, 0, 0, 0.08)' }}
          />

          {/* Legend */}
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: UNREVIEWED_GRAY, opacity: 0.6 }} />
              <span className="text-[#6B6B60]">Not yet census-reviewed</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#C23B3B]" />
              <span className="text-[#6B6B60]">High documented DSO/PE floor</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BUCKET_META.unresolved.color, opacity: 0.35 }} />
              <span className="text-[#6B6B60]">Faded = low census coverage</span>
            </div>
          </div>

          {/* Colorbar legend */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[#6B6B60]">0%</span>
            <div
              className="flex-1 h-2.5 rounded-full"
              style={{
                background: 'linear-gradient(to right, #EDE8DC, #D4920B, #C23B3B)',
              }}
            />
            <span className="text-[10px] text-[#6B6B60]">30%+</span>
            <span className="text-[10px] text-[#707064] ml-1">
              Census-documented DSO/PE floor (0% means no documented DSO/PE yet — not &ldquo;independent&rdquo;)
            </span>
          </div>
        </>
      ) : (
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60] text-sm">
          No ZIP coordinates available for map display.
        </div>
      )}
    </div>
  )
}
