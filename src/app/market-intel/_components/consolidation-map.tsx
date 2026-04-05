'use client'

import { useEffect, useRef, useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { ZIP_CENTROIDS, METRO_CENTERS } from '@/lib/constants/zip-centroids'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

/** Escape HTML special characters to prevent XSS in map tooltip .setHTML() */
function escapeHtml(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface ConsolidationMapProps {
  zipScores: ZipScore[]
  selectedMetro: string
}

/**
 * Interpolate a consolidation percentage (0-30+) into a green-yellow-red color.
 * 0% = green (#2D8B4E), 15% = yellow (#D4920B), 30%+ = red (#C23B3B)
 */
function consolidationColor(pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 30)
  const ratio = clamped / 30

  if (ratio <= 0.5) {
    // Green to yellow
    const t = ratio / 0.5
    const r = Math.round(45 + (212 - 45) * t)
    const g = Math.round(139 + (146 - 139) * t)
    const b = Math.round(78 + (11 - 78) * t)
    return `rgb(${r},${g},${b})`
  } else {
    // Yellow to red
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

export function ConsolidationMap({ zipScores, selectedMetro }: ConsolidationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)

  // Build map data — only ZIPs with valid coordinates
  const mapData = useMemo(() => {
    return zipScores
      .map(zs => {
        const coords = ZIP_CENTROIDS[zs.zip_code]
        if (!coords) return null

        // Total practices — prefer total_practices, fall back to GP + specialist locations
        const total = zs.total_practices
          ?? ((zs.total_gp_locations ?? 0) + (zs.total_specialist_locations ?? 0))
        const gpLoc = zs.total_gp_locations ?? total

        // Corporate count from saturation metrics (entity_classification-based, most accurate)
        const corporateFromSaturation = zs.corporate_share_pct != null && zs.total_gp_locations != null
          ? Math.round(zs.corporate_share_pct * zs.total_gp_locations)
          : null
        const corporateFromLegacy = (zs.dso_affiliated_count ?? 0) + (zs.pe_backed_count ?? 0)
        const consolCount = corporateFromSaturation ?? corporateFromLegacy

        // Consolidation % — use corporate_share_pct directly when available (already 0-1)
        const consolPct = zs.corporate_share_pct != null
          ? zs.corporate_share_pct * 100
          : total > 0
            ? (consolCount / total) * 100
            : 0

        // Independent count estimate
        const indepCount = zs.independent_count != null && zs.independent_count > 0
          ? zs.independent_count
          : Math.max(0, gpLoc - consolCount)

        // Confidence from metrics_confidence (saturation-based)
        const confidence = zs.metrics_confidence
          ? zs.metrics_confidence.charAt(0).toUpperCase() + zs.metrics_confidence.slice(1)
          : 'Low'

        const opacity = confidence === 'Low' ? 0.5 : 0.9

        return {
          zip: zs.zip_code,
          city: zs.city ?? '',
          lat: coords[0],
          lon: coords[1],
          total,
          independent: indepCount,
          consolCount,
          consolPct,
          opacity,
          confidence,
          size: markerSize(total),
          color: consolidationColor(consolPct),
        }
      })
      .filter(Boolean) as Array<{
      zip: string
      city: string
      lat: number
      lon: number
      total: number
      independent: number
      consolCount: number
      consolPct: number
      opacity: number
      confidence: string
      size: number
      color: string
    }>
  }, [zipScores])

  // Compute map center
  const center = useMemo(() => {
    const metroKey = selectedMetro !== 'All Watched ZIPs' ? selectedMetro : null
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
              total: d.total,
              independent: d.independent,
              consolCount: d.consolCount,
              consolPct: d.consolPct,
              confidence: d.confidence,
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
            .filter(d => d.total >= labelThreshold)
            .map(d => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [d.lon, d.lat + 0.015] },
              properties: {
                label: `${d.city} (${d.total})`,
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
          maxWidth: '300px',
        })

        map.on('mouseenter', 'zip-circles', e => {
          if (!map || !e.features || e.features.length === 0) return
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features[0].properties!
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          const consolPctVal = Number(props.consolPct)

          popup
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.5">
                <strong style="font-size:14px">${escapeHtml(props.city)}</strong>
                <span style="color:#90a4ae"> &middot; ${escapeHtml(props.zip)}</span><br/>
                <span style="color:#333"><strong>${escapeHtml(props.total)}</strong> practices (deduplicated)</span><br/>
                <span style="color:#2E7D32">&blacktriangleright; ${escapeHtml(props.independent)} independent</span> |
                <span style="color:#E65100">${escapeHtml(props.consolCount)} consolidated (DSO+PE)</span><br/>
                <span style="color:${consolPctVal >= 30 ? '#C23B3B' : consolPctVal >= 15 ? '#D4920B' : '#2D8B4E'}">
                  Consolidation: ${consolPctVal.toFixed(1)}% of total
                </span><br/>
                <span style="color:#78909c;font-size:10px">Data confidence: ${escapeHtml(props.confidence)}</span>
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
        title="Consolidation Map"
        helpText="Each dot = one watched ZIP code. Size = practice count. Color = consolidation level (green = mostly independent, red = mostly consolidated). Faded areas = low data confidence."
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
              <span className="w-3 h-3 rounded-full bg-[#2D8B4E]" />
              <span className="text-[#6B6B60]">Mostly Independent</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#C23B3B]" />
              <span className="text-[#6B6B60]">Mostly Known Consolidated (DSO/PE)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#9E9E9E] opacity-30" />
              <span className="text-[#6B6B60]">Low confidence areas</span>
            </div>
          </div>

          {/* Colorbar legend */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[#6B6B60]">0%</span>
            <div
              className="flex-1 h-2.5 rounded-full"
              style={{
                background: 'linear-gradient(to right, #2D8B4E, #D4920B, #C23B3B)',
              }}
            />
            <span className="text-[10px] text-[#6B6B60]">30%+</span>
            <span className="text-[10px] text-[#9C9C90] ml-1">Consolidation % (of total)</span>
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
