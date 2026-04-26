'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'
import { SectionHeader } from '@/components/data-display/section-header'
import { MapContainer } from '@/components/maps/map-container'
import { ZIP_CENTROIDS } from '@/lib/constants/zip-centroids'
import { classifyPractice, getEntityClassificationLabel } from '@/lib/constants/entity-classifications'

import type { Practice } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PracticeDensityMapProps {
  practices: Practice[]
  centerLat: number
  centerLon: number
}

interface MapPractice {
  map_lat: number
  map_lon: number
  status_clean: string
  practice_name: string
  address: string
  city_zip: string
  status_label: string
  dso: string
  employees: string
  year: string
  color: [number, number, number, number]
  radius: number
  is_approximate: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// Color constants
// ────────────────────────────────────────────────────────────────────────────

// Color buckets keyed by classifyPractice() return value (canonical EC-first helper).
// "specialist" + "non_clinical" rendered separately so the headline GP dot map isn't
// polluted by ortho/endo/labs.
const STATUS_COLORS: Record<string, [number, number, number, number]> = {
  independent: [34, 197, 94, 180],
  corporate: [239, 68, 68, 200],
  specialist: [13, 148, 136, 180], // teal
  non_clinical: [156, 163, 175, 100], // muted gray
  unknown: [100, 116, 139, 80],
}

const STATUS_LABELS: Record<string, string> = {
  independent: 'Independent',
  corporate: 'Corporate (DSO/PE)',
  specialist: 'Specialist',
  non_clinical: 'Non-Clinical',
  unknown: 'Unknown',
}

const INDEPENDENT_COLOR_RANGE = [
  [187, 247, 208],
  [74, 222, 128],
  [34, 197, 94],
  [22, 163, 74],
  [21, 128, 61],
]

const CONSOLIDATED_COLOR_RANGE = [
  [254, 202, 202],
  [252, 165, 165],
  [248, 113, 113],
  [239, 68, 68],
  [220, 38, 38],
]

// ────────────────────────────────────────────────────────────────────────────
// NPI-based jitter (matches Python: hash(npi) % 2^32 → deterministic offset)
// ────────────────────────────────────────────────────────────────────────────

function hashNpi(npi: string): number {
  let h = 0
  for (let i = 0; i < npi.length; i++) {
    h = ((h << 5) - h + npi.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 4294967296 // 2^32
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers — compute approximate alpha (halved) for dot colors
// ────────────────────────────────────────────────────────────────────────────

function getApproxColor(color: [number, number, number, number]): [number, number, number, number] {
  return [color[0], color[1], color[2], Math.round(color[3] * 0.5)]
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

function PracticeMapInner({
  geocoded,
  showIndividual,
  centerLat,
  centerLon,
}: {
  geocoded: MapPractice[]
  showIndividual: boolean
  centerLat: number
  centerLon: number
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || geocoded.length === 0) return

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

        // Build GeoJSON from geocoded practices
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: geocoded.map((d) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [d.map_lon, d.map_lat] },
            properties: {
              status: d.status_clean,
              name: d.practice_name,
              address: d.address,
              city_zip: d.city_zip,
              status_label: d.status_label,
              dso: d.dso,
              employees: d.employees,
              year: d.year,
              r: d.color[0],
              g: d.color[1],
              b: d.color[2],
              a: d.color[3],
              approx: d.is_approximate ? 1 : 0,
            },
          })),
        }

        map.addSource('practices', { type: 'geojson', data: geojson })

        // Circle layer — all practices as colored dots
        // Scale radius with zoom: tiny at zoom 9, bigger when zoomed in
        map.addLayer({
          id: 'practice-dots',
          type: 'circle',
          source: 'practices',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              8, showIndividual ? 1.5 : 1,
              10, showIndividual ? 3 : 2,
              12, showIndividual ? 5 : 3.5,
              14, showIndividual ? 8 : 5,
            ],
            'circle-color': [
              'rgb',
              ['get', 'r'],
              ['get', 'g'],
              ['get', 'b'],
            ],
            'circle-opacity': [
              'case',
              ['==', ['get', 'approx'], 1],
              showIndividual ? 0.45 : 0.35,    // Approximate — 50% opacity reduction
              showIndividual ? 0.9 : 0.7,       // Precise (Data Axle coords)
            ],
            'circle-stroke-width': showIndividual ? 0.5 : 0,
            'circle-stroke-color': 'rgba(0,0,0,0.15)',
          },
        })

        // Popup on hover — light panel styling
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '280px',
        })

        map.on('mouseenter', 'practice-dots', (e) => {
          if (!map || !e.features?.[0]) return
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features[0].properties!
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]

          popup
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.5;background:#FFFFFF;color:#1A1A1A;border:1px solid #E8E5DE;border-radius:8px;padding:10px 14px;margin:-10px -14px">
                <strong style="color:#1A1A1A">${props.name}</strong><br/>
                <span style="color:#6B6B60">${props.address}</span><br/>
                <span style="color:#6B6B60">${props.city_zip}</span><br/>
                <span style="color:#6B6B60">Status:</span> <strong style="color:#1A1A1A">${props.status_label}</strong><br/>
                <span style="color:#6B6B60">DSO:</span> <span style="color:#1A1A1A">${props.dso}</span><br/>
                <span style="color:#6B6B60">Employees:</span> <span style="color:#1A1A1A">${props.employees}</span> <span style="color:#6B6B60">| Est:</span> <span style="color:#1A1A1A">${props.year}</span>
              </div>`
            )
            .addTo(map)
        })

        map.on('mouseleave', 'practice-dots', () => {
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
  }, [geocoded, showIndividual, centerLat, centerLon])

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-[#E8E5DE] overflow-hidden"
      style={{ height: 620, boxShadow: '0 0 40px rgba(184, 134, 11, 0.06), 0 4px 24px rgba(0, 0, 0, 0.08)' }}
    />
  )
}

export function PracticeDensityMap({
  practices,
  centerLat,
  centerLon,
}: PracticeDensityMapProps) {
  const [showIndividual, setShowIndividual] = useState(false)
  const [hideUnknown, setHideUnknown] = useState(false)

  // Geocode all practices: real coords if available, ZIP centroid + NPI jitter otherwise
  const geocoded = useMemo<MapPractice[]>(() => {
    const results: MapPractice[] = []

    for (const p of practices) {
      // Canonical classification: entity_classification primary, ownership_status fallback.
      // classifyPractice() returns "independent" | "corporate" | "specialist" | "non_clinical" | "unknown".
      const ec = (p.entity_classification ?? '').trim().toLowerCase()
      const status_clean = classifyPractice(p.entity_classification, p.ownership_status)
      if (hideUnknown && status_clean === 'unknown') continue

      let lat: number | null = null
      let lon: number | null = null
      let is_approximate = false

      // Use real coordinates if available (Data Axle enriched)
      if (
        p.latitude != null &&
        p.longitude != null &&
        Number(p.latitude) !== 0 &&
        Number(p.longitude) !== 0
      ) {
        lat = Number(p.latitude)
        lon = Number(p.longitude)
      } else {
        // Fall back to ZIP centroid + NPI-based deterministic jitter
        const zip5 = (p.zip ?? '').toString().slice(0, 5)
        const centroid = ZIP_CENTROIDS[zip5]
        if (centroid) {
          const npiStr = (p.npi ?? '0').toString()
          const h = hashNpi(npiStr)
          const jitterLat = ((h % 10000) / 10000.0 - 0.5) * 0.025
          const jitterLon = ((Math.floor(h / 10000) % 10000) / 10000.0 - 0.5) * 0.025
          lat = centroid[0] + jitterLat
          lon = centroid[1] + jitterLon
          is_approximate = true
        }
      }

      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) continue

      const emp = p.employee_count != null ? Number(p.employee_count) : 0
      const empClamped = Math.min(Math.max(emp || 1, 1), 50)

      const baseColor = STATUS_COLORS[status_clean] ?? STATUS_COLORS.unknown
      const dotColor = is_approximate ? getApproxColor(baseColor) : baseColor

      results.push({
        map_lat: lat,
        map_lon: lon,
        is_approximate,
        status_clean,
        practice_name: p.practice_name ?? 'Unknown Practice',
        address: p.address ?? '--',
        city_zip: `${p.city ?? ''}, ${p.state ?? ''} ${(p.zip ?? '').toString().slice(0, 5)}`,
        // Surface the granular EC label when present (e.g. "Solo High Volume", "DSO National");
        // fall back to the bucket label for unclassified rows.
        status_label: ec ? getEntityClassificationLabel(ec) ?? STATUS_LABELS[status_clean] : STATUS_LABELS[status_clean] ?? 'Unknown',
        dso: p.affiliated_dso ?? '--',
        employees: emp ? emp.toString() : '--',
        year:
          p.year_established != null && Number(p.year_established) > 0
            ? Math.floor(Number(p.year_established)).toString()
            : '--',
        color: dotColor,
        radius: 40 + (empClamped / 50) * 40,
      })
    }

    return results
  }, [practices, hideUnknown])

  // Split into independent and consolidated for hex layers using canonical buckets.
  const independentData = useMemo(
    () =>
      geocoded
        .filter((d) => d.status_clean === 'independent')
        .map((d) => ({ lat: d.map_lat, lon: d.map_lon })),
    [geocoded]
  )

  const consolidatedData = useMemo(
    () =>
      geocoded
        .filter((d) => d.status_clean === 'corporate')
        .map((d) => ({ lat: d.map_lat, lon: d.map_lon })),
    [geocoded]
  )

  const unknownCount = useMemo(
    () => geocoded.filter((d) => d.status_clean === 'unknown').length,
    [geocoded]
  )

  // Build deck.gl layer configs
  const layers = useMemo(() => {
    const result: Array<Record<string, unknown>> = []

    // Layer 1: Independent hex density (green)
    if (independentData.length > 0) {
      result.push({
        type: 'HexagonLayer',
        id: 'hex-independent',
        data: independentData,
        getPosition: (d: { lat: number; lon: number }) => [d.lon, d.lat],
        radius: 1000,
        elevationScale: 0,
        extruded: false,
        opacity: 0.5,
        colorRange: INDEPENDENT_COLOR_RANGE,
        pickable: true,
        autoHighlight: true,
      })
    }

    // Layer 2: Consolidated hex density (red)
    if (consolidatedData.length > 0) {
      result.push({
        type: 'HexagonLayer',
        id: 'hex-consolidated',
        data: consolidatedData,
        getPosition: (d: { lat: number; lon: number }) => [d.lon, d.lat],
        radius: 1000,
        elevationScale: 0,
        extruded: false,
        opacity: 0.6,
        colorRange: CONSOLIDATED_COLOR_RANGE,
        pickable: true,
        autoHighlight: true,
      })
    }

    // Layer 3 (optional): Individual practice dots
    if (showIndividual) {
      result.push({
        type: 'ScatterplotLayer',
        id: 'scatter-practices',
        data: geocoded,
        getPosition: (d: MapPractice) => [d.map_lon, d.map_lat],
        getFillColor: (d: MapPractice) => d.color,
        getRadius: (d: MapPractice) => d.radius,
        radiusMinPixels: 2,
        radiusMaxPixels: 12,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
      })
    }

    return result
  }, [independentData, consolidatedData, geocoded, showIndividual])

  const tooltip = showIndividual
    ? {
        html: `
          <div style="font-family:Inter,sans-serif;padding:4px 0">
            <b style="font-size:13px;color:#1A1A1A">{practice_name}</b><br/>
            <span style="font-size:11px;color:#6B6B60">{address}</span><br/>
            <span style="font-size:11px;color:#6B6B60">{city_zip}</span><br/>
            <span style="font-size:11px;color:#6B6B60">Status:</span> <b style="color:#1A1A1A">{status_label}</b><br/>
            <span style="font-size:11px;color:#6B6B60">DSO:</span> <span style="color:#1A1A1A">{dso}</span><br/>
            <span style="font-size:11px;color:#6B6B60">Employees:</span> <span style="color:#1A1A1A">{employees}</span><br/>
            <span style="font-size:11px;color:#6B6B60">Established:</span> <span style="color:#1A1A1A">{year}</span>
          </div>`,
        style: {
          backgroundColor: '#FFFFFF',
          color: '#1A1A1A',
          border: '1px solid #E8E5DE',
          borderRadius: '8px',
          padding: '8px 12px',
        },
      }
    : undefined

  return (
    <div>
      <SectionHeader
        title="Practice Density Map"
        helpText="Hexagonal density shows practice concentration. Green = independent clusters. Red = consolidated (DSO/PE) clusters. Overlap = competitive markets. Toggle individual dots for detail."
      />

      {geocoded.length === 0 ? (
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
          No geocodable practices found.
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex items-center gap-6 mb-3">
            <label className="flex items-center gap-2 text-sm text-[#1A1A1A] cursor-pointer">
              <input
                type="checkbox"
                checked={showIndividual}
                onChange={(e) => setShowIndividual(e.target.checked)}
                className="rounded border-[#E8E5DE] bg-[#FFFFFF] text-[#B8860B] focus:ring-[#B8860B]"
              />
              Show individual practices
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1A1A1A] cursor-pointer">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={(e) => setHideUnknown(e.target.checked)}
                className="rounded border-[#E8E5DE] bg-[#FFFFFF] text-[#B8860B] focus:ring-[#B8860B]"
              />
              Hide unknown practices
            </label>
          </div>

          {/* Map — raw mapboxgl for data layers */}
          <PracticeMapInner
            geocoded={geocoded}
            showIndividual={showIndividual}
            centerLat={centerLat}
            centerLon={centerLon}
          />

          {/* Legend */}
          <div className="flex flex-wrap gap-6 mt-2 mb-1">
            <span className="flex items-center gap-1.5 text-[13px] text-[#1A1A1A]">
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #BBF7D0, #15803D)',
                }}
              />
              Independent density
            </span>
            <span className="flex items-center gap-1.5 text-[13px] text-[#1A1A1A]">
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #FECACA, #DC2626)',
                }}
              />
              Consolidated density (DSO + PE)
            </span>
            <span className="text-[13px] text-[#6B6B60]">Overlap = competitive market</span>
          </div>

          {/* Summary counts */}
          <p className="text-xs text-[#6B6B60] mt-1">
            Showing {geocoded.length.toLocaleString()} practices (
            {independentData.length.toLocaleString()} independent,{' '}
            {consolidatedData.length.toLocaleString()} consolidated,{' '}
            {unknownCount.toLocaleString()} unknown)
            {' '}&middot;{' '}
            {geocoded.filter(d => !d.is_approximate).length.toLocaleString()} precise locations,{' '}
            {geocoded.filter(d => d.is_approximate).length.toLocaleString()} approximate (ZIP centroid)
          </p>
        </>
      )}
    </div>
  )
}
