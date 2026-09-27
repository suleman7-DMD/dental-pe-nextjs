import type mapboxgl from 'mapbox-gl'
import { escapeHtml } from '@/lib/utils/escape-html'
import { LAND_USE_DETAILS, LAND_USE_FILL, LAND_USE_SOURCE, LAND_USE_VERSION, landUseColor, landUseFilter, landUseGroup, type LandUseMode } from './land-use'

export type LandUseStatus = 'idle' | 'loading' | 'ready' | 'error' | 'zoomed-out'
type Presentation = { mode: LandUseMode | null; opacity: number }

/** Lazy source: no archive or boundary traffic until the user selects land use. */
export function attachLandUse(map: mapboxgl.Map, gl: typeof mapboxgl, status: (value: LandUseStatus) => void) {
  let current: Presentation = { mode: null, opacity: 0.65 }
  let failed = false
  const popup = new gl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '310px' })
  const boundary = 'cmap-scope'
  const boundaryLine = 'cmap-scope-line'
  const outline = 'cmap-land-use-outline'
  const firstLabel = map.getStyle().layers.find(l => l.type === 'symbol')?.id

  function ensureSource() {
    if (map.getSource(LAND_USE_SOURCE)) return
    failed = false
    status('loading')
    map.addSource(LAND_USE_SOURCE, { type: 'vector', tiles: [`${window.location.origin}/api/land-use-tiles/${LAND_USE_VERSION}/{z}/{x}/{y}`],
      minzoom: 7, maxzoom: 14,
      attribution: '<a href="https://cmap.illinois.gov/data/land-use/land-use-inventory/">CMAP 2023 land use</a> · <a href="https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html">Census ZCTA boundaries</a>',
    })
    map.addLayer({ id: LAND_USE_FILL, type: 'fill', source: LAND_USE_SOURCE, 'source-layer': 'landuse',
      paint: { 'fill-color': landUseColor, 'fill-opacity': current.opacity }, filter: landUseFilter(current.mode ?? 'full'),
    }, firstLabel)
    map.addLayer({ id: outline, type: 'line', source: LAND_USE_SOURCE, 'source-layer': 'landuse', minzoom: 13,
      paint: { 'line-color': '#626475', 'line-width': 0.4, 'line-opacity': 0.25 }, filter: landUseFilter(current.mode ?? 'full'),
    }, firstLabel)
    map.addSource(boundary, { type: 'geojson', data: '/data/land-use/scope.geojson' })
    map.addLayer({ id: boundaryLine, type: 'line', source: boundary,
      paint: { 'line-color': '#756287', 'line-width': 1.3, 'line-dasharray': [3, 3], 'line-opacity': 0.7 },
    }, firstLabel)
  }

  function inspect(e: mapboxgl.MapLayerMouseEvent) {
    if (!current.mode || current.opacity === 0 || !e.features?.[0] ||
      (map.getLayer('practice-dots') && map.queryRenderedFeatures(e.point, { layers: ['practice-dots'] }).length)) {
      popup.remove()
      return
    }
    const props = e.features[0].properties ?? {}
    const group = landUseGroup(props.code)
    const title = props.name || LAND_USE_DETAILS[props.code] || 'Unclassified land'
    const secondary = props.secondary ? `<br/>Secondary source code: ${escapeHtml(props.secondary)}` : ''
    const modifier = props.modifier ? `<br/>${escapeHtml(({ M: 'Multiple uses recorded', S: 'Stalled construction recorded', T: 'Transitional use recorded' } as Record<string, string>)[props.modifier] ?? 'Source modifier recorded')}` : ''
    popup.setLngLat(e.lngLat).setHTML(`<div style="font:12px/1.55 system-ui;color:#393745;padding:3px">
      <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6b6474">CMAP · 2023 land use</div>
      <strong style="font-size:14px">${escapeHtml(title)}</strong><br/>
      <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${group.color};margin-right:5px"></span>${escapeHtml(LAND_USE_DETAILS[props.code] ?? group.label)}
      <p style="margin:7px 0">${escapeHtml(group.note)}</p>
      <span style="color:#766f7c">Observed use, not zoning permission. Conditions may have changed.${secondary}${modifier}</span></div>`).addTo(map)
  }
  const clear = () => popup.remove()
  const error = (e: mapboxgl.ErrorEvent) => {
    const sourceId = (e as unknown as { sourceId?: string }).sourceId
    if ([LAND_USE_SOURCE, boundary].includes(sourceId ?? '') || /land-use-tiles|land-use\/scope/.test(e.error?.message ?? '')) {
      failed = true
      status('error')
    }
  }
  const loaded = (e: mapboxgl.MapSourceDataEvent) => {
    if (e.sourceId === LAND_USE_SOURCE && e.isSourceLoaded && !failed) status(map.getZoom() < 7 ? 'zoomed-out' : 'ready')
  }
  const zoom = () => {
    if (current.mode && !failed && map.getSource(LAND_USE_SOURCE)) status(map.getZoom() < 7 ? 'zoomed-out' : map.isSourceLoaded(LAND_USE_SOURCE) ? 'ready' : 'loading')
  }
  map.on('error', error)
  map.on('sourcedata', loaded)
  map.on('mousemove', LAND_USE_FILL, inspect)
  map.on('click', LAND_USE_FILL, inspect)
  map.on('mouseleave', LAND_USE_FILL, clear)
  map.on('movestart', clear)
  map.on('zoomend', zoom)
  map.on('mouseenter', 'practice-dots', clear)

  function set(value: Presentation) {
    current = value
    popup.remove()
    if (value.mode) ensureSource()
    for (const id of [LAND_USE_FILL, outline, boundaryLine]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value.mode ? 'visible' : 'none')
    }
    if (map.getLayer(LAND_USE_FILL)) {
      map.setPaintProperty(LAND_USE_FILL, 'fill-opacity', value.opacity)
      map.setPaintProperty(outline, 'line-opacity', value.opacity * 0.4)
      map.setFilter(LAND_USE_FILL, landUseFilter(value.mode ?? 'full'))
      map.setFilter(outline, landUseFilter(value.mode ?? 'full'))
    }
    zoom()
  }
  return { set, retry() {
    for (const id of [LAND_USE_FILL, outline, boundaryLine]) if (map.getLayer(id)) map.removeLayer(id)
    for (const id of [LAND_USE_SOURCE, boundary]) if (map.getSource(id)) map.removeSource(id)
    set(current)
  }, destroy() {
    popup.remove()
    map.off('error', error)
    map.off('sourcedata', loaded)
    map.off('mousemove', LAND_USE_FILL, inspect)
    map.off('click', LAND_USE_FILL, inspect)
    map.off('mouseleave', LAND_USE_FILL, clear)
    map.off('movestart', clear)
    map.off('zoomend', zoom)
    map.off('mouseenter', 'practice-dots', clear)
  } }
}
