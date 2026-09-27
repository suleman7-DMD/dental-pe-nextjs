'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type mapboxgl from 'mapbox-gl'
import type { ExpressionSpecification } from 'mapbox-gl'
import { ArrowUpRight, ChevronRight, CircleHelp, Layers, List, LocateFixed, Maximize2, Minimize2, Phone, X } from 'lucide-react'
import { getOfficeCoordinates } from '@/lib/utils/directory-visibility'
import { displayName } from '@/lib/census/display-name'
import { escapeHtml } from '@/lib/utils/escape-html'
import { changedStatuses, MAP_META, MAP_STATES, mapRoster, mapState, type MapState } from '@/lib/maps/directory-map'
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
  /** Live feed metadata, shown on the map so the dots' freshness is visible. */
  syncedAt?: string
  refreshing?: boolean
  stale?: boolean
  /** Records the validator removed; never mapped, reported for reconciliation. */
  removedCount?: number
  onShowRemoved?: () => void
  providerResearch?: unknown
  researchFilter?: unknown
  onResearchFilterChange?: unknown
}
interface MapOffice {
  id: string
  lat: number
  lon: number
  name: string
  address: string
  cityZip: string
  phone: string | null
  status: MapState
  checkedAt: string | null
  approx: boolean
}
type ContextLayer = 'none' | 'population' | SocioeconomicMetric

const SOURCE = 'offices'
const L = { casing: 'office-casing', dots: 'office-dots', pulse: 'office-pulse', selected: 'office-selected', hit: 'office-hit' } as const
const STATUS_RANK: Record<MapState, number> = { unchecked: 1, unresolved: 2, confirmed: 3 }
const STATUS_COLOR = ['match', ['get', 'status'], ...MAP_STATES.flatMap(s => [s, MAP_META[s].color]), '#64748B'] as unknown as ExpressionSpecification
const FRESH_MS = 90_000

const LAYER_OPTIONS: { id: ContextLayer; label: string; swatch: string }[] = [
  { id: 'none', label: 'Practices only', swatch: 'linear-gradient(135deg,#F4F3EE,#E4E2DA)' },
  { id: 'population', label: 'Population density', swatch: 'linear-gradient(to right,#5fafb9,#1e699b,#4b0f96,#f0468c,#ffdc32)' },
  { id: 'income', label: SOCIOECONOMIC_METRICS.income.label, swatch: `linear-gradient(to right,${SOCIOECONOMIC_METRICS.income.colors.join(',')})` },
  { id: 'education', label: SOCIOECONOMIC_METRICS.education.label, swatch: `linear-gradient(to right,${SOCIOECONOMIC_METRICS.education.colors.join(',')})` },
]

function toFeatures(rows: MapOffice[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: rows.map(d => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
    properties: { id: d.id, status: d.status, rank: STATUS_RANK[d.status], name: d.name, address: d.address, city_zip: d.cityZip, approx: d.approx ? 1 : 0 },
  })) }
}

/** Dot radius by zoom. Grows when a context layer is on and when hovered. */
function dotRadius(boost: number, extra = 0): ExpressionSpecification {
  const hover = ['case', ['boolean', ['feature-state', 'hover'], false], 1.4, 1]
  const stops: [number, number][] = [[8, 2.1], [10, 2.8], [12, 4.2], [14, 6.2], [17, 9.5]]
  return ['interpolate', ['linear'], ['zoom'], ...stops.flatMap(([z, r]) => [z, ['+', ['*', r + boost, hover], extra]])] as unknown as ExpressionSpecification
}

