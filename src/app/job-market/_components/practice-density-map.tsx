'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type mapboxgl from 'mapbox-gl'
import { SectionHeader } from '@/components/data-display/section-header'
import { ZIP_CENTROIDS } from '@/lib/constants/zip-centroids'
import { isGpLocationClassification } from '@/lib/constants/entity-classifications'
import {
  BUCKET_META,
  HEADLINE_BUCKETS,
  formatNetworkId,
  tierToBucket,
  type HeadlineBucket,
} from '@/lib/census/ownership-truth'
import { displayName } from '@/lib/census/display-name'
import { escapeHtml } from '@/lib/utils/escape-html'

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
  location_id: string | null
  bucket: HeadlineBucket
  practice_name: string
  address: string
  city_zip: string
  ownership_label: string
  network: string
  employees: string
  year: string
  color: [number, number, number, number]
  is_approximate: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// Colors — census bucket colors from the ownership contract. Per the truth
// charter, unresolved renders as NEUTRAL GRAY on maps (not the amber chip
// color) so unreviewed clinics never read as a finding.
// ────────────────────────────────────────────────────────────────────────────

const UNRESOLVED_MAP_GRAY: [number, number, number] = [156, 163, 175]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const BUCKET_DOT_COLORS: Record<HeadlineBucket, [number, number, number, number]> =
  HEADLINE_BUCKETS.reduce(
    (acc, b) => {
      const rgb = b === 'unresolved' ? UNRESOLVED_MAP_GRAY : hexToRgb(BUCKET_META[b].color)
      acc[b] = [rgb[0], rgb[1], rgb[2], b === 'unresolved' ? 110 : 200]
      return acc
    },
    {} as Record<HeadlineBucket, [number, number, number, number]>
  )

const UNRESOLVED_LEGEND_GRAY = '#9CA3AF'

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
// Inner map — raw mapboxgl dot layer colored by census bucket
// ────────────────────────────────────────────────────────────────────────────

