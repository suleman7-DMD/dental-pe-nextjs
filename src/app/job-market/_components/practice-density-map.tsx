'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type mapboxgl from 'mapbox-gl'
import { SectionHeader } from '@/components/data-display/section-header'
import { getOfficeCoordinates } from '@/lib/utils/directory-visibility'
import { isGpLocationClassification } from '@/lib/constants/entity-classifications'
import {
  BUCKET_META,
  formatNetworkId,
  tierToBucket,
} from '@/lib/census/ownership-truth'
import { verifiedDisplayName } from '@/lib/census/display-name'
import { deriveJobLane } from '@/lib/census/job-lane'
import { useJobHuntVerificationMap } from '@/lib/hooks/use-job-hunt-verification'
import { escapeHtml } from '@/lib/utils/escape-html'

import type { Practice } from '@/lib/types'
import { getDirectoryEvidence, officeMapDisposition, type ProviderResearchMap } from '@/lib/utils/directory-evidence'
import { matchesDirectoryResearch, type DirectoryResearchFilter } from '@/lib/utils/directory-contacts'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PracticeDensityMapProps {
  practices: Practice[]
  centerLat: number
  centerLon: number
  providerResearch?: ProviderResearchMap
  researchFilter?: DirectoryResearchFilter
  onResearchFilterChange?: (value: DirectoryResearchFilter) => void
}

interface MapPractice {
  map_lat: number
  map_lon: number
  location_id: string | null
  practice_name: string
  address: string
  city_zip: string
  ownership_label: string
  lane_label: string
  lane_color: string
  gaps: string
  network: string
  employees: string
  year: string
  color: [number, number, number, number]
  evidence_label: string
  contact_checked: string
  doctors: string
}

// ────────────────────────────────────────────────────────────────────────────
// Colors describe the evidence supporting a dot, not ownership type.
// ────────────────────────────────────────────────────────────────────────────

const EMPTY_PROVIDER_RESEARCH: ProviderResearchMap = {}

