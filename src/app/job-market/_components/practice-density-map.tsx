'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type mapboxgl from 'mapbox-gl'
import { SectionHeader } from '@/components/data-display/section-header'
import { MapContainer } from '@/components/maps/map-container'
import { ZIP_CENTROIDS } from '@/lib/constants/zip-centroids'

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

const STATUS_COLORS: Record<string, [number, number, number, number]> = {
  independent: [76, 175, 80, 220],
  likely_independent: [76, 175, 80, 220],
  dso_affiliated: [255, 183, 77, 220],
  pe_backed: [244, 67, 54, 220],
  unknown: [120, 144, 156, 100],
}

const STATUS_LABELS: Record<string, string> = {
  independent: 'Independent',
  likely_independent: 'Likely Independent',
  dso_affiliated: 'DSO Affiliated',
  pe_backed: 'PE-Backed',
  unknown: 'Unknown',
}

const INDEPENDENT_COLOR_RANGE = [
  [200, 230, 201],
  [165, 214, 167],
  [102, 187, 106],
  [76, 175, 80],
  [56, 142, 60],
  [27, 94, 32],
]

const CONSOLIDATED_COLOR_RANGE = [
  [255, 224, 178],
  [255, 183, 77],
  [255, 152, 0],
  [244, 67, 54],
  [211, 47, 47],
  [183, 28, 28],
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
              showIndividual ? 0.55 : 0.4,    // Approximate (ZIP centroid) — slightly transparent
              showIndividual ? 0.9 : 0.7,     // Precise (Data Axle coords) — full opacity
            ],
            'circle-stroke-width': showIndividual ? 0.5 : 0,
            'circle-stroke-color': 'rgba(255,255,255,0.3)',
          },
        })

        // Popup on hover
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
              `<div style="font-family:system-ui;font-size:12px;line-height:1.5">
                <strong>${props.name}</strong><br/>
                <span style="color:#666">${props.address}</span><br/>
                <span style="color:#666">${props.city_zip}</span><br/>
                Status: <strong>${props.status_label}</strong><br/>
                DSO: ${props.dso}<br/>
                Employees: ${props.employees} | Est: ${props.year}
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
      className="w-full rounded-xl border border-[var(--border)] overflow-hidden"
      style={{ height: 620 }}
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
      // Use entity_classification to detect corporate practices that ownership_status misses
      // dso_regional/dso_national from classifier are more accurate than ownership_status
      const ec = (p.entity_classification ?? '').trim().toLowerCase()
      const isCorporateByEC = ec === 'dso_regional' || ec === 'dso_national'
      const rawStatus = (p.ownership_status ?? 'unknown').trim().toLowerCase()
      const status_clean = isCorporateByEC ? 'dso_affiliated' : rawStatus
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

      results.push({
        map_lat: lat,
        map_lon: lon,
        is_approximate,
        status_clean,
        practice_name: p.practice_name ?? 'Unknown Practice',
        address: p.address ?? '--',
        city_zip: `${p.city ?? ''}, ${p.state ?? ''} ${(p.zip ?? '').toString().slice(0, 5)}`,
        status_label: isCorporateByEC ? (ec === 'dso_national' ? 'DSO National' : 'DSO Regional') : (STATUS_LABELS[rawStatus] ?? 'Unknown'),
        dso: p.affiliated_dso ?? '--',
        employees: emp ? emp.toString() : '--',
        year:
          p.year_established != null && Number(p.year_established) > 0
            ? Math.floor(Number(p.year_established)).toString()
            : '--',
        color: STATUS_COLORS[status_clean] ?? STATUS_COLORS.unknown,
        radius: 40 + (empClamped / 50) * 40,
      })
    }

    return results
  }, [practices, hideUnknown])

  // Split into independent and consolidated for hex layers
  const independentData = useMemo(
    () =>
      geocoded
        .filter((d) => d.status_clean === 'independent' || d.status_clean === 'likely_independent')
        .map((d) => ({ lat: d.map_lat, lon: d.map_lon })),
    [geocoded]
  )

  const consolidatedData = useMemo(
    () =>
      geocoded
        .filter((d) => d.status_clean === 'dso_affiliated' || d.status_clean === 'pe_backed')
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

    // Layer 2: Consolidated hex density (red/orange)
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
          <div style="font-family:DM Sans,sans-serif;padding:4px 0">
            <b style="font-size:13px;color:#e8ecf1">{practice_name}</b><br/>
            <span style="font-size:11px;color:#90a4ae">{address}</span><br/>
            <span style="font-size:11px;color:#90a4ae">{city_zip}</span><br/>
            <span style="font-size:11px">Status: <b>{status_label}</b></span><br/>
            <span style="font-size:11px">DSO: {dso}</span><br/>
            <span style="font-size:11px">Employees: {employees}</span><br/>
            <span style="font-size:11px">Established: {year}</span>
          </div>`,
        style: {
          backgroundColor: 'rgba(13,27,42,0.95)',
          color: '#e8ecf1',
          border: '1px solid #1a3a5c',
          borderRadius: '6px',
          padding: '8px 12px',
        },
      }
    : undefined

  return (
    <div>
      <SectionHeader
        title="Practice Density Map"
        helpText="Hexagonal density shows practice concentration. Green = independent clusters. Red/orange = consolidated (DSO/PE) clusters. Overlap = competitive markets. Toggle individual dots for detail."
      />

      {geocoded.length === 0 ? (
        <div className="rounded-lg border border-[#1E2A3A] bg-[#141922] p-6 text-center text-[#8892A0]">
          No geocodable practices found.
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex items-center gap-6 mb-3">
            <label className="flex items-center gap-2 text-sm text-[#E8ECF1] cursor-pointer">
              <input
                type="checkbox"
                checked={showIndividual}
                onChange={(e) => setShowIndividual(e.target.checked)}
                className="rounded border-[#1E2A3A] bg-[#141922] text-[#0066FF] focus:ring-[#0066FF]"
              />
              Show individual practices
            </label>
            <label className="flex items-center gap-2 text-sm text-[#E8ECF1] cursor-pointer">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={(e) => setHideUnknown(e.target.checked)}
                className="rounded border-[#1E2A3A] bg-[#141922] text-[#0066FF] focus:ring-[#0066FF]"
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
            <span className="flex items-center gap-1.5 text-[13px] text-[#E8ECF1]">
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #C8E6C9, #1B5E20)',
                }}
              />
              Independent density
            </span>
            <span className="flex items-center gap-1.5 text-[13px] text-[#E8ECF1]">
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{
                  background: 'linear-gradient(90deg, #FFE0B2, #B71C1C)',
                }}
              />
              Consolidated density (DSO + PE)
            </span>
            <span className="text-[13px] text-[#90A4AE]">Overlap = competitive market</span>
          </div>

          {/* Summary counts */}
          <p className="text-xs text-[#8892A0] mt-1">
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