function formatChecked(iso: string | null) {
  if (!iso) return 'Not yet checked by the office validator'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'Checked' : `Checked ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function isTouchOnly() {
  return typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches
}

// ────────────────────────────────────────────────────────────────────────────
// Inner map — every dot is rendered once; filters and styling run on the GPU
// so status toggles and live refreshes never rebuild the map.
// ────────────────────────────────────────────────────────────────────────────

function OfficeMap({
  offices, counts, centerLat, centerLon, fresh, onOpenPractice, syncedAt, refreshing, stale, newsCount, onDismissNews,
}: {
  offices: MapOffice[]
  counts: Record<MapState, number>
  centerLat: number
  centerLon: number
  fresh: string[]
  onOpenPractice: (locationId: string) => void
  syncedAt?: string
  refreshing?: boolean
  stale?: boolean
  newsCount: number
  onDismissNews: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const officesRef = useRef(offices)
  officesRef.current = offices
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null)
  const tractPopupRef = useRef<mapboxgl.Popup | null>(null)
  const hoveredRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [active, setActive] = useState<MapState[]>([...MAP_STATES])
  const [selection, setSelection] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [layerPanel, setLayerPanel] = useState(false)
  const [contextLayer, setContextLayer] = useState<ContextLayer>('none')
  const [strength, setStrength] = useState(0.5)
  const [showDots, setShowDots] = useState(true)
  const [populationStatus, setPopulationStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [acsStatus, setAcsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [listOpen, setListOpen] = useState(false)

  const populationOn = contextLayer === 'population'
  const metric: SocioeconomicMetric | null = contextLayer === 'income' || contextLayer === 'education' ? contextLayer : null
  const layerOn = contextLayer !== 'none'
  const presentation = useRef({ populationOn, metric, strength })
  presentation.current = { populationOn, metric, strength }

  const byId = useMemo(() => new Map(offices.map(o => [o.id, o])), [offices])
  const activeSet = useMemo(() => new Set(active), [active])
  const selectedOffices = selection.map(id => byId.get(id)).filter((o): o is MapOffice => !!o && activeSet.has(o.status))
  const visibleOffices = useMemo(() => visibleIds.map(id => byId.get(id)).filter((o): o is MapOffice => !!o && activeSet.has(o.status))
    .sort((a, b) => a.name.localeCompare(b.name)), [visibleIds, byId, activeSet])
  const visibleCounts = useMemo(() => {
    const c = { confirmed: 0, unresolved: 0, unchecked: 0 }
    for (const id of visibleIds) { const o = byId.get(id); if (o) c[o.status]++ }
    return c
  }, [visibleIds, byId])
  const shownTotal = active.reduce((n, s) => n + counts[s], 0)

  const updateViewport = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    if (!bounds) return
    setVisibleIds(officesRef.current.filter(o => bounds.contains([o.lon, o.lat])).map(o => o.id))
  }, [])

  const fitTo = useCallback((rows: MapOffice[], animate = true) => {
    const map = mapRef.current
    if (!map || !rows.length) return
    if (rows.length === 1) { map.easeTo({ center: [rows[0].lon, rows[0].lat], zoom: Math.max(map.getZoom(), 14), duration: animate ? 600 : 0 }); return }
    const lons = rows.map(o => o.lon), lats = rows.map(o => o.lat)
    const pad = Math.min(60, Math.round(Math.min(map.getContainer().clientWidth, map.getContainer().clientHeight) / 8))
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: { top: pad + 56, bottom: pad + 36, left: pad, right: pad }, maxZoom: 14, duration: animate ? 700 : 0 })
  }, [])

  // ── Create the map once per area ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let map: mapboxgl.Map | null = null
    let cancelled = false
    let populationFailed = false
    let acsFailed = false
    setReady(false); setMapError(false); setPopulationStatus('loading'); setAcsStatus('loading')

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      await import('mapbox-gl/dist/mapbox-gl.css')
      if (cancelled || !containerRef.current) return
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [centerLon, centerLat],
        zoom: 9,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      })
      mapRef.current = map
      map.touchZoomRotate.disableRotation()
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('error', e => {
        const sourceId = (e as unknown as { sourceId?: string }).sourceId
        const message = e.error?.message ?? ''
        if (sourceId === POPULATION_SOURCE_ID || message.includes('/api/population-tiles/')) {
          populationFailed = true
          if (!cancelled) setPopulationStatus('error')
        }
        if (sourceId === SOCIOECONOMIC_SOURCE || message.includes(SOCIOECONOMIC_DATA)) {
          acsFailed = true
          if (!cancelled) setAcsStatus('error')
        }
        if (!sourceId && /token|unauthorized|forbidden|style/i.test(message)) setMapError(true)
      })
      map.on('sourcedata', e => {
        if (e.sourceId === POPULATION_SOURCE_ID && e.isSourceLoaded && !populationFailed && !cancelled) setPopulationStatus('ready')
        if (e.sourceId === SOCIOECONOMIC_SOURCE && e.isSourceLoaded && !acsFailed && !cancelled) setAcsStatus('ready')
      })

      map.on('load', () => {
        if (!map) return
        const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id
        const p = presentation.current

        // Context layers sit under basemap labels and far under the dots.
        map.addSource(POPULATION_SOURCE_ID, {
          type: 'raster', tiles: [`${window.location.origin}/api/population-tiles/{z}/{x}/{y}`],
          tileSize: 256, bounds: POPULATION_BOUNDS, minzoom: POPULATION_MIN_ZOOM, maxzoom: POPULATION_MAX_ZOOM,
          attribution: '<a href="https://www.worldpop.org/">WorldPop 2026</a> · <a href="https://citydensity.com/city/chicago-united-states">CityDensity tiles</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
        })
        map.addLayer({ id: POPULATION_LAYER_ID, type: 'raster', source: POPULATION_SOURCE_ID,
          layout: { visibility: p.populationOn ? 'visible' : 'none' },
          paint: { 'raster-opacity': p.strength, 'raster-resampling': 'linear' } }, firstLabel)
        map.addSource(SOCIOECONOMIC_SOURCE, { type: 'geojson', data: SOCIOECONOMIC_DATA,
          attribution: '<a href="https://www.census.gov/programs-surveys/acs">U.S. Census ACS 2020–2024</a> · <a href="https://www.arcgis.com/home/item.html?id=c9faa265b82848498bc0a8390c0afa65">Esri</a>' })
        map.addLayer({ id: SOCIOECONOMIC_LAYER, type: 'fill', source: SOCIOECONOMIC_SOURCE,
          layout: { visibility: p.metric ? 'visible' : 'none' },
          paint: { 'fill-color': socioeconomicColor(p.metric ?? 'income'), 'fill-opacity': p.strength, 'fill-outline-color': 'rgba(80,80,80,0.2)' } }, firstLabel)

        // Offices: dark casing → white ring → status fill. The casing is what
        // keeps each color readable on top of any context layer.
        map.addSource(SOURCE, { type: 'geojson', data: toFeatures(officesRef.current), promoteId: 'id' })
        map.addLayer({ id: L.pulse, type: 'circle', source: SOURCE, filter: ['in', ['get', 'id'], ['literal', []]],
          paint: { 'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': STATUS_COLOR, 'circle-stroke-width': 3, 'circle-stroke-opacity': 0.8 } })
        map.addLayer({ id: L.casing, type: 'circle', source: SOURCE, layout: { 'circle-sort-key': ['get', 'rank'] },
          paint: { 'circle-radius': dotRadius(0, 2.5), 'circle-color': '#0E1A15', 'circle-opacity': 0.45, 'circle-blur': 0.15 } })
        map.addLayer({ id: L.dots, type: 'circle', source: SOURCE, layout: { 'circle-sort-key': ['get', 'rank'] },
          paint: { 'circle-radius': dotRadius(0), 'circle-color': STATUS_COLOR, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 } })
        map.addLayer({ id: L.selected, type: 'circle', source: SOURCE, filter: ['in', ['get', 'id'], ['literal', []]],
          paint: { 'circle-radius': dotRadius(0, 6), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#111814', 'circle-stroke-width': 2.5 } })
        // A generous invisible target makes isolated dots easy to tap.
        map.addLayer({ id: L.hit, type: 'circle', source: SOURCE, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 18], 'circle-opacity': 0 } })

        const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '260px', className: 'office-map-popup' })
        hoverPopupRef.current = hoverPopup
        const tractPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '280px', className: 'office-map-popup' })
        tractPopupRef.current = tractPopup

        const setHover = (id: string | null) => {
          if (!map || hoveredRef.current === id) return
          if (hoveredRef.current) map.setFeatureState({ source: SOURCE, id: hoveredRef.current }, { hover: false })
          hoveredRef.current = id
          if (id) map.setFeatureState({ source: SOURCE, id }, { hover: true })
        }
        map.on('mousemove', L.hit, e => {
          if (!map || isTouchOnly() || !e.features?.[0]) return
          tractPopup.remove()
          map.getCanvas().style.cursor = 'pointer'
          const f = e.features[0], props = f.properties ?? {}
          setHover(String(props.id))
          const meta = MAP_META[props.status as MapState] ?? MAP_META.unchecked
          hoverPopup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setHTML(
            `<div class="omp"><span class="omp-status" style="color:${meta.color}"><i style="background:${meta.color}"></i>${escapeHtml(meta.label)}</span>
            <strong>${escapeHtml(props.name)}</strong><span class="omp-sub">${escapeHtml(props.address)} · ${escapeHtml(props.city_zip)}</span></div>`).addTo(map)
        })
        map.on('mouseleave', L.hit, () => {
          if (!map) return
          map.getCanvas().style.cursor = ''
          setHover(null)
          hoverPopup.remove()
        })
        map.on('mousemove', SOCIOECONOMIC_LAYER, e => {
          const m = presentation.current.metric
          if (!map || !m || isTouchOnly() || !e.features?.[0] || map.queryRenderedFeatures(e.point, { layers: [L.hit] }).length) { tractPopup.remove(); return }
          const props = e.features[0].properties ?? {}
          const config = SOCIOECONOMIC_METRICS[m]
          const value = socioeconomicValue(props, m)
          const moe = value === null ? null : acsNumber(props[config.moe])
          const margin = moe === null ? 'Margin of error unavailable' : m === 'income'
            ? `±$${Math.round(moe).toLocaleString('en-US')} (90% MOE)` : `±${moe.toFixed(1)} pts (90% MOE)`
          tractPopup.setLngLat(e.lngLat).setHTML(`<div class="omp"><span class="omp-sub">${escapeHtml(props.NAME)} · ${escapeHtml(props.County)}</span>
            <strong>${escapeHtml(formatSocioeconomicValue(value, m))}</strong><span class="omp-sub">${escapeHtml(config.label)} · ${escapeHtml(margin)}</span></div>`).addTo(map)
        })
        map.on('mouseleave', SOCIOECONOMIC_LAYER, () => tractPopup.remove())
        map.on('movestart', () => tractPopup.remove())

        // Tap/click selects every overlapping office rather than silently opening one.
        map.on('click', e => {
          if (!map) return
          hoverPopup.remove(); tractPopup.remove()
          const hits = map.getLayoutProperty(L.hit, 'visibility') === 'none' ? [] : map.queryRenderedFeatures(e.point, { layers: [L.hit] })
          const ids = [...new Set(hits
            .map(f => { const [x, y] = (f.geometry as GeoJSON.Point).coordinates; const q = map!.project([x, y]); return { id: f.properties?.id, d: (q.x - e.point.x) ** 2 + (q.y - e.point.y) ** 2 } })
            .sort((a, b) => a.d - b.d).map(h => h.id).filter((id): id is string => typeof id === 'string' && !!id))]
          // A tap on a crowded cluster zooms in instead of listing dozens of offices.
          if (ids.length > 6 && map.getZoom() < 14) { setSelection([]); map.easeTo({ center: e.lngLat, zoom: Math.min(map.getZoom() + 2.5, 15), duration: 500 }); return }
          if (ids.length) setListOpen(false)
          setSelection(ids)
        })

        map.on('moveend', updateViewport)
        setReady(true)
        fitTo(officesRef.current, false)
        updateViewport()
      })
    }

    init().catch(() => { if (!cancelled) setMapError(true) })
    return () => {
      cancelled = true
      hoverPopupRef.current?.remove(); tractPopupRef.current?.remove()
      map?.remove()
      mapRef.current = null
      hoveredRef.current = null
    }
  }, [centerLat, centerLon, fitTo, updateViewport])

  // Keep the canvas sized to its box through expand/collapse and rotation.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { mapRef.current?.resize(); updateViewport() })
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateViewport])

  // ── Live data: swap the source in place ─────────────────────────────────
  useEffect(() => {
    const source = mapRef.current?.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined
    if (!source) return
    source.setData(toFeatures(offices))
    hoveredRef.current = null
    updateViewport()
  }, [offices, ready, updateViewport])

  // ── Status filter, selection and dot styling ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const statusFilter: ExpressionSpecification = ['in', ['get', 'status'], ['literal', active]]
    for (const id of [L.casing, L.dots, L.hit]) map.setFilter(id, statusFilter)
    map.setFilter(L.selected, ['all', statusFilter, ['in', ['get', 'id'], ['literal', selection]]])
    map.setFilter(L.pulse, ['all', statusFilter, ['in', ['get', 'id'], ['literal', fresh]]])
    for (const id of Object.values(L)) map.setLayoutProperty(id, 'visibility', showDots ? 'visible' : 'none')
    // Small, crisp dots. Over a context layer the hairline outline turns dark so
    // each color separates from the fill underneath without bloating the dot.
    const boost = layerOn ? 0.5 : 0
    map.setPaintProperty(L.dots, 'circle-radius', dotRadius(boost))
    map.setPaintProperty(L.dots, 'circle-stroke-width', ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1, 15, 1.5])
    map.setPaintProperty(L.dots, 'circle-stroke-color', layerOn ? '#15201A' : '#FFFFFF')
    map.setPaintProperty(L.casing, 'circle-opacity', 0)
    map.setPaintProperty(L.selected, 'circle-radius', dotRadius(boost, 5))
  }, [active, selection, fresh, showDots, layerOn, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setLayoutProperty(POPULATION_LAYER_ID, 'visibility', populationOn ? 'visible' : 'none')
    map.setPaintProperty(POPULATION_LAYER_ID, 'raster-opacity', strength)
    map.setLayoutProperty(SOCIOECONOMIC_LAYER, 'visibility', metric ? 'visible' : 'none')
    map.setPaintProperty(SOCIOECONOMIC_LAYER, 'fill-opacity', strength)
    if (metric) map.setPaintProperty(SOCIOECONOMIC_LAYER, 'fill-color', socioeconomicColor(metric))
    tractPopupRef.current?.remove()
  }, [populationOn, metric, strength, ready])

  // ── Pulse offices whose status just changed in the live feed ────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !fresh.length || !showDots) return
    let frame = 0
    const tick = (t: number) => {
      const phase = (t % 1800) / 1800
      if (map.getLayer(L.pulse)) {
        map.setPaintProperty(L.pulse, 'circle-radius', ['interpolate', ['linear'], ['zoom'], 8, 6 + phase * 16, 14, 10 + phase * 22])
        map.setPaintProperty(L.pulse, 'circle-stroke-opacity', 0.85 * (1 - phase))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [fresh, ready, showDots])

  // Drop a selection whose office disappeared from the live feed.
  useEffect(() => {
    setSelection(ids => { const next = ids.filter(id => byId.has(id)); return next.length === ids.length ? ids : next })
  }, [byId])

  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape) }
  }, [expanded])

  const toggleState = (s: MapState) => setActive(current => {
    if (current.includes(s)) return current.length === 1 ? [...MAP_STATES] : current.filter(x => x !== s)
    return MAP_STATES.filter(x => x === s || current.includes(x))
  })
  const soloState = (s: MapState) => setActive(current => current.length === 1 && current[0] === s ? [...MAP_STATES] : [s])
  const focusOffice = (o: MapOffice) => {
    setSelection([o.id])
    mapRef.current?.easeTo({ center: [o.lon, o.lat], zoom: Math.max(mapRef.current.getZoom(), 13.5), duration: 500 })
  }
  const freshOffices = fresh.map(id => byId.get(id)).filter((o): o is MapOffice => !!o)
  const legend = populationOn
    ? { title: 'People / sq mi', gradient: POPULATION_GRADIENT, labels: POPULATION_LEGEND.filter((_, i) => i % 2 === 0).map((s, i, a) => s.perSquareMile === 0 ? '0' : `${(s.perSquareMile / 1000).toFixed(0)}k${i === a.length - 1 ? '+' : ''}`) }
    : metric ? { title: metric === 'income' ? 'Median household income' : 'Adults with a bachelor’s+', gradient: `linear-gradient(to right, ${SOCIOECONOMIC_METRICS[metric].colors.join(',')})`, labels: [SOCIOECONOMIC_METRICS[metric].labels[0], SOCIOECONOMIC_METRICS[metric].labels[2], SOCIOECONOMIC_METRICS[metric].labels[4]] }
    : null
  const layerLoading = (populationOn && populationStatus === 'loading') || (metric && acsStatus === 'loading')
  const layerFailed = (populationOn && populationStatus === 'error') || (metric && acsStatus === 'error')
  const synced = syncedAt ? new Date(syncedAt) : null

  const overlayCard = 'rounded-2xl border border-black/5 bg-white/95 shadow-[0_6px_24px_-8px_rgba(20,30,25,0.35)] backdrop-blur-md'
  const iconButton = 'flex h-11 w-11 items-center justify-center text-[#253C34] transition-colors hover:bg-[#F1F4EF] disabled:opacity-40'

  return (
    <div className={expanded ? 'fixed inset-0 z-[70] flex flex-col bg-[#F6F7F3]' : 'space-y-3'}>
      <style>{`.office-map-popup .mapboxgl-popup-content{padding:10px 12px;border-radius:12px;box-shadow:0 8px 28px -10px rgba(20,30,25,.45);border:1px solid rgba(0,0,0,.06)}
        .office-map-popup .mapboxgl-popup-tip{display:none}
        .omp{font:12px/1.45 Inter,system-ui,sans-serif;color:#1A1F1C;display:flex;flex-direction:column;gap:2px}
        .omp strong{font-size:13px;font-weight:600}.omp-sub{color:#6B706A}
        .omp-status{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
        .omp-status i{width:8px;height:8px;border-radius:9999px;box-shadow:0 0 0 1.5px #fff,0 0 0 2.5px rgba(14,26,21,.45)}
        @keyframes omp-live{0%{box-shadow:0 0 0 0 rgba(18,161,80,.55)}70%{box-shadow:0 0 0 7px rgba(18,161,80,0)}100%{box-shadow:0 0 0 0 rgba(18,161,80,0)}}`}</style>

      <div className={`relative isolate overflow-hidden bg-[#E9ECE6] ${expanded ? 'flex-1' : 'h-[calc(100svh-128px)] min-h-[420px] rounded-2xl border border-[#DCE1D9] shadow-sm sm:h-[calc(100svh-96px)] sm:min-h-[520px]'}`}>
        {/* Mapbox forces position:relative on its container, so it fills a positioned wrapper. */}
        <div className="absolute inset-0"><div ref={containerRef} className="h-full w-full" style={{ width: '100%', height: '100%' }} aria-label="Interactive practice map" /></div>

        {!ready && !mapError && <div role="status" className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#EEF1EB] text-sm text-[#52625A]">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9D3C7] border-t-[#253C34]" />Loading map…</div>}
        {mapError && <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center bg-[#EEF1EB] p-8 text-center text-sm text-[#7A4B12]">
          Interactive map unavailable in this browser. Try a browser with WebGL enabled, or use the List view.</div>}

        {/* Status filter — multi-select, the only three groups on the map */}
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col items-end gap-2 sm:inset-x-3 sm:top-3 sm:flex-row sm:items-start">
          <div role="group" aria-label="Map status filters" className={`${overlayCard} pointer-events-auto grid w-full min-w-0 grid-cols-3 gap-0.5 rounded-xl p-0.5 sm:flex sm:w-auto sm:flex-none`}>
            {MAP_STATES.map(s => {
              const on = activeSet.has(s)
              return <button key={s} type="button" onClick={() => toggleState(s)} onDoubleClick={() => soloState(s)} aria-pressed={on} title={`${MAP_META[s].description} Double-click to show only this group.`}
                className={`flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-left transition-all sm:min-h-8 sm:shrink-0 ${on ? 'bg-white shadow-sm ring-1 ring-black/5' : 'opacity-50 hover:opacity-80'}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: on ? MAP_META[s].color : 'transparent', boxShadow: `inset 0 0 0 1.5px ${MAP_META[s].color}` }} />
                <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="whitespace-nowrap text-[11px] font-semibold text-[#1F2A24]">{MAP_META[s].short}</span>
                  <span className="text-[10.5px] tabular-nums text-[#6B706A] sm:text-[11px]">{counts[s].toLocaleString()}</span>
                </span>
              </button>
            })}
          </div>
          <div className={`${overlayCard} pointer-events-auto flex shrink-0 flex-col overflow-hidden sm:ml-auto`}>
            <button type="button" aria-label="Practices in view" aria-expanded={listOpen} onClick={() => { setListOpen(v => !v); setLayerPanel(false); setSelection([]) }} className={`${iconButton} ${listOpen ? 'bg-[#253C34] text-white hover:bg-[#1D302A]' : ''}`}><List className="h-[18px] w-[18px]" /></button>
            <button type="button" aria-label="Map layers" aria-expanded={layerPanel} onClick={() => { setLayerPanel(v => !v); setListOpen(false) }} className={`${iconButton} border-t border-black/5 ${layerOn || layerPanel ? 'bg-[#253C34] text-white hover:bg-[#1D302A]' : ''}`}><Layers className="h-[18px] w-[18px]" /></button>
            <button type="button" aria-label="Fit all dots" disabled={!ready || !offices.length} onClick={() => fitTo(offices.filter(o => activeSet.has(o.status)))} className={`${iconButton} border-t border-black/5`}><LocateFixed className="h-[18px] w-[18px]" /></button>
            <button type="button" aria-label={expanded ? 'Exit full screen map' : 'Full screen map'} aria-pressed={expanded} onClick={() => setExpanded(v => !v)} className={`${iconButton} border-t border-black/5`}>{expanded ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}</button>
          </div>
        </div>

        {/* Layers panel */}
        <section aria-label="Map layers" className={`${layerPanel ? '' : 'hidden'} ${overlayCard} absolute inset-x-0 bottom-0 z-40 max-h-[72%] overflow-y-auto overscroll-contain rounded-b-none bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:right-[68px] sm:top-3 sm:max-h-[calc(100%-60px)] sm:w-[330px] sm:rounded-2xl`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B706A]">Map layer</h3>
            <button type="button" aria-label="Close layers" onClick={() => setLayerPanel(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F1F4EF]"><X className="h-4 w-4" /></button></div>
          <div role="radiogroup" aria-label="Map layer" className="grid grid-cols-2 gap-2">
            {LAYER_OPTIONS.map(o => <button key={o.id} type="button" role="radio" aria-checked={contextLayer === o.id} onClick={() => setContextLayer(o.id)}
              className={`flex flex-col gap-1.5 rounded-xl border p-2 text-left text-[11.5px] font-medium leading-tight text-[#1F2A24] transition ${contextLayer === o.id ? 'border-[#253C34] ring-1 ring-[#253C34]' : 'border-[#E3E7E0] hover:border-[#C5CDC2]'}`}>
              <span className="h-9 w-full rounded-lg" style={{ background: o.swatch }} />{o.label}</button>)}
          </div>
          {legend && <div className="mt-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6B706A]">{legend.title}</p>
            <div className="h-2 rounded-full" style={{ background: legend.gradient }} />
            <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-[#6B706A]">{legend.labels.map(l => <span key={l}>{l}</span>)}</div>
            {layerLoading && <p className="mt-1 text-[10px] text-[#6B706A]">Loading layer…</p>}
            {layerFailed && <p role="alert" className="mt-1 text-[10px] text-[#B42318]">Layer unavailable — blank is not zero. Reload to retry.</p>}</div>}
          {layerOn && <label className="mt-3 flex items-center gap-3 text-xs text-[#52625A]">Layer strength
            <input aria-label="Layer strength" className="min-w-0 flex-1 accent-[#253C34]" type="range" min="15" max="85" step="5" value={Math.round(strength * 100)} onChange={e => setStrength(Number(e.target.value) / 100)} />
            <span className="w-8 text-right tabular-nums">{Math.round(strength * 100)}%</span></label>}
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#F4F6F2] px-3 text-xs font-medium text-[#253C34]">Show practice dots
            <input type="checkbox" className="h-5 w-5 accent-[#253C34]" checked={showDots} onChange={e => setShowDots(e.target.checked)} /></label>
          <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-[#6B706A]">
            {populationOn && <>
              <p>WorldPop 2026 modeled population on a 100-metre grid, rendered by CityDensity. Regional context, not clipped to tracked ZIPs; light areas are not proof of zero residents.</p>
              <p><a className="underline" href="https://citydensity.com/city/chicago-united-states" target="_blank" rel="noopener noreferrer">CityDensity</a> · <a className="underline" href="https://www.worldpop.org/faq/" target="_blank" rel="noopener noreferrer">WorldPop · CC BY 4.0</a></p>
            </>}
            {metric && <>
              <p>{SOCIOECONOMIC_METRICS[metric].unit}. Illinois census-tract estimates (ACS 2020–2024), not live 2026 conditions; gray = no estimate. Neighborhood context only — not insurance coverage, patient demand or profitability.</p>
              <p><a className="underline" href={SOCIOECONOMIC_METRICS[metric].source} target="_blank" rel="noopener noreferrer">Census ACS via Esri</a> · <a className="underline" href="/data/chicagoland-acs-2024.metadata.json" target="_blank" rel="noopener noreferrer">Snapshot provenance</a></p>
            </>}
            <p>This is not a saturation score: unmapped offices, missing practices, commuters and cross-ZIP travel can change the picture.</p>
          </div>
        </section>

        {/* Selected offices — bottom sheet on phones, card on desktop */}
        {showDots && !!selectedOffices.length && <section aria-label="Selected map practices" className={`${overlayCard} absolute inset-x-0 bottom-0 z-40 max-h-[58%] overflow-y-auto overscroll-contain rounded-b-none bg-white pb-[max(12px,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-3 sm:left-3 sm:max-h-[60%] sm:w-[360px] sm:rounded-2xl sm:pb-2`}>
          <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-[#D5DAD2] sm:hidden" aria-hidden />
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 pt-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B706A]">{selectedOffices.length > 1 ? `${selectedOffices.length} offices here` : 'Practice'}</h3>
            <button type="button" aria-label="Close practice preview" onClick={() => setSelection([])} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#F1F4EF]"><X className="h-4 w-4" /></button>
          </div>
          {selectedOffices.length > 1 ? <div className="divide-y divide-[#EDF0EA] px-2 pb-1">
            {selectedOffices.map(o => <button type="button" key={o.id} onClick={() => setSelection([o.id])} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#F6F8F4]">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: MAP_META[o.status].color, boxShadow: '0 0 0 1.5px #fff, 0 0 0 3px rgba(14,26,21,.3)' }} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-semibold text-[#1F2A24]">{o.name}</strong><span className="block truncate text-[11px] text-[#6B706A]">{o.address} · {MAP_META[o.status].short}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#9AA098]" />
            </button>)}
          </div> : selectedOffices.map(o => <article key={o.id} className="mx-4 space-y-1.5 pb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: MAP_META[o.status].color, background: `${MAP_META[o.status].color}1A` }}>
              <span className="h-2 w-2 rounded-full" style={{ background: MAP_META[o.status].color }} />{MAP_META[o.status].label}</span>
            <h4 className="text-[15px] font-semibold leading-snug text-[#1F2A24]">{o.name}</h4>
            <p className="text-xs text-[#5F665F]">{o.address} · {o.cityZip}</p>
            <p className="text-[11px] text-[#7A8079]">{formatChecked(o.checkedAt)}{o.approx && ' · Dot placed from the street address (U.S. Census geocode)'}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => onOpenPractice(o.id)} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#253C34] px-4 text-sm font-medium text-white hover:bg-[#1D302A]">Open practice <ArrowUpRight className="h-4 w-4" /></button>
              {o.phone && <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-[#DCE1D9] px-4 text-sm font-medium text-[#253C34]"><Phone className="h-4 w-4" />Call</a>}
            </div>
          </article>)}
        </section>}

        {/* Practices in view — side panel on desktop, bottom sheet on phones */}
        {listOpen && <section aria-label="Practices in this map area" className={`${overlayCard} absolute inset-x-0 bottom-0 z-40 flex max-h-[62%] flex-col rounded-b-none bg-white pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-9 sm:right-[68px] sm:top-3 sm:max-h-none sm:w-[340px] sm:rounded-2xl`}>
          <span className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full bg-[#D5DAD2] sm:hidden" aria-hidden />
          <div className="flex shrink-0 items-center justify-between px-4 pt-1 sm:pt-2">
            <div><h3 className="text-[13px] font-semibold text-[#1F2A24]">{visibleOffices.length.toLocaleString()} practices in view</h3>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-[#6B706A]">{MAP_STATES.filter(s => activeSet.has(s)).map(s => <span key={s} className="flex items-center gap-1 whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full" style={{ background: MAP_META[s].color }} />{visibleCounts[s].toLocaleString()} {MAP_META[s].short.toLowerCase()}</span>)}</p></div>
            <button type="button" aria-label="Close practice list" onClick={() => setListOpen(false)} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#F1F4EF]"><X className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-[#EDF0EA] overflow-y-auto overscroll-contain px-2 pb-2">
            {visibleOffices.slice(0, 300).map(o => <button type="button" key={o.id} onClick={() => { focusOffice(o); if (window.innerWidth < 640) setListOpen(false) }} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#F6F8F4] ${selection.includes(o.id) ? 'bg-[#EEF3EC]' : ''}`}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: MAP_META[o.status].color, boxShadow: '0 0 0 1.5px #fff, 0 0 0 3px rgba(14,26,21,.3)' }} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-semibold text-[#1F2A24]">{o.name}</strong><span className="block truncate text-[11px] text-[#6B706A]">{o.address} · {o.cityZip}</span></span>
            </button>)}
            {visibleOffices.length > 300 && <p className="py-3 text-center text-[11px] text-[#6B706A]">Showing 300 of {visibleOffices.length.toLocaleString()} — zoom in or search to narrow.</p>}
            {!visibleOffices.length && <p className="py-8 text-center text-xs text-[#6B706A]">No practices in this part of the map.</p>}
          </div>
        </section>}

        {/* Live status + in-view count */}
        {ready && !selectedOffices.length && !listOpen && <div className={`${overlayCard} pointer-events-none absolute bottom-9 left-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-[#1F2A24] sm:left-3`} title={synced ? `Synced ${synced.toLocaleTimeString()}` : undefined}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stale ? 'bg-amber-500' : 'bg-[#12A150]'}`} style={stale ? undefined : { animation: 'omp-live 2s infinite' }} />
          {showDots ? <span><strong className="tabular-nums">{visibleOffices.length.toLocaleString()}</strong> in view</span> : <span>Dots off</span>}
          <span className="text-[#6B706A]">· {stale ? 'reconnecting' : refreshing ? 'updating' : 'live'}</span>
        </div>}

        {/* Live change toast */}
        {newsCount > 0 && <div role="status" className="pointer-events-none absolute inset-x-0 top-[50px] z-30 flex justify-start px-2 sm:top-[76px] sm:justify-center sm:px-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#1F2A24] py-1.5 pl-3.5 pr-1.5 text-xs text-white shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[#12A150]" style={{ animation: 'omp-live 2s infinite' }} />
            {newsCount.toLocaleString()} {newsCount === 1 ? 'office' : 'offices'} just updated
            {freshOffices.length > 0 && <button type="button" onClick={() => fitTo(freshOffices)} className="rounded-full bg-white/15 px-3 py-1.5 font-medium hover:bg-white/25">Show</button>}
            <button type="button" aria-label="Dismiss update notice" onClick={onDismissNews} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>}

        {ready && !offices.length && <p className="pointer-events-none absolute inset-x-8 top-1/3 z-20 rounded-2xl bg-white/95 p-4 text-center text-sm text-[#52625A] shadow">No mappable practices in this selection. Clear your search or choose another area.</p>}
        {ready && offices.length > 0 && !shownTotal && <p className="pointer-events-none absolute inset-x-8 top-1/3 z-20 rounded-2xl bg-white/95 p-4 text-center text-sm text-[#52625A] shadow">No practices in the selected check groups.</p>}
      </div>

    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Office check status and coordinates are independent gates. Every listed,
// non-removed office with usable coordinates gets exactly one dot.
// ────────────────────────────────────────────────────────────────────────────

export function PracticeDensityMap({ practices, centerLat, centerLon, syncedAt, refreshing, stale, removedCount = 0, onShowRemoved }: PracticeDensityMapProps) {
  const router = useRouter()
  const roster = useMemo(() => mapRoster(practices), [practices])
  const built = useMemo<MapOffice[]>(() => roster.mapped.flatMap(p => {
    const c = getOfficeCoordinates(p)
    if (!c || !p.location_id) return []
    return [{ id: p.location_id, lat: c.lat, lon: c.lon, name: displayName(p), address: p.address ?? 'Address not on file',
      cityZip: [p.city, p.zip].filter(Boolean).join(' '), phone: p.phone ?? null, status: mapState(p),
      checkedAt: p.web_check?.checked_at ?? null, approx: p.coord_source === 'census_geocoder' }]
  }), [roster])
  // Keep the same array while the content is identical, so a re-render or an
  // unchanged live refresh never re-uploads the dots to the map.
  const key = useMemo(() => built.map(o => `${o.id}|${o.status}|${o.lat}|${o.lon}|${o.name}|${o.address}|${o.phone}|${o.checkedAt}`).join('\n'), [built])
  const [stable, setStable] = useState({ key, rows: built })
  if (stable.key !== key) setStable({ key, rows: built })
  const offices = stable.key === key ? stable.rows : built

  // Detect offices whose check status changed between live refreshes.
  const previous = useRef<Map<string, MapState>>(new Map())
  const [fresh, setFresh] = useState<Record<string, number>>({})
  const [newsCount, setNewsCount] = useState(0)
  useEffect(() => {
    const next = new Map(offices.map(o => [o.id, o.status]))
    const changed = changedStatuses(previous.current, next)
    previous.current = next
    if (!changed.length) return
    const now = Date.now()
    setFresh(f => ({ ...f, ...Object.fromEntries(changed.map(id => [id, now])) }))
    setNewsCount(n => n + changed.length)
  }, [offices])
  useEffect(() => {
    const times = Object.values(fresh)
    if (!times.length) return
    const t = setTimeout(() => {
      const cutoff = Date.now() - FRESH_MS
      setFresh(f => Object.fromEntries(Object.entries(f).filter(([, at]) => at > cutoff)))
    }, Math.max(1000, Math.min(...times) + FRESH_MS - Date.now()))
    return () => clearTimeout(t)
  }, [fresh])
  const freshIds = useMemo(() => Object.keys(fresh), [fresh])
  useEffect(() => { if (!freshIds.length) setNewsCount(0) }, [freshIds.length])

  return <section aria-label="Live directory map" data-mapped-count={offices.length} className="space-y-2">
    <OfficeMap offices={offices} counts={roster.counts} centerLat={centerLat} centerLon={centerLon} fresh={freshIds}
      syncedAt={syncedAt} refreshing={refreshing} stale={stale} newsCount={newsCount} onDismissNews={() => setNewsCount(0)}
      onOpenPractice={id => router.push(`/practice/${encodeURIComponent(id)}`)} />
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1 px-1 text-xs text-[#747970]">
      <p role="status"><strong className="font-medium text-[#253C34]">{offices.length.toLocaleString()} mapped of {roster.listed.length.toLocaleString()} listed</strong> · dot colors follow the latest office check and update live</p>
      {removedCount > 0 && <button type="button" onClick={onShowRemoved} className="underline-offset-2 hover:text-[#253C34] hover:underline">{removedCount.toLocaleString()} removed by the validator (never mapped)</button>}
      <details className="group basis-full sm:ml-auto sm:basis-auto"><summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-[#253C34]"><CircleHelp className="h-3.5 w-3.5" />Why some practices have no dot</summary><div className="mt-2 max-w-2xl space-y-1.5 rounded-xl border border-[#E6E8E2] bg-white p-3 leading-5">
        <p>{roster.missing.toLocaleString()} have no usable stored coordinates. {roster.moved.toLocaleString()} have a corrected street address awaiting matching coordinates.</p>
        <p>All other listed practices get exactly one dot, including records not yet checked. Removed records never appear. No ZIP-center placeholders are added.</p>
        <p>{roster.geocoded.toLocaleString()} dots are placed from the office’s street address with a U.S. Census geocode because the record had no stored coordinates or its street was corrected. A geocode is dropped automatically if the address changes again.</p>
        <p>Overlapping offices stay separate records: tap their dot to choose an office. Stored coordinates are not independently verified by an office check.</p>
      </div></details>
    </div>
  </section>
}
