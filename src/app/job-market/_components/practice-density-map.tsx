'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type mapboxgl from 'mapbox-gl'
import { getOfficeCoordinates } from '@/lib/utils/directory-visibility'
import { displayName } from '@/lib/census/display-name'
import { escapeHtml } from '@/lib/utils/escape-html'
import { MAP_META, MAP_STATES, mapState, mapRoster, type MapState } from '@/lib/maps/directory-map'
import { Check, CircleHelp, LocateFixed, X, ArrowUpRight, Maximize2, Minimize2 } from 'lucide-react'
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
  status: MapState
  evidence_label: string
  checked_at: string
  coord_note: string
  approx: boolean
}
function mapFeatures(rows: MapPractice[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: rows.map(d => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [d.map_lon, d.map_lat] },
    properties: { location_id: d.location_id, name: d.practice_name, address: d.address,
      city_zip: d.city_zip, evidence_label: d.evidence_label, checked_at: d.checked_at, coord_note: d.coord_note,
      r: d.color[0], g: d.color[1], b: d.color[2], status: d.status, approx: d.approx ? 1 : 0 },
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
  status, onStatusChange, showApprox, onShowApproxChange,
}: {
  geocoded: MapPractice[]
  centerLat: number
  centerLon: number
  status: MapState | 'all'
  onStatusChange: (value: MapState | 'all') => void
  showApprox: boolean
  onShowApproxChange: (value: boolean) => void
  onOpenPractice: (locationId: string) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<mapboxgl.Map | null>(null)
  const geoRef = useRef(geocoded)
  geoRef.current = geocoded
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapError, setMapError] = useState(false)
  const [ready, setReady] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [showVisible, setShowVisible] = useState(false)
  const selectedOffices = useMemo(() => { const ids = new Set(selection); return geocoded.filter(p => p.location_id && ids.has(p.location_id)) }, [geocoded, selection])
  const visibleOffices = useMemo(() => { const ids = new Set(visibleIds); return geocoded.filter(p => p.location_id && ids.has(p.location_id)) }, [geocoded, visibleIds])
  const updateViewport = () => {
    const map = mapObjRef.current
    if (!map) return
    const bounds = map.getBounds()
    setVisibleIds(geoRef.current.filter(p => bounds?.contains([p.map_lon, p.map_lat])).map(p => p.location_id ?? ''))
  }
  const fitPractices = () => {
    const rows = geoRef.current
    if (!rows.length || !mapObjRef.current) return
    const lons = rows.map(p => p.map_lon), lats = rows.map(p => p.map_lat)
    mapObjRef.current.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 55, maxZoom: 15, duration: 600 })
  }
  const [contextLayer, setContextLayer] = useState<'none' | 'population' | SocioeconomicMetric>('none')
  const populationEnabled = contextLayer === 'population'
  const socioeconomicMetric = contextLayer === 'income' || contextLayer === 'education' ? contextLayer : null
  const [populationOpacity, setPopulationOpacity] = useState(0.45)
  const [showPractices, setShowPractices] = useState(true)
  const [populationStatus, setPopulationStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [acsStatus, setAcsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const tractPopupRef = useRef<mapboxgl.Popup | null>(null)
  const presentation = useRef({ populationEnabled, populationOpacity, showPractices, socioeconomicMetric })
  presentation.current = { populationEnabled, populationOpacity, showPractices, socioeconomicMetric }

  useEffect(() => {
    if (!mapRef.current) return

    let map: mapboxgl.Map | null = null
    let cancelled = false
    let populationFailed = false
    let acsFailed = false
    setReady(false)
    setMapError(false)
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
      // The CSS expand control also works on iPhone, without Fullscreen API support.
      map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('error', e => {
        const sourceId = (e as unknown as { sourceId?: string }).sourceId
        if (sourceId === POPULATION_SOURCE_ID || e.error?.message?.includes('/api/population-tiles/')) {
          populationFailed = true
          if (!cancelled) setPopulationStatus('error')
        }
        if (!sourceId && /token|unauthorized|forbidden|style/i.test(e.error?.message ?? '')) setMapError(true)
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
          if (!map || !metric || !e.features?.[0] || (map.getLayer('practice-hit') && map.queryRenderedFeatures(e.point, { layers: ['practice-hit'] }).length)) {
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

        map.addLayer({ id: 'practice-halo', type: 'circle', source: 'practices',
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 9, 16, 12],
            'circle-color': '#142C36', 'circle-opacity': 0.75, 'circle-blur': 0.25 } })
        // Solid status colors sit above every demographic layer.
        // Scale radius with zoom: tiny at zoom 9, bigger when zoomed in
        map.addLayer({
          id: 'practice-dots',
          type: 'circle',
          source: 'practices',
          layout: { visibility: presentation.current.showPractices ? 'visible' : 'none' },
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              8, 4.5,
              10, 5.5,
              12, 6.5,
              14, 8,
            ],
            // Address-geocoded dots are hollow rings: same status color, visibly approximate.
            'circle-color': ['case', ['==', ['get', 'approx'], 1], '#FFFFFF', ['rgb', ['get', 'r'], ['get', 'g'], ['get', 'b']]],
            'circle-opacity': 1,
            'circle-stroke-width': ['case', ['==', ['get', 'approx'], 1], 2.6, 2.2],
            'circle-stroke-color': ['case', ['==', ['get', 'approx'], 1], ['rgb', ['get', 'r'], ['get', 'g'], ['get', 'b']], '#FFFFFF'],
          },
        })

        // A generous invisible hit target makes isolated dots easier to tap.
        map.addLayer({ id: 'practice-hit', type: 'circle', source: 'practices',
          paint: { 'circle-radius': 14, 'circle-opacity': 0 } })
        setReady(true)
        updateViewport()
        map.on('moveend', updateViewport)
        map.on('resize', updateViewport)

        // Popup on hover — light panel styling
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '280px',
        })

        popupRef.current = popup
        map.on('mouseenter', 'practice-hit', (e) => {
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
                <span style="color:#747970">${escapeHtml(props.coord_note)} Dot color describes the office check.</span><br/>
                <span style="color:#8B6508">Tap or click to preview this location</span>
              </div>`
            )
            .addTo(map)
        })

        map.on('mouseleave', 'practice-hit', () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          popup.remove()
        })

        // Select every overlapping office rather than silently opening the first.
        map.on('click', 'practice-hit', e => {
          if (!map) return
          popup.remove(); tractPopup.remove()
          const hits = map.queryRenderedFeatures(e.point, { layers: ['practice-hit'] })
          setSelection([...new Set(hits.map(f => f.properties?.location_id).filter((id): id is string => typeof id === 'string' && !!id))])
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
    updateViewport()
  }, [geocoded])

  useEffect(() => {
    const map = mapObjRef.current
    if (map?.getLayer(POPULATION_LAYER_ID)) {
      map.setLayoutProperty(POPULATION_LAYER_ID, 'visibility', populationEnabled ? 'visible' : 'none')
      map.setPaintProperty(POPULATION_LAYER_ID, 'raster-opacity', populationOpacity)
    }
    for (const id of ['practice-dots', 'practice-halo', 'practice-hit']) {
      if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', showPractices ? 'visible' : 'none')
    }
    if (map?.getLayer('practice-dots')) {
      const boost = populationEnabled || socioeconomicMetric ? 1.6 : 0
      map.setPaintProperty('practice-dots', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 8, 4.5 + boost, 12, 6.5 + boost, 16, 9 + boost])
      map.setPaintProperty('practice-halo', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 8, 7 + boost, 12, 9 + boost, 16, 12 + boost])
    }
    if (map?.getLayer(SOCIOECONOMIC_LAYER)) {
      map.setLayoutProperty(SOCIOECONOMIC_LAYER, 'visibility', socioeconomicMetric ? 'visible' : 'none')
      map.setPaintProperty(SOCIOECONOMIC_LAYER, 'fill-opacity', populationOpacity)
      if (socioeconomicMetric) map.setPaintProperty(SOCIOECONOMIC_LAYER, 'fill-color', socioeconomicColor(socioeconomicMetric))
    }
    tractPopupRef.current?.remove()
  }, [populationEnabled, populationOpacity, showPractices, socioeconomicMetric, ready])

  useEffect(() => {
    mapObjRef.current?.resize()
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape) }
  }, [expanded])

  return (
    <div className={expanded ? 'fixed inset-0 z-50 flex flex-col overflow-auto bg-[#F6F8F5] p-3 pb-[env(safe-area-inset-bottom)] sm:p-5' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DFE5DE] bg-white p-2.5 shadow-sm">
        {expanded && <label className="flex w-full items-center gap-2 text-xs text-[#52625A]">Office checks<select aria-label="Expanded map status" value={status} onChange={e => onStatusChange(e.target.value as MapState | 'all')} className="min-h-11 flex-1 rounded-xl bg-[#F1F5EF] px-3 text-base sm:text-sm"><option value="all">All statuses</option>{MAP_STATES.map(s => <option key={s} value={s}>{MAP_META[s].label}</option>)}</select></label>}
        {expanded && <label className="flex min-h-11 w-full items-center gap-2 text-xs text-[#52625A]"><input className="h-5 w-5 accent-[#253C34]" type="checkbox" checked={showApprox} onChange={e => onShowApproxChange(e.target.checked)} />Show address-geocoded dots (hollow rings)</label>}
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-[#52625A]">Layer
          <select aria-label="Map layer" className="min-h-11 min-w-0 flex-1 rounded-xl bg-[#F1F5EF] px-3 text-base text-[#253C34] sm:flex-none sm:text-sm" value={contextLayer} onChange={e => setContextLayer(e.target.value as typeof contextLayer)}>
            <option value="none">Practices only</option><option value="population">Population density</option>
            <option value="income">Median household income</option><option value="education">Education: bachelor’s degree or higher</option>
          </select>
        </label>
        <button disabled={!ready || !geocoded.length} onClick={fitPractices} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-[#DFE5DE] px-3 text-xs font-medium disabled:opacity-40"><LocateFixed className="h-4 w-4" />Fit dots</button>
        <button aria-label={expanded ? 'Exit expanded map' : 'Expand map'} aria-pressed={expanded} onClick={() => setExpanded(v => !v)} className="min-h-11 min-w-11 rounded-xl border border-[#DFE5DE] p-3">{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
        {contextLayer !== 'none' && <div className="flex w-full items-center gap-3 border-t border-[#EDF0E9] pt-2 text-xs text-[#52625A]"><label className="flex min-h-11 flex-1 items-center gap-3">Layer strength<input aria-label="Layer strength" className="min-w-16 flex-1 accent-[#253C34]" type="range" min="10" max="85" step="5" value={Math.round(populationOpacity * 100)} onChange={e => setPopulationOpacity(Number(e.target.value) / 100)} /><span className="w-8 tabular-nums">{Math.round(populationOpacity * 100)}%</span></label></div>}
      </div>
      <details className="rounded-xl border border-[#E8E5DE] bg-white p-3 text-xs text-[#626F66]"><summary className="min-h-7 cursor-pointer font-medium">Layer legend & display options</summary>
        <label className="my-2 flex min-h-11 items-center gap-2"><input className="h-5 w-5 accent-[#253C34]" type="checkbox" checked={showPractices} onChange={e => setShowPractices(e.target.checked)} />Show practice dots</label>
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
      {mapError && <p role="alert" className="text-sm text-amber-700">Interactive map unavailable in this browser. Try a browser with WebGL support, or use the directory List view.</p>}
      <div className={`relative overflow-hidden rounded-2xl border border-[#DCE3DA] bg-[#EAF0E7] shadow-sm ${expanded ? 'min-h-[55dvh] flex-1' : 'h-[60svh] min-h-[350px] sm:h-[68vh] sm:min-h-[480px]'}`}>
        <div ref={mapRef} className="absolute inset-0" aria-label="Interactive practice map" />
        {!ready && !mapError && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#F1F5EF]/90 text-sm text-[#52625A]">Loading map…</div>}
        {ready && <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-xl bg-white/95 px-3 py-2 text-xs text-[#253C34] shadow-md backdrop-blur"><strong>{showPractices ? visibleOffices.length.toLocaleString() : 'Dots hidden'}</strong>{showPractices && ' practices in this area'}<p className="mt-0.5 text-[10px] text-[#747970]">{showPractices ? 'Tap a dot to preview · pinch to zoom' : 'Enable dots in display options'}</p></div>}
        {showPractices && !!selectedOffices.length && <section aria-label="Selected map practices" className="absolute inset-x-3 bottom-8 max-h-[48%] overflow-auto overscroll-contain rounded-2xl border border-[#DCE3DA] bg-white p-4 shadow-xl sm:left-3 sm:right-auto sm:w-80">
          <div className="sticky -top-4 flex items-center justify-between bg-white pb-2"><h3 className="text-xs font-medium text-[#747970]">{selectedOffices.length > 1 ? `${selectedOffices.length} nearby / overlapping offices` : 'Practice preview'}</h3><button aria-label="Close practice preview" onClick={() => setSelection([])} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#F1F5EF]"><X className="h-4 w-4" /></button></div>
          {selectedOffices.map(p => <div key={p.location_id} className="space-y-1 border-t border-[#EDF0E9] py-3"><p className="text-xs font-medium" style={{color:MAP_META[p.status].color}}>{p.evidence_label}</p><h4 className="text-base font-semibold text-[#253C34]">{p.practice_name}</h4><p className="text-xs text-[#626F66]">{p.address} · {p.city_zip}</p><p className="text-[11px] text-[#747970]">{p.checked_at} · {p.coord_note}</p><button onClick={() => p.location_id && onOpenPractice(p.location_id)} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-medium text-[#007F73]">Open practice <ArrowUpRight className="h-4 w-4" /></button></div>)}
        </section>}
        {ready && !geocoded.length && <p className="pointer-events-none absolute inset-x-8 top-24 rounded-xl bg-white p-4 text-center text-sm text-[#52625A]">No mappable practices in this selection. Try another check status or clear your search.</p>}
      </div>
      <details open={showVisible} onToggle={e => setShowVisible(e.currentTarget.open)} className="rounded-xl border border-[#E8E5DE] bg-white p-3 text-xs text-[#626F66]"><summary className="min-h-7 cursor-pointer">Browse practices in this map area · {visibleOffices.length.toLocaleString()}</summary><div className="mt-2 max-h-64 divide-y divide-[#EDF0E9] overflow-auto">{showVisible && visibleOffices.map(p => <button key={p.location_id} onClick={() => { setSelection([p.location_id!]); mapObjRef.current?.easeTo({center:[p.map_lon,p.map_lat],duration:400}) }} className="flex min-h-12 w-full items-center gap-3 py-2 text-left"><span className="h-3 w-3 shrink-0 rounded-full" style={p.approx ? {border:`2.5px solid ${MAP_META[p.status].color}`, background:'#fff'} : {background:MAP_META[p.status].color}}/><span><strong className="font-medium text-[#253C34]">{p.practice_name}</strong><span className="block text-[11px]">{p.address} · {p.evidence_label}</span></span></button>)}</div></details>

    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Office evidence and coordinates are independent gates. Provider-only
// research stays in the directory without pretending to validate an address.
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDensityMap({ practices, centerLat, centerLon }: PracticeDensityMapProps) {
  const router = useRouter()
  const [status, setStatus] = useState<MapState | 'all'>('all')
  const [showApprox, setShowApprox] = useState(true)
  const roster = useMemo(() => mapRoster(practices, status), [practices, status])
  const geocoded = useMemo<MapPractice[]>(() => roster.mapped.filter(p => showApprox || p.coord_source !== 'census_geocoder').map(p => {
    const coordinates = getOfficeCoordinates(p)!
    const state = mapState(p), meta = MAP_META[state]
    const rgb = meta.color.slice(1).match(/.{2}/g)!.map(v => parseInt(v, 16))
    return { map_lat: coordinates.lat, map_lon: coordinates.lon, location_id: p.location_id ?? null,
      practice_name: displayName(p), address: p.address ?? 'Address not on file', city_zip: `${p.city ?? ''} ${p.zip ?? ''}`,
      status: state, evidence_label: meta.label, checked_at: p.web_check?.checked_at ? `Checked ${new Date(p.web_check.checked_at).toLocaleDateString()}` : 'Not yet checked by the office validator',
      color: [rgb[0], rgb[1], rgb[2], 255],
      coord_note: p.coord_source === 'census_geocoder' ? 'Approximate: placed by address geocode (U.S. Census).' : 'Stored location.',
      approx: p.coord_source === 'census_geocoder',
    }
  }), [roster, showApprox])
  return <section aria-label="Live directory map" data-mapped-count={geocoded.length} className="space-y-3">
    <div className="rounded-2xl border border-[#DFE5DE] bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium uppercase tracking-wider text-[#747970]">Show practices by office check</p><button onClick={() => setStatus('all')} aria-pressed={status === 'all'} className={`min-h-11 rounded-xl px-3 text-xs font-medium ${status === 'all' ? 'bg-[#253C34] text-white' : 'text-[#52625A] hover:bg-[#F1F5EF]'}`}>Show all</button></div>
      <div className="grid grid-cols-3 gap-2" aria-label="Map status filters">{MAP_STATES.map(s => <button key={s} onClick={() => setStatus(status === s ? 'all' : s)} aria-pressed={status === s} title={MAP_META[s].description} className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center text-[11px] sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-left sm:text-xs transition-colors ${status === s ? 'border-[#253C34] bg-[#F0F5ED] ring-1 ring-[#253C34]' : 'border-[#E5EAE1] hover:bg-[#F6F8F3]'}`}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{background:MAP_META[s].color}}>{status === s && <Check className="h-3.5 w-3.5" />}</span><span className="flex-1 font-medium text-[#253C34]">{MAP_META[s].label}</span><strong className="tabular-nums text-[#52625A]">{roster.counts[s].toLocaleString()}</strong></button>)}</div>
      <button onClick={() => setShowApprox(v => !v)} aria-pressed={showApprox} title="Offices without stored coordinates, placed from their listed address. Many are still being checked and may be corrected or removed." className={`mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${showApprox ? 'border-[#253C34] bg-[#F0F5ED]' : 'border-dashed border-[#C9D1C6] text-[#747970] hover:bg-[#F6F8F3]'}`}>
        <span className="h-4 w-4 shrink-0 rounded-full border-[2.5px] border-[#52625A] bg-white" />
        <span className="flex-1"><span className="font-medium text-[#253C34]">Address-geocoded dots {showApprox ? 'on' : 'off'}</span><span className="block text-[11px] text-[#747970]">Hollow rings · approximate location from the listed address; the record may still be corrected or removed</span></span>
        <strong className="tabular-nums text-[#52625A]">{roster.geocoded.toLocaleString()}</strong>
        <span className={`rounded-lg px-2 py-1 text-[11px] font-medium ${showApprox ? 'bg-[#253C34] text-white' : 'bg-[#E5EAE1] text-[#52625A]'}`}>{showApprox ? 'Hide' : 'Show'}</span>
      </button>
      <p className="mt-2 text-[11px] text-[#747970]">Confirmed includes corrected offices. Counts reflect your directory search and area; some records lack map coordinates.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#747970]"><p role="status"><strong className="text-[#253C34]">{geocoded.length.toLocaleString()} mapped</strong> of {roster.listed.length.toLocaleString()} listed in this selection{!showApprox && roster.geocoded > 0 && ` · ${roster.geocoded.toLocaleString()} address-geocoded dots turned off`}</p><span>Colors follow the latest validator result</span></div>
    <PracticeMapInner status={status} onStatusChange={setStatus} showApprox={showApprox} onShowApproxChange={setShowApprox} geocoded={geocoded} centerLat={centerLat} centerLon={centerLon} onOpenPractice={id => router.push(`/practice/${encodeURIComponent(id)}`)} />
    <details className="rounded-xl border border-[#E8E5DE] bg-white p-3 text-xs text-[#747970]"><summary className="flex min-h-7 cursor-pointer items-center gap-2"><CircleHelp className="h-4 w-4" />Why some practices have no dot</summary><div className="space-y-1.5 py-2 leading-5">
      <p>{roster.missing.toLocaleString()} have no usable stored coordinates. {roster.moved.toLocaleString()} have a corrected street address awaiting matching coordinates.</p>
      <p>All other listed practices get a dot, including records not yet checked. Removed records never appear. No ZIP-center placeholders are added.</p>
      <p>{roster.geocoded.toLocaleString()} dots in this selection are placed by a U.S. Census address geocode because the record had no stored coordinates or its street was corrected. They are drawn as hollow rings and can be turned off with the address-geocoded toggle. A geocode is dropped automatically if the address changes again, and removed records lose their dot on the next refresh.</p>
      <p>Mapped counts cover the full selection; the in-area count follows your viewport. Overlapping offices stay separate records: tap their dot to choose an office. Stored coordinates are not independently verified by an office check.</p>
    </div></details>
  </section>
}
