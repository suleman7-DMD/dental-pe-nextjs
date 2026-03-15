'use client'

import { useEffect, useRef, useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { MapContainer } from '@/components/maps/map-container'
import { ZIP_CENTROIDS, METRO_CENTERS } from '@/lib/constants/zip-centroids'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

interface ConsolidationMapProps {
  zipScores: ZipScore[]
  selectedMetro: string
}

/**
 * Interpolate a consolidation percentage (0-30+) into a green-yellow-red color.
 * 0% = green (#22C55E), 15% = yellow (#F59E0B), 30%+ = red (#EF4444)
 */
function consolidationColor(pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 30)
  const ratio = clamped / 30

  if (ratio <= 0.5) {
    // Green to yellow
    const t = ratio / 0.5
    const r = Math.round(76 + (255 - 76) * t)
    const g = Math.round(175 + (193 - 175) * t)
    const b = Math.round(80 + (7 - 80) * t)
    return `rgb(${r},${g},${b})`
  } else {
    // Yellow to red
    const t = (ratio - 0.5) / 0.5
    const r = Math.round(255 + (244 - 255) * t)
    const g = Math.round(193 + (67 - 193) * t)
    const b = Math.round(7 + (54 - 7) * t)
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

        const total = zs.total_practices ?? 0
        const dso = zs.dso_affiliated_count ?? 0
        const pe = zs.pe_backed_count ?? 0
        const unk = zs.unknown_count ?? 0

        // Use corporate_share_pct from saturation metrics if available (entity_classification based)
        const corporateFromSaturation = zs.corporate_share_pct != null && zs.total_gp_locations != null
          ? Math.round(zs.corporate_share_pct * zs.total_gp_locations)
          : null
        const consolCount = corporateFromSaturation ?? (dso + pe)
        const consolPct = total > 0 ? (consolCount / total) * 100 : 0
        const pctUnknown = total > 0 ? (unk / total) * 100 : 100

        const opacity = pctUnknown < 50 ? 0.9 : 0.5
        const confidence = zs.metrics_confidence
          ? zs.metrics_confidence.charAt(0).toUpperCase() + zs.metrics_confidence.slice(1)
          : pctUnknown < 30
            ? 'High'
            : pctUnknown < 60
              ? 'Medium'
              : 'Low'

        return {
          zip: zs.zip_code,
          city: zs.city ?? '',
          lat: coords[0],
          lon: coords[1],
          total: zs.total_practices,
          independent: zs.independent_count,
          consolCount,
          consolPct,
          opacity,
          confidence,
          size: markerSize(zs.total_practices ?? 0),
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
            'circle-stroke-color': 'rgba(255,255,255,0.3)',
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
            'text-color': '#555555',
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
                <strong style="font-size:14px">${props.city}</strong>
                <span style="color:#90a4ae"> &middot; ${props.zip}</span><br/>
                <span style="color:#333"><strong>${props.total}</strong> practices (deduplicated)</span><br/>
                <span style="color:#2E7D32">&blacktriangleright; ${props.independent} independent</span> |
                <span style="color:#E65100">${props.consolCount} consolidated (DSO+PE)</span><br/>
                <span style="color:${consolPctVal > 20 ? '#D32F2F' : '#388E3C'}">
                  Consolidation: ${consolPctVal.toFixed(1)}% of total
                </span><br/>
                <span style="color:#78909c;font-size:10px">Data confidence: ${props.confidence}</span>
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
        helpText="Each dot = one watched ZIP code. Size = practice count. Color = consolidation level (green = mostly independent, red = mostly consolidated). Dark areas = no data coverage."
      />

      {mapData.length > 0 ? (
        <>
          <div
            ref={mapRef}
            className="w-full rounded-xl border border-[var(--border)] overflow-hidden"
            style={{ height: 620, boxShadow: '0 0 40px rgba(59, 130, 246, 0.08), 0 4px 24px rgba(0, 0, 0, 0.3)' }}
          />

          {/* Legend */}
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="text-[#94A3B8]">Mostly Independent</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <span className="text-[#94A3B8]">Mostly Known Consolidated (DSO/PE)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-[#9E9E9E] opacity-30" />
              <span className="text-[#94A3B8]">Low confidence areas</span>
            </div>
          </div>

          {/* Colorbar legend */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[#94A3B8]">0%</span>
            <div
              className="flex-1 h-2.5 rounded-full"
              style={{
                background: 'linear-gradient(to right, #22C55E, #F59E0B, #EF4444)',
              }}
            />
            <span className="text-[10px] text-[#94A3B8]">30%+</span>
            <span className="text-[10px] text-[#64748B] ml-1">Consolidation % (of total)</span>
          </div>
        </>
      ) : (
        <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8] text-sm">
          No ZIP coordinates available for map display.
        </div>
      )}
    </div>
  )
}
