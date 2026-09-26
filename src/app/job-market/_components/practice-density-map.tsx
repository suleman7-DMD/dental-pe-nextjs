'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type mapboxgl from 'mapbox-gl'
import { getOfficeCoordinates } from '@/lib/utils/directory-visibility'
import { displayName } from '@/lib/census/display-name'
import { escapeHtml } from '@/lib/utils/escape-html'
import { mapIssue, researchState, RESEARCH_META, RESEARCH_STATES } from '@/lib/directory/live-directory'
import { ResearchBadge } from '@/components/directory/live-summary'
import type { LiveOffice as Practice } from '@/lib/directory/live-directory'

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
  providerResearch?: unknown
  researchFilter?: unknown
  onResearchFilterChange?: unknown
}
interface MapPractice {
  map_lat: number
  map_lon: number
  location_id: string | null
  practice_name: string
  address: string
  city_zip: string
  color: [number, number, number, number]
  evidence_label: string
  checked_at: string
}
function mapFeatures(rows: MapPractice[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: rows.map(d => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [d.map_lon, d.map_lat] },
    properties: { location_id: d.location_id, name: d.practice_name, address: d.address,
      city_zip: d.city_zip, evidence_label: d.evidence_label, checked_at: d.checked_at,
      r: d.color[0], g: d.color[1], b: d.color[2] },
  })) }
}

// ────────────────────────────────────────────────────────────────────────────
// Colors describe the evidence supporting a dot, not ownership type.
// ────────────────────────────────────────────────────────────────────────────



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
  const geoRef = useRef(geocoded)
  geoRef.current = geocoded
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapError, setMapError] = useState(false)
  const [contextLayer, setContextLayer] = useState<'none' | 'population' | SocioeconomicMetric>('none')
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
        map.addSource('practices', { type: 'geojson', data: mapFeatures(geoRef.current) })

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

        popupRef.current = popup
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
                <span>${escapeHtml(props.checked_at)}</span><br/>
                <span style="color:#747970">Stored location; dot color describes the office check, not coordinate accuracy.</span><br/>
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

    initMap().catch(() => { if (!cancelled) setMapError(true) })
    return () => {
      cancelled = true
      if (map) map.remove()
      mapObjRef.current = null
      tractPopupRef.current = null
    }
  }, [centerLat, centerLon])

  useEffect(() => {
    const source = mapObjRef.current?.getSource('practices') as mapboxgl.GeoJSONSource | undefined
    source?.setData(mapFeatures(geocoded))
    popupRef.current?.remove()
  }, [geocoded])

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
      <details className="rounded-xl border border-[#E8E5DE] bg-white p-3 mb-3 space-y-3"><summary className="cursor-pointer text-xs font-medium text-[#747970]">Map layers & display</summary>
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
      </details>
      {mapError && <p role="alert" className="mb-3 text-sm text-amber-700">Map tiles are unavailable. All practices remain in the List view.</p>}
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-[#E8E5DE] overflow-hidden"
      style={{ height: 'min(66vh, 680px)', minHeight: 360 }}
    />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Office evidence and coordinates are independent gates. Provider-only
// research stays in the directory without pretending to validate an address.
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDensityMap({ practices, centerLat, centerLon }: PracticeDensityMapProps) {
  const router = useRouter()
  const counts = { missing_coordinates: 0, address_changed: 0, removed: 0 }
  for (const p of practices) { const issue = mapIssue(p); if (issue) counts[issue]++ }
  const geocoded = useMemo<MapPractice[]>(() => practices.filter(p => !mapIssue(p)).map(p => {
    const coordinates = getOfficeCoordinates(p)!
    const meta = RESEARCH_META[researchState(p)]
    const rgb = meta.color.slice(1).match(/.{2}/g)!.map(v => parseInt(v, 16))
    return { map_lat: coordinates.lat, map_lon: coordinates.lon, location_id: p.location_id ?? null,
      practice_name: displayName(p), address: p.address ?? 'Address not on file', city_zip: `${p.city ?? ''} ${p.zip ?? ''}`,
      evidence_label: meta.label, checked_at: p.web_check?.checked_at ? `Checked ${new Date(p.web_check.checked_at).toLocaleDateString()}` : 'Not yet checked by the office validator',
      color: [rgb[0], rgb[1], rgb[2], 230],
    }
  }), [practices])
  const listed = practices.length - counts.removed
  return <section aria-label="Live directory map" data-mapped-count={geocoded.length} className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#747970]">
      <p role="status"><strong className="text-[#253C34]">{geocoded.length.toLocaleString()} mapped</strong> of {listed.toLocaleString()} listed in this view</p>
      <div className="flex flex-wrap gap-4" aria-label="Map dot colors">{RESEARCH_STATES.map(s => <ResearchBadge key={s} state={s} />)}</div>
    </div>
    <details className="text-xs text-[#747970]"><summary className="cursor-pointer">Why some practices have no dot</summary><div className="space-y-1.5 py-2 leading-5">
      <p>{counts.missing_coordinates.toLocaleString()} have no usable stored coordinates. {counts.address_changed.toLocaleString()} have a corrected street address awaiting matching coordinates.</p>
      <p>All other listed practices get a dot, including records not yet checked. Removed records never appear. No ZIP-center placeholders are added.</p>
      <p>The count is for the whole selected dataset, not just this viewport. Zoom and pan to see other locations. Offices at the same coordinates can overlap. Stored coordinates are not independently verified by an office check.</p>
    </div></details>
    <PracticeMapInner geocoded={geocoded} centerLat={centerLat} centerLon={centerLon} onOpenPractice={id => router.push(`/practice/${encodeURIComponent(id)}`)} />
  </section>
}