// ────────────────────────────────────────────────────────────────────────────
// Inner map — raw mapboxgl dot layer colored by evidence basis
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
    let cancelled = false

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      await import('mapbox-gl/dist/mapbox-gl.css')
      if (cancelled || !mapRef.current) return
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
              lane_label: d.lane_label,
              lane_color: d.lane_color,
              gaps: d.gaps,
              network: d.network,
              employees: d.employees,
              year: d.year,
              evidence_label: d.evidence_label,
              contact_checked: d.contact_checked,
              doctors: d.doctors,
              r: d.color[0],
              g: d.color[1],
              b: d.color[2],
              a: d.color[3],
            },
          })),
        }

        map.addSource('practices', { type: 'geojson', data: geojson })

        // Circle layer — office-evidence-backed stored coordinates only
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
            'circle-opacity': 0.9,
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
                <strong>${escapeHtml(props.evidence_label)}</strong><br/>
                <span>Contact check: ${escapeHtml(props.contact_checked)}</span><br/>
                <span>Researched doctors: ${escapeHtml(props.doctors)}</span><br/>
                <span>Stored coordinates; address accuracy not independently verified.</span><br/>
                <span style="color:#6B6B60">Owner / operator:</span> <strong style="color:#1A1A1A">${escapeHtml(props.network !== '--' ? props.network : props.ownership_label)}</strong><br/>
                <span style="color:#6B6B60">Census ownership:</span> <span style="color:#1A1A1A">${escapeHtml(props.ownership_label)}</span><br/>
                <span style="color:#6B6B60">Job-hunt lane:</span> <strong style="color:${escapeHtml(props.lane_color)}">${escapeHtml(props.lane_label)}</strong><br/>
                <span style="color:#6B6B60">Still missing:</span> <span style="color:#1A1A1A">${escapeHtml(props.gaps || 'Confirm current details before outreach')}</span><br/>
                <span style="color:#6B6B60">Employees (estimate):</span> <span style="color:#1A1A1A">${escapeHtml(props.employees)}</span> <span style="color:#6B6B60">| Est:</span> <span style="color:#1A1A1A">${escapeHtml(props.year)}</span><br/>
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
      cancelled = true
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
// Office evidence and coordinates are independent gates. Provider-only
// research stays in the directory without pretending to validate an address.
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDensityMap({
  practices,
  centerLat,
  centerLon,
  providerResearch = EMPTY_PROVIDER_RESEARCH,
  researchFilter = 'all',
  onResearchFilterChange,
}: PracticeDensityMapProps) {
  const router = useRouter()
  // Website-check layer — {} while loading, so lanes fall back to base states
  const verificationMap = useJobHuntVerificationMap()

  // Canonical GP-only map layer (scope axis, not an ownership claim). This
  // excludes specialists, non-clinical rows, org-only NPIs, da_unverified
  // records, and duplicate shells even if a caller accidentally passes the
  // full mixed location table.
  const filteredPractices = useMemo(
    () =>
      practices.filter((p) => isGpLocationClassification(p.entity_classification)),
    [practices]
  )

  const assessed = useMemo(() => filteredPractices.map(p => {
    const verification = p.location_id ? verificationMap[p.location_id] : undefined
    const evidence = getDirectoryEvidence(p, verification, providerResearch)
    return { p, verification, evidence,
      disposition: officeMapDisposition(p, evidence),
      selected: matchesDirectoryResearch(verification, researchFilter, evidence.hasAnyEvidence) }
  }), [filteredPractices, verificationMap, providerResearch, researchFilter])

  const counts = useMemo(() => {
    const result = { mapped: 0, missing_coordinates: 0, missing_office_evidence: 0, missing_both: 0, outside_filter: 0,
      contact: 0, ownershipOnly: 0, ownership: 0, checked: 0, provider: 0, commercial: 0, any: 0 }
    for (const a of assessed) {
      if (a.p.ownership_tier) result.ownership++
      if (a.verification) result.checked++
      if (a.evidence.providerResearch.length) result.provider++
      if (a.p.data_axle_import_date) result.commercial++
      if (a.evidence.hasAnyEvidence) result.any++
      if (!a.selected) { result.outside_filter++; continue }
      result[a.disposition]++
      if (a.disposition === 'mapped') {
        if (a.evidence.contact) result.contact++
        else result.ownershipOnly++
      }
    }
    return result
  }, [assessed])

  // Render only stored coordinates; unlocated offices remain in the directory.
  const geocoded = useMemo<MapPractice[]>(() => {
    const results: MapPractice[] = []

    for (const { p, verification, evidence, disposition, selected } of assessed) {
      if (!selected || disposition !== 'mapped') continue
      const bucket = tierToBucket(p.ownership_tier)
      const coordinates = getOfficeCoordinates(p)
      if (!coordinates) continue
      const { lat, lon } = coordinates

      const emp = p.employee_count != null ? Number(p.employee_count) : 0

      const baseColor: MapPractice['color'] = evidence.contact ? [13, 148, 136, 200] : [37, 99, 235, 200]
      const lane = deriveJobLane(
        p,
        p.location_id ? verificationMap[p.location_id] : undefined
      )

      results.push({
        map_lat: lat,
        map_lon: lon,
        location_id: p.location_id ?? null,
        practice_name: verifiedDisplayName(p, verification?.public_practice_name),
        evidence_label: evidence.contact ? 'Office website/doctor evidence on file' : 'Ownership source evidence only — contacts not checked',
        contact_checked: verification?.last_checked_at?.slice(0, 10) ?? 'Not checked',
        doctors: verification?.doctors?.map(d => d.name).join(', ') || 'Not on file',
        address: p.address ?? '--',
        city_zip: `${p.city ?? ''}, ${p.state ?? ''} ${(p.zip ?? '').toString().slice(0, 5)}`,
        ownership_label:
          bucket === 'unresolved'
            ? 'Needs ownership answer — no final answer yet'
            : BUCKET_META[bucket].label,
        lane_label: lane.label,
        lane_color: lane.color,
        gaps: lane.missing.join(' · '),
        network: p.network_id ? formatNetworkId(p.network_id) : '--',
        employees: emp ? emp.toString() : '--',
        year:
          p.year_established != null && Number(p.year_established) > 0
            ? Math.floor(Number(p.year_established)).toString()
            : '--',
        color: baseColor,
      })
    }

    return results
  }, [assessed, verificationMap])

  return (
    <div>
      <SectionHeader
        title="Practice Evidence Map"
        helpText="A dot requires stored coordinates plus office-level ownership source evidence or a positive website/doctor check. Older evidence is included and is not proof of current operations. Provider-only research and commercial estimates do not verify an office address. No ZIP-center pins."
      />
      <p className="text-xs text-[#6B6B60] mb-3" role="status">
        {geocoded.length.toLocaleString()} offices mapped ·{' '}
        {(filteredPractices.length - geocoded.length).toLocaleString()} not pinned of {filteredPractices.length.toLocaleString()} tracked offices — all remain available in the Directory.
      </p>

      <p className="text-xs text-[#6B6B60] mb-3">
        Overlapping research coverage (do not add): {counts.ownership.toLocaleString()} ownership-classified ·{' '}
        {counts.checked.toLocaleString()} contact checks · {counts.provider.toLocaleString()} with source-linked provider dossiers ·{' '}
        {counts.commercial.toLocaleString()} commercially enriched (estimates, not verification).{' '}
        {counts.any.toLocaleString()} distinct offices have source-backed ownership, contact, or linked-provider research.
      </p>
      {onResearchFilterChange && <label className="block text-xs mb-3">Research filter (shared with Directory){' '}
        <select value={researchFilter} onChange={e => onResearchFilterChange(e.target.value as DirectoryResearchFilter)} className="border rounded p-2">
          <option value="all">All tracked offices</option>
          <option value="any_evidence">Any source-backed research</option>
          <option value="recent_evidence">Website/doctor evidence — last 90 days</option>
          <option value="any_research">Any contact research check</option>
        </select>
      </label>}
      <div aria-label="Map evidence legend" className="rounded border border-[#E8E5DE] bg-white p-3 mb-3 text-xs space-y-1">
        <div><span className="text-[#0D9488]">●</span> Website/doctor evidence + coordinates: {counts.contact.toLocaleString()}</div>
        <div><span className="text-[#2563EB]">●</span> Ownership source evidence + coordinates (no positive contact check): {counts.ownershipOnly.toLocaleString()}</div>
        <div>Not pinned — office evidence, but no usable coordinates: {counts.missing_coordinates.toLocaleString()}</div>
        <div>Not pinned — coordinates, but insufficient office evidence: {counts.missing_office_evidence.toLocaleString()}</div>
        <div>Not pinned — missing both coordinates and office evidence: {counts.missing_both.toLocaleString()}</div>
        {counts.outside_filter > 0 && <div>Outside selected research filter: {counts.outside_filter.toLocaleString()}</div>}
        <p className="text-[#6B6B60]">Missing coordinates does not mean dirty research. Provider-only evidence may concern another office.
          {' '}Dots use stored coordinates, not independently verified address accuracy; no approximations or new geocoding.</p>
      </div>

      {geocoded.length === 0 ? (
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
          No offices with both office-level evidence and usable coordinates in this selection. Find these offices in the Directory.
        </div>
      ) : (
        <>
          {/* Map — raw mapboxgl dot layer */}
          <PracticeMapInner
            geocoded={geocoded}
            centerLat={centerLat}
            centerLon={centerLon}
            onOpenPractice={(locationId) =>
              router.push(`/practice/${encodeURIComponent(locationId)}`)
            }
          />

        </>
      )}
    </div>
  )
}