function PracticeMapInner({
  geocoded,
  centerLat,
  centerLon,
  onOpenPractice,
}: {
  geocoded: MapPractice[]
  centerLat: number
  centerLon: number
  onOpenPractice: (locationId: string) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<mapboxgl.Map | null>(null)
  // Ref so a changing callback identity never tears down and re-creates the map
  const onOpenPracticeRef = useRef(onOpenPractice)
  onOpenPracticeRef.current = onOpenPractice

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
              location_id: d.location_id ?? '',
              name: d.practice_name,
              address: d.address,
              city_zip: d.city_zip,
              ownership_label: d.ownership_label,
              network: d.network,
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

        // Circle layer — all practices as census-colored dots
        // Scale radius with zoom: tiny at zoom 9, bigger when zoomed in
        map.addLayer({
          id: 'practice-dots',
          type: 'circle',
          source: 'practices',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              8, 1.5,
              10, 3,
              12, 5,
              14, 8,
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
              0.45,    // Approximate — 50% opacity reduction
              0.9,     // Precise (Data Axle coords)
            ],
            'circle-stroke-width': 0.5,
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
                <strong style="color:#1A1A1A">${escapeHtml(props.name)}</strong><br/>
                <span style="color:#6B6B60">${escapeHtml(props.address)}</span><br/>
                <span style="color:#6B6B60">${escapeHtml(props.city_zip)}</span><br/>
                <span style="color:#6B6B60">Census ownership:</span> <strong style="color:#1A1A1A">${escapeHtml(props.ownership_label)}</strong><br/>
                <span style="color:#6B6B60">Network:</span> <span style="color:#1A1A1A">${escapeHtml(props.network)}</span><br/>
                <span style="color:#6B6B60">Employees:</span> <span style="color:#1A1A1A">${escapeHtml(props.employees)}</span> <span style="color:#6B6B60">| Est:</span> <span style="color:#1A1A1A">${escapeHtml(props.year)}</span><br/>
                <span style="color:#8B6508">Click the dot to open the practice page</span>
              </div>`
            )
            .addTo(map)
        })

        map.on('mouseleave', 'practice-dots', () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          popup.remove()
        })

        // Click-through to the practice page — location_id rides in the
        // feature properties, so every dot deep-links to /practice/[locationId]
        map.on('click', 'practice-dots', (e) => {
          const locationId = e.features?.[0]?.properties?.location_id
          if (typeof locationId === 'string' && locationId) {
            onOpenPracticeRef.current(locationId)
          }
        })
      })
    }

    initMap()
    return () => {
      if (map) map.remove()
      mapObjRef.current = null
    }
  }, [geocoded, centerLat, centerLon])

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-[#E8E5DE] overflow-hidden"
      style={{ height: 620, boxShadow: '0 0 40px rgba(184, 134, 11, 0.06), 0 4px 24px rgba(0, 0, 0, 0.08)' }}
    />
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main component — census truth layer only. The detector green/red
// independent-vs-consolidated coloring (and its never-rendered deck.gl hex
// layers) were removed, not relabeled: every dot color now states a
// hand-reviewed census conclusion, and unreviewed clinics are neutral gray.
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDensityMap({
  practices,
  centerLat,
  centerLon,
}: PracticeDensityMapProps) {
  const router = useRouter()
  const [hideUnresolved, setHideUnresolved] = useState(false)

  // Canonical GP-only map layer (scope axis, not an ownership claim). This
  // excludes specialists, non-clinical rows, org-only NPIs, da_unverified
  // records, and duplicate shells even if a caller accidentally passes the
  // full mixed location table.
  const filteredPractices = useMemo(
    () =>
      practices.filter((p) => isGpLocationClassification(p.entity_classification)),
    [practices]
  )

  // Geocode all practices: real coords if available, ZIP centroid + NPI jitter otherwise
  const geocoded = useMemo<MapPractice[]>(() => {
    const results: MapPractice[] = []

    for (const p of filteredPractices) {
      const bucket = tierToBucket(p.ownership_tier)
      if (hideUnresolved && bucket === 'unresolved') continue

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

      const baseColor = BUCKET_DOT_COLORS[bucket]
      const dotColor = is_approximate ? getApproxColor(baseColor) : baseColor

      results.push({
        map_lat: lat,
        map_lon: lon,
        location_id: p.location_id ?? null,
        is_approximate,
        bucket,
        practice_name: displayName(p),
        address: p.address ?? '--',
        city_zip: `${p.city ?? ''}, ${p.state ?? ''} ${(p.zip ?? '').toString().slice(0, 5)}`,
        ownership_label:
          bucket === 'unresolved'
            ? 'Unresolved — not yet reviewed'
            : BUCKET_META[bucket].label,
        network: p.network_id ? formatNetworkId(p.network_id) : '--',
        employees: emp ? emp.toString() : '--',
        year:
          p.year_established != null && Number(p.year_established) > 0
            ? Math.floor(Number(p.year_established)).toString()
            : '--',
        color: dotColor,
      })
    }

    return results
  }, [filteredPractices, hideUnresolved])

  const bucketCounts = useMemo(() => {
    const counts: Record<HeadlineBucket, number> = {
      true_solo_owner_operated: 0,
      dentist_owned_not_solo: 0,
      dso_pe_corporate: 0,
      institutional: 0,
      unresolved: 0,
    }
    for (const d of geocoded) counts[d.bucket]++
    return counts
  }, [geocoded])

  return (
    <div>
      <SectionHeader
        title="Ownership Map"
        helpText="Each dot is a general-dentistry office. Color shows the reviewed ownership answer. Gray means not reviewed or still unresolved. Faded dots use the ZIP center because exact coordinates are missing. Click a dot to open the full practice page."
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
                checked={hideUnresolved}
                onChange={(e) => setHideUnresolved(e.target.checked)}
                className="rounded border-[#E8E5DE] bg-[#FFFFFF] text-[#B8860B] focus:ring-[#B8860B]"
              />
              Hide unresolved offices
            </label>
          </div>

          {/* Map — raw mapboxgl dot layer */}
          <PracticeMapInner
            geocoded={geocoded}
            centerLat={centerLat}
            centerLon={centerLon}
            onOpenPractice={(locationId) =>
              router.push(`/practice/${encodeURIComponent(locationId)}`)
            }
          />

          {/* Legend — all five ownership groups, always */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 mb-1">
            {HEADLINE_BUCKETS.map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-[13px] text-[#1A1A1A]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      b === 'unresolved' ? UNRESOLVED_LEGEND_GRAY : BUCKET_META[b].color,
                  }}
                />
                {BUCKET_META[b].shortLabel}
                <span className="text-[#6B6B60]">
                  {bucketCounts[b].toLocaleString()}
                </span>
              </span>
            ))}
          </div>

          {/* Summary counts */}
          <p className="text-xs text-[#6B6B60] mt-1">
            Showing {geocoded.length.toLocaleString()} offices
            {hideUnresolved ? ' (unresolved hidden)' : ''}
            {' '}&middot;{' '}
            {geocoded.filter(d => !d.is_approximate).length.toLocaleString()} precise locations,{' '}
            {geocoded.filter(d => d.is_approximate).length.toLocaleString()} approximate (ZIP centroid)
            {' '}&middot; Ownership colors use reviewed ownership data only.
          </p>
        </>
      )}
    </div>
  )
}
