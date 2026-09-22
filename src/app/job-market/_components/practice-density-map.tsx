'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
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
import { POPULATION_BOUNDS, POPULATION_GRADIENT, POPULATION_LAYER_ID, POPULATION_LEGEND,
  POPULATION_MAX_ZOOM, POPULATION_MIN_ZOOM, POPULATION_SOURCE_ID } from '@/lib/maps/population-density'
import { acsNumber, formatSocioeconomicValue, socioeconomicColor, socioeconomicValue,
  SOCIOECONOMIC_DATA, SOCIOECONOMIC_LAYER, SOCIOECONOMIC_METRICS, SOCIOECONOMIC_SOURCE,
  type SocioeconomicMetric } from '@/lib/maps/socioeconomic'

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
  const [contextLayer, setContextLayer] = useState<'none' | 'population' | SocioeconomicMetric>('population')
  const populationEnabled = contextLayer === 'population'
  const socioeconomicMetric = contextLayer === 'income' || contextLayer === 'education' ? contextLayer : null
  const [populationOpacity, setPopulationOpacity] = useState(0.65)
  const [showPractices, setShowPractices] = useState(true)
  const [populationStatus, setPopulationStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [acsStatus, setAcsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const tractPopupRef = useRef<mapboxgl.Popup | null>(null)
  const presentation = useRef({ populationEnabled, populationOpacity, showPractices, socioeconomicMetric })
  presentation.current = { populationEnabled, populationOpacity, showPractices, socioeconomicMetric }
  // Ref so a changing callback identity never tears down and re-creates the map
  const onOpenPracticeRef = useRef(onOpenPractice)
  onOpenPracticeRef.current = onOpenPractice

  useEffect(() => {
    if (!mapRef.current) return

    let map: mapboxgl.Map | null = null
    let cancelled = false
    let populationFailed = false
    let acsFailed = false
    setPopulationStatus('loading')
    setAcsStatus('loading')

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
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right')
      map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('error', e => {
        const sourceId = (e as unknown as { sourceId?: string }).sourceId
        if (sourceId === POPULATION_SOURCE_ID || e.error?.message?.includes('/api/population-tiles/')) {
          populationFailed = true
          if (!cancelled) setPopulationStatus('error')
        }
        if (sourceId === SOCIOECONOMIC_SOURCE || e.error?.message?.includes(SOCIOECONOMIC_DATA)) {
          acsFailed = true
          if (!cancelled) setAcsStatus('error')
        }
      })
      map.on('sourcedata', e => {
        if (e.sourceId === POPULATION_SOURCE_ID && e.isSourceLoaded && !populationFailed && !cancelled) setPopulationStatus('ready')
        if (e.sourceId === SOCIOECONOMIC_SOURCE && e.isSourceLoaded && !acsFailed && !cancelled) setAcsStatus('ready')
      })

      map.on('load', () => {
        if (!map) return
        map.addSource(POPULATION_SOURCE_ID, {
          type: 'raster', tiles: [`${window.location.origin}/api/population-tiles/{z}/{x}/{y}`],
          tileSize: 256, bounds: POPULATION_BOUNDS, minzoom: POPULATION_MIN_ZOOM, maxzoom: POPULATION_MAX_ZOOM,
          attribution: '<a href="https://www.worldpop.org/">WorldPop 2026</a> · <a href="https://citydensity.com/city/chicago-united-states">CityDensity tiles</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
        })
        // Below labels and practice dots; the population layer never changes office eligibility.
        const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id
        map.addLayer({ id: POPULATION_LAYER_ID, type: 'raster', source: POPULATION_SOURCE_ID,
          layout: { visibility: presentation.current.populationEnabled ? 'visible' : 'none' },
          paint: { 'raster-opacity': presentation.current.populationOpacity, 'raster-resampling': 'linear' },
        }, firstLabel)

        map.addSource(SOCIOECONOMIC_SOURCE, { type: 'geojson', data: SOCIOECONOMIC_DATA,
          attribution: '<a href="https://www.census.gov/programs-surveys/acs">U.S. Census ACS 2020–2024</a> · <a href="https://www.arcgis.com/home/item.html?id=c9faa265b82848498bc0a8390c0afa65">Esri</a>',
        })
        map.addLayer({ id: SOCIOECONOMIC_LAYER, type: 'fill', source: SOCIOECONOMIC_SOURCE,
          layout: { visibility: presentation.current.socioeconomicMetric ? 'visible' : 'none' },
          paint: { 'fill-color': socioeconomicColor(presentation.current.socioeconomicMetric ?? 'income'),
            'fill-opacity': presentation.current.populationOpacity, 'fill-outline-color': 'rgba(80,80,80,0.25)' },
        }, firstLabel)

        const tractPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px' })
        tractPopupRef.current = tractPopup
        map.on('mousemove', SOCIOECONOMIC_LAYER, e => {
          const metric = presentation.current.socioeconomicMetric
          if (!map || !metric || !e.features?.[0] || map.queryRenderedFeatures(e.point, { layers: ['practice-dots'] }).length) {
            tractPopup.remove()
            return
          }
          const props = e.features[0].properties ?? {}
          const config = SOCIOECONOMIC_METRICS[metric]
          const value = socioeconomicValue(props, metric)
          const moe = value === null ? null : acsNumber(props[config.moe])
          const margin = moe === null ? 'Margin of error unavailable' : metric === 'income'
            ? `90% margin of error: ±$${Math.round(moe).toLocaleString('en-US')}`
            : `90% margin of error: ±${moe.toFixed(1)} percentage points`
          tractPopup.setLngLat(e.lngLat).setHTML(`<div style="font:12px/1.5 system-ui;color:#1A1A1A">
            <strong>${escapeHtml(props.NAME)} · ${escapeHtml(props.County)}</strong><br/>
            ${escapeHtml(config.label)}<br/><strong>${escapeHtml(formatSocioeconomicValue(value, metric))}</strong><br/>
            ${escapeHtml(margin)}<br/>ACS 2020–2024 · ${escapeHtml(config.unit)}<br/>
            Tract estimate, not an individual patient characteristic.</div>`).addTo(map)
        })
        map.on('mouseleave', SOCIOECONOMIC_LAYER, () => tractPopup.remove())
        map.on('movestart', () => tractPopup.remove())

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
          layout: { visibility: presentation.current.showPractices ? 'visible' : 'none' },
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              8, 2.5,
              10, 4,
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
            'circle-stroke-width': 1.2,
            'circle-stroke-color': '#FFFFFF',
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
          tractPopup.remove()
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
      tractPopupRef.current = null
    }
  }, [geocoded, centerLat, centerLon])

  useEffect(() => {
    const map = mapObjRef.current
    if (map?.getLayer(POPULATION_LAYER_ID)) {
      map.setLayoutProperty(POPULATION_LAYER_ID, 'visibility', populationEnabled ? 'visible' : 'none')
      map.setPaintProperty(POPULATION_LAYER_ID, 'raster-opacity', populationOpacity)
    }
    if (map?.getLayer('practice-dots')) map.setLayoutProperty('practice-dots', 'visibility', showPractices ? 'visible' : 'none')
    if (map?.getLayer(SOCIOECONOMIC_LAYER)) {
      map.setLayoutProperty(SOCIOECONOMIC_LAYER, 'visibility', socioeconomicMetric ? 'visible' : 'none')
      map.setPaintProperty(SOCIOECONOMIC_LAYER, 'fill-opacity', populationOpacity)
      if (socioeconomicMetric) map.setPaintProperty(SOCIOECONOMIC_LAYER, 'fill-color', socioeconomicColor(socioeconomicMetric))
    }
    tractPopupRef.current?.remove()
  }, [populationEnabled, populationOpacity, showPractices, socioeconomicMetric])

  return (
    <div>
      <div className="rounded border border-[#E8E5DE] bg-white p-3 mb-3 space-y-3">
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex items-center gap-2">Map layer
            <select className="rounded border border-[#D4D0C8] bg-white p-1.5" value={contextLayer} onChange={e => setContextLayer(e.target.value as typeof contextLayer)}>
              <option value="none">None — practices only</option>
              <option value="population">Population density</option>
              <option value="income">Median household income</option>
              <option value="education">Education: bachelor’s degree or higher</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showPractices} onChange={e => setShowPractices(e.target.checked)} />Show practice dots</label>
          <label className="flex items-center gap-2">Layer opacity
            <input type="range" min="0" max="100" step="5" value={Math.round(populationOpacity * 100)} disabled={contextLayer === 'none'}
              onChange={e => setPopulationOpacity(Number(e.target.value) / 100)} />
            <span>{Math.round(populationOpacity * 100)}%</span>
          </label>
        </div>
        {populationEnabled && <>
          <div className="text-xs font-medium">People per square mile · WorldPop 2026 modeled population</div>
          <div className="w-[320px] max-w-full">
            <div className="h-3 rounded" style={{ background: POPULATION_GRADIENT }} />
            <div className="relative h-5 text-[10px] text-[#6B6B60]">
              {POPULATION_LEGEND.map((stop, i) => <span key={stop.position} className="absolute" style={{ left: `${stop.position}%`, transform: i === 0 ? undefined : i === 4 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {stop.perSquareMile === 0 ? '0' : `${(stop.perSquareMile / 1000).toFixed(1)}k`}{i === 4 ? '+' : ''}
              </span>)}
            </div>
          </div>
          <p className="text-xs text-[#6B6B60]">100-metre source grid (about 328 ft), rendered by CityDensity. Regional context, not clipped to the tracked ZIP boundaries.
            {' '}Transparent/light areas are not proof of zero residents.</p>
          {populationStatus === 'loading' && <p className="text-xs text-[#6B6B60]">Loading population tiles…</p>}
          {populationStatus === 'error' && <p role="alert" className="text-xs text-[#C23B3B]">Population tiles are unavailable or incomplete. Blank areas are not zero population. Practice dots remain available; reload to retry.</p>}
        </>}
        {socioeconomicMetric && <>
          <div className="text-xs font-medium">{SOCIOECONOMIC_METRICS[socioeconomicMetric].unit} · Census ACS 2020–2024</div>
          <div className="w-[360px] max-w-full">
            <div className="h-3 rounded" style={{ background: `linear-gradient(to right, ${SOCIOECONOMIC_METRICS[socioeconomicMetric].colors.join(',')})` }} />
            <div className="flex justify-between text-[10px] text-[#6B6B60]">{SOCIOECONOMIC_METRICS[socioeconomicMetric].labels.map(label => <span key={label}>{label}</span>)}</div>
          </div>
          <p className="text-xs text-[#6B6B60]"><span className="inline-block h-2.5 w-2.5 bg-[#b8bec5] mr-1" />Gray = no estimate. Hover a tract for its estimate and 90% margin of error.</p>
          <p className="text-xs text-[#6B6B60]">Illinois census-tract estimates across the map region, not ZIP boundaries or a people-density heatmap. Outside coverage is blank. Five-year estimates, not live 2026 conditions.
            {' '}Income and education provide neighborhood context; they do not establish dental insurance coverage, patient demand, or practice profitability.</p>
          {acsStatus === 'loading' && <p className="text-xs text-[#6B6B60]">Loading Census tract estimates…</p>}
          {acsStatus === 'error' && <p role="alert" className="text-xs text-[#C23B3B]">Census layer is unavailable. Blank areas are not zero income or education. Practice dots remain available; reload to retry.</p>}
          <p className="text-xs text-[#6B6B60]"><a className="underline" href={SOCIOECONOMIC_METRICS[socioeconomicMetric].source} target="_blank" rel="noopener noreferrer">Census ACS via Esri · source and methodology</a>
            {' · '}<a className="underline" href="/data/chicagoland-acs-2024.metadata.json" target="_blank" rel="noopener noreferrer">Snapshot provenance</a></p>
        </>}
        <p className="text-xs text-[#6B6B60]">Compare neighborhood context with white-outlined practice dots. This is not a saturation score:
          {' '}unmapped offices, missing practices, commuters, and travel across ZIPs can change the picture.</p>
        {populationEnabled && <p className="text-xs text-[#6B6B60]">
          <a className="underline" href="https://citydensity.com/city/chicago-united-states" target="_blank" rel="noopener noreferrer">CityDensity population layer</a>
          {' · '}<a className="underline" href="https://www.worldpop.org/faq/" target="_blank" rel="noopener noreferrer">WorldPop · CC BY 4.0</a>
        </p>}
      </div>
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-[#E8E5DE] overflow-hidden"
      style={{ height: 620, boxShadow: '0 0 40px rgba(184, 134, 11, 0.06), 0 4px 24px rgba(0, 0, 0, 0.08)' }}
    />
    </div>
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

    // Provider dossiers affect coverage counts, not marker eligibility. Loading
    // those dossiers must not tear down a map the user is already inspecting.
    for (const p of filteredPractices) {
      const verification = p.location_id ? verificationMap[p.location_id] : undefined
      const evidence = getDirectoryEvidence(p, verification)
      if (officeMapDisposition(p, evidence) !== 'mapped' ||
          !matchesDirectoryResearch(verification, researchFilter, evidence.hasAnyEvidence)) continue
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
  }, [filteredPractices, verificationMap, researchFilter])

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

      {geocoded.length === 0 && (
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
          No offices with both office-level evidence and usable coordinates in this selection. Find these offices in the Directory.
        </div>
      )}
      <PracticeMapInner
        geocoded={geocoded}
        centerLat={centerLat}
        centerLon={centerLon}
        onOpenPractice={(locationId) => router.push(`/practice/${encodeURIComponent(locationId)}`)}
      />
    </div>
  )
}
