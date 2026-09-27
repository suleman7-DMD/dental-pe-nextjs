'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type mapboxgl from 'mapbox-gl'
import { BookmarkPlus, Check, ChevronDown, Crosshair, Download, ExternalLink, Link2, Loader2, MapPin, Route, X } from 'lucide-react'
import type { LiveOffice } from '@/lib/directory/live-directory'
import { displayName } from '@/lib/census/display-name'
import { BUCKET_META, HEADLINE_BUCKETS } from '@/lib/census/ownership-truth'
import { MAP_META, mapState } from '@/lib/maps/directory-map'
import { areaBounds, competitionRange, containsPoint, summarizeDemand, summarizeSupply, validContours, validNode,
  type Area, type CatchmentGeometry, type CatchmentNode, type DemandDataset, type DemandSummary, type SupplySummary } from '@/lib/maps/catchment'
import nodeData from '@/data/catchment-nodes.json'

const STORE = 'directory-catchments-v1'
const COLORS = { 10: '#24677F', 15: '#AD8038' }
type Minutes = 10 | 15
type SavedStudy = { node: CatchmentNode; geometry: CatchmentGeometry; savedAt: string }
type Study = { demand: DemandSummary | null; supply: SupplySummary; covered: boolean }
const fmt = (n: number | null | undefined) => n == null ? '—' : Math.round(n).toLocaleString('en-US')
const approx = (n: number | null | undefined, step = 100) => n == null ? '—' : `≈${fmt(Math.round(n / step) * step)}`
const pct = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(1)}%`
const money = (d: DemandSummary | null) => d?.medianIncome ? `${approx(d.medianIncome.value, 1000).replace('≈', '≈$')}${d.medianIncome.topCoded ? '+' : ''}` : '—'
function areaFor(g: CatchmentGeometry | undefined, minutes: Minutes) { return g?.features.find(f => f.properties.contour === minutes)?.geometry }
function regionCovers(area: Area, region: Area) {
  const rings = area.type === 'Polygon' ? area.coordinates : area.coordinates.flat()
  // A routing polygon can brush a shoreline. Any exterior vertex outside our
  // Census coverage is disclosed; no false all-region population denominator.
  return rings.every(r => r.every(([x, y]) => containsPoint(region, x, y)))
}
function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CatchmentWorkbench({ map, rows, requestedNode, onPickingChange, onOpen, onHomes, syncedAt, stale, suspended, onCommute }: {
  map: mapboxgl.Map | null; rows: LiveOffice[]; requestedNode: CatchmentNode | null
  onPickingChange: (picking: boolean) => void; onOpen: () => void; onHomes: () => void
  syncedAt?: string; stale?: boolean
  suspended?: boolean; onCommute: (node: CatchmentNode) => void
}) {
  const [open, setOpen] = useState(false)
  const [node, setNode] = useState<CatchmentNode | null>(null)
  const [minutes, setMinutes] = useState<Minutes>(15)
  const [picking, setPicking] = useState(false)
  const [tab, setTab] = useState<'study' | 'compare'>('study')
  const [lens, setLens] = useState<'market' | 'acquisition'>('market')
  const [saved, setSaved] = useState<SavedStudy[]>([])
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const onOpenRef = useRef(onOpen); onOpenRef.current = onOpen
  const pickingCallback = useRef(onPickingChange); pickingCallback.current = onPickingChange

  useEffect(() => {
    const restore = () => {
      const p = new URLSearchParams(window.location.search), xy = p.get('catchment')?.split(',').map(Number)
      if (xy?.length === 2 && validNode({ lon: xy[0], lat: xy[1] })) {
        setNode({ lon: xy[0], lat: xy[1], name: p.get('node')?.slice(0, 100) || 'Dropped pin' }); setOpen(true)
        setMinutes(p.get('drive') === '10' ? 10 : 15)
      }
    }
    restore(); window.addEventListener('popstate', restore)
    try {
      const data: unknown = JSON.parse(localStorage.getItem(STORE) ?? '[]')
      if (Array.isArray(data)) setSaved(data.filter((s): s is SavedStudy => Boolean(s?.node && typeof s.node.name === 'string' && validNode(s.node) && validContours(s.geometry) && typeof s.savedAt === 'string')).slice(0, 3))
    } catch { /* Private browsing/storage restrictions do not block analysis. */ }
    return () => window.removeEventListener('popstate', restore)
  }, [])
  useEffect(() => { if (requestedNode) { setNode(requestedNode); setOpen(true); setPicking(false); setTab('study'); setCollapsed(false) } }, [requestedNode])
  useEffect(() => { if (suspended) { setOpen(false); setPicking(false) } }, [suspended])
  useEffect(() => { if (open) onOpenRef.current() }, [open])
  useEffect(() => {
    pickingCallback.current(picking && open)
    if (!map) return
    const canvas = map.getCanvas()
    if (picking && open) canvas.style.cursor = 'crosshair'
    const choose = (e: mapboxgl.MapMouseEvent) => {
      if (!picking || !open) return
      const selected = { name: 'Dropped pin', lon: Number(e.lngLat.lng.toFixed(5)), lat: Number(e.lngLat.lat.toFixed(5)) }
      if (!validNode(selected)) { setNotice('Choose a point within the Chicagoland research region.'); return }
      setNode(selected); setPicking(false); setTab('study'); setNotice(''); setCollapsed(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(false) }
    map.on('click', choose); window.addEventListener('keydown', escape)
    return () => { map.off('click', choose); window.removeEventListener('keydown', escape); canvas.style.cursor = ''; pickingCallback.current(false) }
  }, [map, picking, open])
  useEffect(() => {
    if (!node || !open) return
    const url = new URL(window.location.href)
    url.searchParams.set('catchment', `${node.lon.toFixed(5)},${node.lat.toFixed(5)}`)
    url.searchParams.set('node', node.name); url.searchParams.set('drive', String(minutes))
    window.history.replaceState(window.history.state, '', url)
  }, [node, minutes, open])

  const routing = useQuery<CatchmentGeometry>({
    queryKey: ['catchment-routing-v1', node?.lon, node?.lat], enabled: open && !!node,
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/catchment?lon=${node!.lon.toFixed(5)}&lat=${node!.lat.toFixed(5)}`, { signal })
      const d = await r.json()
      const generatedAt = typeof d.generatedAt === 'string' ? d.generatedAt : new Date().toISOString()
      if (!r.ok || !validContours(d)) throw new Error(d.error || 'Driving areas are unavailable.')
      return { ...d, generatedAt }
    }, staleTime: 86400000, gcTime: 86400000, retry: false,
  })
  const census = useQuery<{ data: DemandDataset; region: Area }>({
    queryKey: ['catchment-demand-v1'], enabled: open,
    queryFn: async ({ signal }) => {
      const responses = await Promise.all(['/data/catchments/demand.json', '/data/catchments/region.geojson'].map(url => fetch(url, { signal })))
      if (responses.some(r => !r.ok)) throw new Error('Census snapshot unavailable')
      const [data, region] = await Promise.all(responses.map(r => r.json()))
      if (data.version !== 1 || !data.tracts?.length || !data.anchors?.length || !region.geometry) throw new Error('Census snapshot incomplete')
      return { data, region: region.geometry }
    }, staleTime: Infinity, gcTime: 86400000, retry: 1,
  })

  const demand = useMemo(() => {
    if (!routing.data || !census.data) return null
    return Object.fromEntries(([10, 15] as const).map(m => { const a = areaFor(routing.data, m)!; return [m, { summary: summarizeDemand(a, census.data.data), covered: regionCovers(a, census.data.region) }] })) as Record<Minutes, { summary: DemandSummary; covered: boolean }>
  }, [routing.data, census.data])
  const supply = useMemo(() => routing.data ? Object.fromEntries(([10, 15] as const).map(m => [m, summarizeSupply(areaFor(routing.data, m)!, rows)])) as Record<Minutes, SupplySummary> : null, [routing.data, rows])
  const study: Study | null = supply ? { supply: supply[minutes], demand: demand?.[minutes].summary ?? null, covered: demand?.[minutes].covered ?? false } : null
  const comparisons = useMemo(() => saved.map(s => {
    const area = areaFor(s.geometry, minutes)!
    return { ...s, study: { supply: summarizeSupply(area, rows), demand: census.data ? summarizeDemand(area, census.data.data) : null, covered: !!census.data && regionCovers(area, census.data.region) } }
  }), [saved, rows, census.data, minutes])

  // Contours are below every office dot; a thin halo leaves all context layers legible.
  useEffect(() => {
    if (!map) return
    for (const id of ['catchment-fill', 'catchment-line']) if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource('catchment-area')) map.removeSource('catchment-area')
    markerRef.current?.remove(); markerRef.current = null
    if (!open || !node || !routing.data) return
    const features = [...routing.data.features].sort((a, b) => b.properties.contour - a.properties.contour)
    map.addSource('catchment-area', { type: 'geojson', data: { type: 'FeatureCollection', features } })
    const before = map.getLayer('office-pulse') ? 'office-pulse' : undefined
    map.addLayer({ id: 'catchment-fill', type: 'fill', source: 'catchment-area', paint: {
      'fill-color': ['match', ['get', 'contour'], 10, COLORS[10], COLORS[15]], 'fill-opacity': 0.065,
    } }, before)
    map.addLayer({ id: 'catchment-line', type: 'line', source: 'catchment-area', paint: {
      'line-color': ['match', ['get', 'contour'], 10, COLORS[10], COLORS[15]], 'line-width': 2.5, 'line-opacity': 0.9,
    } }, before)
    let cancelled = false
    import('mapbox-gl').then(({ default: mb }) => {
      if (cancelled) return
      const el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', 'Catchment origin. Drag to move.'); el.title = 'Drag to move your catchment'
      el.className = 'catchment-origin'; el.innerHTML = '<span></span>'
      const marker = new mb.Marker({ element: el, draggable: true }).setLngLat([node.lon, node.lat]).addTo(map)
      el.setAttribute('role', 'button')
      markerRef.current = marker
      marker.on('dragend', () => {
        const ll = marker.getLngLat(), n = { name: 'Dropped pin', lon: Number(ll.lng.toFixed(5)), lat: Number(ll.lat.toFixed(5)) }
        if (validNode(n)) { setNode(n); setNotice('') } else { marker.setLngLat([node.lon, node.lat]); setNotice('Keep the node within the Chicagoland research region.') }
      })
    })
    const bounds = areaBounds(areaFor(routing.data, 15)!)
    const desktop = map.getContainer().clientWidth >= 640
    map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: desktop ? { left: 400, right: 70, top: 85, bottom: 55 } : { left: 25, right: 55, top: 80, bottom: Math.min(map.getContainer().clientHeight * .48, 330) }, duration: 650, maxZoom: 13 })
    return () => { cancelled = true; markerRef.current?.remove(); markerRef.current = null }
  }, [map, node, routing.data, open])
  useEffect(() => {
    if (map?.getLayer('catchment-line')) map.setPaintProperty('catchment-line', 'line-width', ['case', ['==', ['get', 'contour'], minutes], 3, 1.5])
  }, [map, minutes, routing.data, open])
  useEffect(() => {
    if (!map?.getLayer('office-dots')) return
    map.setPaintProperty('office-dots', 'circle-opacity', open && supply
      ? ['case', ['in', ['get', 'id'], ['literal', supply[minutes].offices.map(p => p.location_id)]], 1, 0.22] : 1)
    return () => { if (map.getLayer('office-dots')) map.setPaintProperty('office-dots', 'circle-opacity', 1) }
  }, [map, open, supply, minutes])

  const close = () => {
    setOpen(false); setPicking(false)
    const url = new URL(window.location.href); ['catchment', 'node', 'drive'].forEach(k => url.searchParams.delete(k)); window.history.replaceState(window.history.state, '', url)
  }
  const persist = (next: SavedStudy[]) => {
    setSaved(next)
    try { localStorage.setItem(STORE, JSON.stringify(next)); setNotice('Saved on this device.') } catch { setNotice('Saved for this session. Browser storage is unavailable.') }
  }
  const save = () => {
    if (!node || !routing.data) return
    const next = saved.filter(s => Math.abs(s.node.lon - node.lon) > .00001 || Math.abs(s.node.lat - node.lat) > .00001)
    if (next.length >= 3) { setNotice('Three comparison slots are full. Remove a saved node to add this one.'); setTab('compare'); return }
    persist([...next, { node, geometry: routing.data, savedAt: new Date().toISOString() }])
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setNotice('This study is in the address bar. Copy the URL to share it.') }
  }
  const exportStudy = () => {
    if (!study || !node) return
    download('catchment-study.json', JSON.stringify({ node, minutes, exportedAt: new Date().toISOString(), directorySnapshotAt: syncedAt,
      geometry: routing.data, demand: study.demand, supply: { ...study.supply, offices: study.supply.offices.map(p => ({ id: p.location_id, name: displayName(p), address: p.address, city: p.city, zip: p.zip, status: mapState(p), ownershipTier: p.ownership_tier, providerNpis: p.provider_npis, yearEstablished: p.year_established })) },
      sources: { demand: `${window.location.origin}/data/catchments/metadata.json`, routing: 'Mapbox driving; typical conditions; outbound from node', offices: 'Live IL GP directory; all check states; removed records excluded' },
      limitations: ['All possible = mapped tracked records, not a true market ceiling.', 'NPI headcount is not GP clinical FTE.', 'Demographics are modeled ACS 2020–2024 estimates allocated with 2020 block weights.', 'Practice establishment year is not owner age or retirement intent.'] }, null, 2), 'application/json')
  }
  const exportOffices = () => {
    if (!study) return
    const cell = (v: unknown) => `"${String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""')}"`
    const data = [['Location ID', 'Office', 'Address', 'City', 'ZIP', 'Check status', 'Ownership tier', 'Linked individual NPIs', 'Established year', 'Minutes'],
      ...study.supply.offices.map(p => [p.location_id, displayName(p), p.address, p.city, p.zip, mapState(p), p.ownership_tier, p.provider_npis?.join('; '), p.year_established, minutes])]
    download('catchment-offices.csv', data.map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }
  const starter = nodeData.nodes.find(n => node && n.lon === node.lon && n.lat === node.lat)
  const waiting = !!node && routing.isFetching && !routing.data
  const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[.13em] text-[#758075]'
  const littleButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E0E5DD] bg-white px-2.5 text-[11px] font-medium text-[#344A40] hover:bg-[#F0F4EE] disabled:opacity-40'

  if (suspended) return null
  if (!open) return <button type="button" aria-label="Explore drive-time catchments" disabled={!map} onClick={() => { setOpen(true); setCollapsed(false) }}
    className="absolute left-2 top-[64px] z-20 flex min-h-11 items-center gap-2 rounded-xl border border-[#D7DFD4] bg-white/95 px-3 text-xs font-semibold text-[#253C34] shadow-sm backdrop-blur hover:bg-[#F2F6EF] disabled:opacity-40 sm:left-3 sm:top-[55px]">
    <Route className="h-4 w-4" /><span>Explore catchments</span><span className="rounded-md bg-[#EEF3E9] px-1.5 py-1 text-[10px] text-[#718168]">10 / 15 min</span>
  </button>

  return <>
    <style>{`.catchment-origin{width:30px;height:30px;background:#fff;border:2px solid #263E36;border-radius:50%;box-shadow:0 0 0 6px rgba(255,255,255,.7),0 3px 15px #263E3640;cursor:grab;display:grid;place-items:center}.catchment-origin span{width:10px;height:10px;background:#263E36;border-radius:50%}`}</style>
    {picking && <div role="status" className="pointer-events-none absolute left-3 right-16 top-[110px] z-30 rounded-xl bg-[#253C34] px-4 py-3 text-center text-xs text-white shadow-lg sm:left-[400px] sm:top-3">Click a road or commercial node to draw its catchment. <span className="opacity-65">Esc to cancel</span></div>}
    <section aria-label="Catchment research" className={`absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border border-[#DEE4DA] bg-[#FDFEFB] shadow-[0_10px_45px_-10px_#21382B40] sm:inset-x-auto sm:bottom-3 sm:left-3 sm:top-[55px] sm:w-[365px] sm:rounded-2xl ${collapsed || picking ? 'max-h-[90px] sm:max-h-none' : 'max-h-[55%] sm:max-h-none'}`}>
      <div className="shrink-0 border-b border-[#E4E8DE] bg-[#F0F4EB] px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#253C34] text-white"><Route className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold tracking-tight text-[#263D32]">Catchment studio</h2><p className="text-[10px] text-[#718068]">Follow roads. Study the households.</p></div></div>
          <div className="flex">{picking && <button onClick={() => setPicking(false)} className="px-2 text-xs font-medium text-[#52694A] sm:hidden">Cancel pin</button>}<button aria-label={collapsed ? 'Expand catchment panel' : 'Collapse catchment panel'} onClick={() => setCollapsed(v => !v)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white sm:hidden"><ChevronDown className={`h-4 w-4 ${collapsed ? 'rotate-180' : ''}`} /></button><button aria-label="Close catchment study" onClick={close} className="grid h-9 w-9 place-items-center rounded-lg text-[#5C6D5C] hover:bg-white"><X className="h-4 w-4" /></button></div>
        </div>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${collapsed ? 'hidden sm:block' : ''}`}>
        <div className="space-y-3 px-4 py-3">
          <div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Choose a research corridor</span><select aria-label="Choose a research corridor" value={starter?.id ?? ''} onChange={e => {
            const n = nodeData.nodes.find(n => n.id === e.target.value); if (n) { setNode({ name: `${n.name} · ${n.area}`, lon: n.lon, lat: n.lat }); setTab('study'); setPicking(false); setNotice('') }
          }} className="h-10 w-full rounded-lg border border-[#DCE3D6] bg-white px-2 text-xs text-[#344A40]"><option value="">{node ? 'Custom node' : 'Start with a corridor…'}</option>{nodeData.nodes.map(n => <option key={n.id} value={n.id}>{n.area} · {n.name}</option>)}</select></label>
            <button className={`${littleButton} ${picking ? 'ring-2 ring-[#819C74]' : ''}`} aria-pressed={picking} onClick={() => { setPicking(v => !v); setNotice('') }} title="Place a node anywhere on the map"><Crosshair className="h-4 w-4" />{picking ? 'Cancel' : 'Drop pin'}</button></div>
          {!node && <div className="space-y-3 py-1">
            <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-[#253C34]">A market is more<br />than a town boundary.</h3>
            <p className="text-xs leading-relaxed text-[#718068]">Pick a corridor or drop a pin. Compare the people reached in 10 and 15 minutes with every tracked GP office nearby.</p>
            {saved.length > 0 && <div className="space-y-1"><p className={sectionLabel}>Saved on this device</p>{saved.map(s => <button key={s.savedAt} className="block w-full rounded-lg bg-[#ECF2E4] p-2 text-left text-xs text-[#52694A]" onClick={() => setNode(s.node)}>{s.node.name}</button>)}</div>}
            {nodeData.nodes.filter(n => ['lockport', 'bartlett', 'elmhurst'].includes(n.id)).map(n => <button key={n.id} className="group block w-full rounded-xl border border-[#E2E8DC] bg-white p-3 text-left hover:border-[#9BAF8E] hover:bg-[#F7FAF3]" onClick={() => setNode({ name: `${n.name} · ${n.area}`, lon: n.lon, lat: n.lat })}>
              <span className={sectionLabel}>{n.lens}</span><strong className="mt-1 flex items-center justify-between text-[13px] font-semibold text-[#263D32]">{n.area}<MapPin className="h-3.5 w-3.5 text-[#96A68B]" /></strong><span className="mt-1 block text-[11px] leading-relaxed text-[#788373]">{n.question}</span></button>)}
            <p className="text-[10px] leading-relaxed text-[#8A9284]">Starting points are research hypotheses, not ranked recommendations or available practice sites.</p>
          </div>}
          {node && <>
            <div><p className={sectionLabel}>{starter?.lens ?? 'Custom research node'}</p><h3 className="mt-1 text-[16px] font-semibold leading-snug tracking-tight text-[#253C34]">{node.name}</h3><p className="mt-1 text-[10px] text-[#8A9284]">{node.lat.toFixed(4)}, {node.lon.toFixed(4)} · drag the pin to refine</p></div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#EDF1E8] p-1" aria-label="Drive time">
              {([10, 15] as const).map(m => <button key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold ${minutes === m ? 'bg-white shadow-sm' : 'text-[#7E8975]'}`} style={minutes === m ? { color: COLORS[m] } : undefined}><span className="h-2 w-2 rounded-full" style={{ background: COLORS[m] }} />{m} minutes <span className="text-[9px] font-normal opacity-65">{m === 10 ? 'core' : 'reach'}</span></button>)}
            </div>
            <p className="text-[10px] text-[#87907F]">Driving from this node · typical conditions · no live traffic</p>
            <div className="flex border-b border-[#E7EBDD] text-xs"><button onClick={() => setTab('study')} className={`flex-1 border-b-2 pb-2 font-medium ${tab === 'study' ? 'border-[#344A40] text-[#344A40]' : 'border-transparent text-[#919789]'}`}>Study this node</button><button onClick={() => setTab('compare')} className={`flex-1 border-b-2 pb-2 font-medium ${tab === 'compare' ? 'border-[#344A40] text-[#344A40]' : 'border-transparent text-[#919789]'}`}>Compare <span className="ml-1 rounded bg-[#EEF2E8] px-1.5 text-[10px]">{saved.length}/3</span></button></div>
          </>}
          {waiting && <p role="status" className="flex items-center gap-2 rounded-xl bg-[#F1F5EC] p-4 text-xs text-[#64775B]"><Loader2 className="h-4 w-4 animate-spin" />Following roads for both driving areas…</p>}
          {routing.isError && node && <div role="alert" className="rounded-xl bg-[#FFF5E6] p-3 text-xs text-[#895E25]">{routing.error.message}<button onClick={() => void routing.refetch()} className="ml-2 underline">Retry routing</button></div>}
          {notice && <p role="status" className="rounded-lg bg-[#F2F5ED] p-2 text-[11px] text-[#66775E]">{notice}</p>}
          {tab === 'compare' && node && <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-[#788373]">Save up to three nodes. All use the same {minutes}-minute window and current directory snapshot. Saved on this device.</p>
            {!saved.length && <p className="rounded-xl border border-dashed border-[#C9D4BE] p-5 text-center text-xs text-[#718068]">Save this node to start a comparison.</p>}
            {comparisons.map((s, i) => <div key={`${s.node.lon},${s.node.lat}`} className="rounded-xl border border-[#DFE6D7] bg-white p-3"><div className="flex gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EDF2E7] text-[10px] font-bold text-[#52694A]">{String.fromCharCode(65 + i)}</span><button onClick={() => { setNode(s.node); setTab('study') }} className="flex-1 text-left text-xs font-semibold text-[#344A40] hover:underline">{s.node.name}</button><button aria-label={`Remove ${s.node.name} from comparison`} onClick={() => persist(saved.filter((_, n) => n !== i))} className="grid h-7 w-7 place-items-center text-[#96A18D]"><X className="h-3.5 w-3.5" /></button></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">{[['Residents', s.study.covered ? approx(s.study.demand?.population) : 'Partial coverage'], ['Median HH income', money(s.study.demand)], ['Confirmed / all possible', `${s.study.supply.confirmed} / ${s.study.supply.possible}`], ['Homes built 2020+', pct(s.study.demand?.recentHousingPct)], ['30+ year dentist-owned', fmt(s.study.supply.established)], ['Tracked ZIP coverage', pct(s.study.demand?.trackedPopulationPct)]].map(([label, value]) => <div key={label}><dt className="text-[#89947F]">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-[#344A40]">{value}</dd></div>)}</dl><p className="mt-2 text-[9px] text-[#919A87]">Boundary saved {new Date(s.savedAt).toLocaleDateString()} · select to refresh routing</p></div>)}
          </div>}
          {tab === 'study' && study && <>
            <div className="flex gap-1 rounded-lg bg-[#F1F4EC] p-1 text-[11px]"><button aria-pressed={lens === 'market'} onClick={() => setLens('market')} className={`flex-1 rounded-md py-2 ${lens === 'market' ? 'bg-white font-semibold text-[#344A40] shadow-sm' : 'text-[#819074]'}`}>Households & competition</button><button aria-pressed={lens === 'acquisition'} onClick={() => setLens('acquisition')} className={`flex-1 rounded-md py-2 ${lens === 'acquisition' ? 'bg-white font-semibold text-[#344A40] shadow-sm' : 'text-[#819074]'}`}>Acquisition context</button></div>
            <Competition study={study} />
            {lens === 'market' ? <>
              {census.isPending && <p role="status" className="text-xs text-[#718068]">Loading Census household estimates…</p>}
              {census.isError && <p role="alert" className="text-xs text-[#895E25]">Household estimates unavailable. Office counts still work. <button className="underline" onClick={() => void census.refetch()}>Retry Census</button></p>}
              {study.demand && <Demand study={study} />}
              {minutes === 15 && supply && demand && demand[10].covered && demand[15].covered && demand[10].summary.population !== null && demand[15].summary.population !== null && <div className="rounded-xl border border-[#E3E7DC] bg-[#FAFBF7] p-3"><p className={sectionLabel}>What the extra 5 minutes adds</p><p className="mt-2 text-xs leading-relaxed text-[#52664B]"><strong>{approx(Math.max(0, demand[15].summary.population - demand[10].summary.population))}</strong> estimated residents and <strong>{fmt(Math.max(0, supply[15].possible - supply[10].possible))}</strong> more possible offices.</p><p className="mt-1 text-[10px] text-[#8A9284]">Difference between windows; tests neighboring-market exposure, not patient leakage.</p></div>}
              <button onClick={onHomes} className="flex w-full items-center justify-between rounded-xl border border-[#E0E6D8] px-3 py-2.5 text-[11px] font-medium text-[#52694A]">Inspect residential land underneath<ExternalLink className="h-3.5 w-3.5" /></button>
              <button onClick={() => node && onCommute(node)} className="flex w-full items-center justify-between rounded-xl bg-[#EAF0E2] px-3 py-2.5 text-[11px] font-semibold text-[#52694A]">Plan my commute to this node<Route className="h-3.5 w-3.5" /></button>
            </> : <Acquisition supply={study.supply} />}
            <details className="rounded-xl border border-[#E2E7DB] bg-white px-3 py-2.5 text-[11px]"><summary className="cursor-pointer font-medium text-[#52694A]">{fmt(study.supply.possible)} offices inside · inspect or export</summary><div className="mt-3 max-h-60 space-y-2 overflow-y-auto">{study.supply.offices.map(p => <a key={p.location_id} href={`/practice/${encodeURIComponent(p.location_id!)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-[#F5F8F0]"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: MAP_META[mapState(p)].color }} /><span className="min-w-0"><strong className="block text-[#344A40]">{displayName(p)}</strong><span className="text-[10px] text-[#8A9284]">{p.address} · {p.city}</span></span></a>)}</div><button onClick={exportOffices} className={`${littleButton} mt-3 w-full`}><Download className="h-3 w-3" />Office CSV</button></details>
            <details className="text-[10px] leading-relaxed text-[#8A9284]"><summary className="cursor-pointer font-medium text-[#6F7E65]">Sources, coverage & estimation</summary><div className="mt-2 space-y-2">
              <p>ACS 2020–2024 estimates allocated to 2020 Census block internal points. Population uses block population weights; income and households use housing-unit weights. New subdivisions since 2020 can be misplaced. Estimates are rounded for screening.</p>
              <p>Income pools household-income bands before estimating a median. It does not average tract medians. Age and education assume the tract mix within populated blocks. Sampling and spatial-allocation uncertainty remain; no catchment confidence interval is claimed.</p>
              <p>{fmt(study.demand?.blockCount)} blocks across {fmt(study.demand?.tractCount)} tracts. {pct(study.demand?.trackedPopulationPct)} of modeled residents fall in tracked ZIP areas (Census ZCTA approximation). {fmt(study.supply.unmappedRegion)} listed offices lack usable coordinates regionwide and cannot be assigned to a catchment.</p>
              <p>Mapbox driving areas are reachable outward from the origin under typical conditions. Patient travel to the office can differ. Contours are approximate, not municipal borders. The office inventory is incomplete; “all possible” is the mapped tracked set, never a true upper bound on competitors.</p>
              <p>Office counts ignore map search, area and color filters. Removed records are excluded. Counts reflect {syncedAt ? new Date(syncedAt).toLocaleString() : 'the latest directory snapshot'}. {stale ? 'The feed is reconnecting; these are the last successful counts.' : ''}</p>
              <p><a className="underline" href="/data/catchments/metadata.json" target="_blank" rel="noopener noreferrer">Dataset provenance & fields</a> · <a className="underline" href="https://docs.mapbox.com/api/navigation/isochrone/" target="_blank" rel="noopener noreferrer">Routing method</a></p>
            </div></details>
          </>}
        </div>
      </div>
      {node && !collapsed && !picking && <div className="flex shrink-0 gap-1.5 border-t border-[#E2E8DC] bg-white px-3 py-2.5"><button onClick={save} disabled={!routing.data} className={`${littleButton} flex-1`}><BookmarkPlus className="h-3.5 w-3.5" />Save node</button><button onClick={copy} className={littleButton} aria-label="Copy catchment link">{copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Share'}</button><button onClick={exportStudy} disabled={!study} className={littleButton} title="Download boundaries, metrics, offices and provenance as JSON"><Download className="h-3.5 w-3.5" />Study JSON</button></div>}
    </section>
  </>
}

function Competition({ study }: { study: Study }) {
  const { supply: s, demand: d } = study
  const range = competitionRange(study.covered ? d?.population ?? null : null, s, d?.trackedPopulationPct ?? null)
  return <section aria-label="Catchment competition" className="rounded-xl border border-[#DEE5D5] bg-white p-3.5">
    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#89947F]">GP offices · {s.possible} tracked possibilities</p>
    <div className="mt-2 flex items-baseline gap-2"><strong className="font-mono text-[30px] font-semibold leading-none tracking-tight text-[#263E33]">{s.confirmed}</strong><span className="text-[11px] text-[#829075]">confirmed</span><span className="mx-1 text-[#BDC7B2]">→</span><strong className="font-mono text-[30px] font-semibold leading-none tracking-tight text-[#9B813F]">{s.possible}</strong><span className="text-[11px] text-[#829075]">all possible</span></div>
    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#F1F3EE]">{(['confirmed', 'unresolved', 'unchecked'] as const).map(k => <span key={k} style={{ width: `${s.possible ? 100 * s[k] / s.possible : 0}%`, background: MAP_META[k].color }} />)}</div>
    <p className="mt-2 flex flex-wrap gap-x-3 text-[10px] text-[#829075]"><span>{s.unresolved} unresolved</span><span>{s.unchecked} unchecked</span><span>{s.possible ? Math.round(100 * s.confirmed / s.possible) : 0}% confirmed</span></p>
    {range && <div className="mt-3 border-t border-[#EFF2E9] pt-2"><p className="text-[10px] text-[#829075]">Estimated residents per tracked GP office</p><p className="mt-0.5 font-mono text-base font-semibold text-[#344A40]">{approx(range.low, 10)}{range.high !== null ? ` – ${approx(range.high, 10).replace('≈', '')}` : ' · confirmed ratio unavailable'}</p><p className="mt-1 text-[9px] text-[#99A08F]">All possible → confirmed only. No universal “ideal” ratio.</p></div>}
    <p className="mt-2 text-[9px] leading-relaxed text-[#99A08F]">All tracked offices, regardless of map filters. Possible records may resolve to duplicates; unlisted offices may exist.</p>
  </section>
}
function Demand({ study }: { study: Study }) {
  const d = study.demand!
  return <section aria-label="Catchment households" className="space-y-3">
    {(!study.covered || (d.trackedPopulationPct ?? 0) < 95) && <p role="status" className="rounded-xl bg-[#FFF4DF] p-3 text-[11px] leading-relaxed text-[#896629]">{!study.covered ? 'This drive area extends beyond Census coverage. Household figures cover only the available area.' : `Only ${pct(d.trackedPopulationPct)} of estimated residents are in tracked ZIP areas. Competitors beyond the directory are missing.`} Population-per-office comparisons are withheld.</p>}
    <div className="grid grid-cols-2 gap-2">{[['Residents', approx(d.population)], ['Median HH income', money(d)], ['Households', approx(d.households, 10)], ['Households $100k+', pct(d.highIncomePct)]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#F0F4EA] p-3"><p className="text-[10px] text-[#829075]">{label}</p><p className="mt-1 font-mono text-[18px] font-semibold tracking-tight text-[#344A40]">{value}</p></div>)}</div>
    <div className="space-y-2 rounded-xl border border-[#E1E7D9] bg-white p-3">{[['Under 18', d.under18Pct], ['Age 65+', d.over65Pct], ['Bachelor’s or higher · adults 25+', d.bachelorsPct], ['Owner-occupied households', d.ownerOccupiedPct]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-2 text-[11px]"><span className="text-[#87927D]">{label}</span><strong className="font-medium tabular-nums text-[#52694A]">{pct(value as number | null)}</strong></div>)}</div>
    <div className="rounded-xl border border-[#E2E6D9] p-3"><div className="flex justify-between gap-2 text-xs"><span className="text-[#7B876F]">Housing built 2020 or later</span><strong className="font-mono text-[#52694A]">{pct(d.recentHousingPct)}</strong></div><p className="mt-1 text-[10px] leading-relaxed text-[#929B87]">{approx(d.recentHousingUnits, 10)} units in the ACS estimate. Recent construction context, not permits or a forecast.</p></div>
    <p className="text-[9px] leading-relaxed text-[#99A08F]">ACS 2020–2024 · modeled within this driving area using 2020 blocks. Income is in 2024 dollars. Household characteristics do not establish payer mix or willingness to pay.</p>
  </section>
}
function Acquisition({ supply: s }: { supply: SupplySummary }) {
  return <section aria-label="Catchment acquisition context" className="space-y-3">
    <div className="rounded-xl bg-[#F0F4EA] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#829075]">Existing supply can be the opportunity</p><p className="mt-2 text-xs leading-relaxed text-[#64775B]">Use this lens to find established dentist-owned offices in a viable market. A crowded map alone does not rule out an acquisition.</p></div>
    <div className="space-y-2 rounded-xl border border-[#E1E7D9] bg-white p-3"><p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[#829075]">Census ownership · confirmed offices only</p>{HEADLINE_BUCKETS.map(b => <div key={b} className="flex items-center justify-between gap-3 text-[11px]"><span className="text-[#78866D]">{BUCKET_META[b].label}</span><strong className="font-mono text-[#52694A]">{s.ownership[b]}</strong></div>)}</div>
    <div className="rounded-xl border border-[#E1E7D9] bg-white p-3"><p className="text-[10px] text-[#829075]">Dentist-owned offices established 30+ years ago</p><p className="mt-1 font-mono text-2xl font-semibold text-[#344A40]">{s.established}</p><p className="mt-1 text-[10px] leading-relaxed text-[#929B87]">{s.ageKnown} dentist-owned offices have a usable establishment year. Business age is not owner age, retirement intent or availability for sale.</p></div>
    <div className="rounded-xl border border-[#E1E7D9] bg-white p-3"><p className="text-[10px] text-[#829075]">Linked individual NPI records</p><p className="mt-1 font-mono text-2xl font-semibold text-[#344A40]">{s.linkedProviders || '—'}</p><p className="mt-1 text-[10px] leading-relaxed text-[#929B87]">Registry links at {s.linkedOffices} of {s.confirmed} confirmed offices; {s.multiProvider} have multiple linked providers. Distinct NPIs are deduplicated across offices. Records may be stale or include specialists; this is not active GP headcount or clinical FTE.</p></div>
    <p className="text-[10px] leading-relaxed text-[#89947F]">Collections, patient retention, operatories, payer mix and sale availability belong in practice-specific diligence. No public-data financial score is assigned.</p>
  </section>
}
