'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type mapboxgl from 'mapbox-gl'
import { ArrowDown, ArrowLeftRight, BriefcaseBusiness, Car, Home, Loader2, MapPin, X } from 'lucide-react'
import { containsPoint, type Area } from '@/lib/maps/catchment'
import { commuteArrival, travelTime, type CommutePoint, type CommuteResult } from '@/lib/maps/commute'

const AM = '#2A718C', PM = '#AB7B35'
export function CommutePlanner({ map, active, onClose, onPickingChange, initialWork }: {
  map: mapboxgl.Map | null; active: boolean; onClose: () => void
  onPickingChange: (value: boolean) => void; initialWork: CommutePoint | null
}) {
  const [home, setHome] = useState<CommutePoint | null>(null), [work, setWork] = useState<CommutePoint | null>(null)
  const [picking, setPicking] = useState<'home' | 'work' | null>(null)
  const [weekday, setWeekday] = useState(2), [avoidTolls, setAvoidTolls] = useState(false)
  const [show, setShow] = useState<'morning' | 'evening'>('morning'), [notice, setNotice] = useState('')
  const callback = useRef(onPickingChange); callback.current = onPickingChange
  const markers = useRef<mapboxgl.Marker[]>([])
  const scope = useQuery<Area>({ queryKey: ['tracked-zip-geometry'], enabled: active, staleTime: Infinity,
    queryFn: async ({ signal }) => { const r = await fetch('/data/land-use/scope.geojson', { signal }); if (!r.ok) throw new Error('ZIP boundary unavailable'); return (await r.json()).features[0].geometry },
  })
  useEffect(() => { if (initialWork) { setWork(initialWork); setNotice(''); setPicking(null) } }, [initialWork])
  useEffect(() => { if (!active) setPicking(null) }, [active])
  useEffect(() => {
    callback.current(active && !!picking)
    if (!map || !active) return
    if (picking) map.getCanvas().style.cursor = 'crosshair'
    const click = (e: mapboxgl.MapMouseEvent) => {
      if (!picking || !scope.data) return
      const p = { lon: Number(e.lngLat.lng.toFixed(5)), lat: Number(e.lngLat.lat.toFixed(5)) }
      if (!containsPoint(scope.data, p.lon, p.lat)) { setNotice('Place the pin inside the outlined tracked ZIP area.'); return }
      if (picking === 'home') { setHome(p); setPicking(work ? null : 'work') } else { setWork(p); setPicking(null) }
      setNotice('')
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(null) }
    map.on('click', click); window.addEventListener('keydown', escape)
    return () => { map.off('click', click); window.removeEventListener('keydown', escape); map.getCanvas().style.cursor = ''; callback.current(false) }
  }, [map, active, picking, scope.data, work])
  const result = useQuery<CommuteResult>({
    queryKey: ['commute-v1', home, work, weekday, avoidTolls], enabled: active && !!home && !!work,
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({ homeLon: String(home!.lon), homeLat: String(home!.lat), workLon: String(work!.lon), workLat: String(work!.lat), weekday: String(weekday), avoidTolls: String(avoidTolls) })
      const r = await fetch(`/api/commute?${query}`, { signal }), d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Commute estimates unavailable')
      return d
    }, staleTime: 300000, gcTime: 1800000, retry: false,
  })
  useEffect(() => {
    if (!map) return
    const clear = () => { for (const id of ['commute-route-casing', 'commute-route', 'commute-boundary']) if (map.getLayer(id)) map.removeLayer(id); for (const id of ['commute-route', 'commute-boundary']) if (map.getSource(id)) map.removeSource(id) }
    clear()
    if (!active) return
    if (scope.data) {
      map.addSource('commute-boundary', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: scope.data } })
      map.addLayer({ id: 'commute-boundary', type: 'line', source: 'commute-boundary', paint: { 'line-color': '#788C76', 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': .7 } }, 'office-pulse')
    }
    if (result.data) {
      const leg = result.data[show]
      map.addSource('commute-route', { type: 'geojson', data: { type: 'Feature', geometry: leg.geometry, properties: {} } })
      map.addLayer({ id: 'commute-route-casing', type: 'line', source: 'commute-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': .95 } }, 'office-pulse')
      map.addLayer({ id: 'commute-route', type: 'line', source: 'commute-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': show === 'morning' ? AM : PM, 'line-width': 4.5 } }, 'office-pulse')
      const points = leg.geometry.coordinates, xs = points.map(p => p[0]), ys = points.map(p => p[1]), desktop = map.getContainer().clientWidth >= 640
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: desktop ? { left: 405, right: 75, top: 90, bottom: 60 } : { left: 35, right: 65, top: 80, bottom: Math.min(map.getContainer().clientHeight * .5, 340) }, maxZoom: 14, duration: 600 })
    }
    return clear
  }, [map, active, scope.data, result.data, show])
  useEffect(() => {
    markers.current.forEach(m => m.remove()); markers.current = []
    if (!map || !active || !scope.data) return
    let cancelled = false
    import('mapbox-gl').then(({ default: mb }) => {
      if (cancelled) return
      for (const [key, point, color] of [['home', home, AM], ['work', work, PM]] as const) {
        if (!point) continue
        const el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', `${key === 'home' ? 'Home' : 'Work'} pin. Drag to move.`)
        el.style.cssText = `width:34px;height:34px;background:${color};color:white;border:3px solid white;border-radius:50%;font:bold 13px Inter,system-ui;box-shadow:0 2px 12px #0004;cursor:grab`
        el.textContent = key === 'home' ? 'H' : 'W'
        const marker = new mb.Marker({ element: el, draggable: true }).setLngLat([point.lon, point.lat]).addTo(map)
        el.setAttribute('role', 'button')
        marker.on('dragend', () => {
          const ll = marker.getLngLat(), p = { lon: Number(ll.lng.toFixed(5)), lat: Number(ll.lat.toFixed(5)) }
          if (!containsPoint(scope.data!, p.lon, p.lat)) { marker.setLngLat([point.lon, point.lat]); setNotice('Keep both pins inside the tracked ZIP boundary.'); return }
          if (key === 'home') setHome(p); else setWork(p); setNotice('')
        })
        markers.current.push(marker)
      }
    })
    return () => { cancelled = true; markers.current.forEach(m => m.remove()); markers.current = [] }
  }, [map, active, home, work, scope.data])

  if (!active) return null
  const card = 'rounded-xl border border-[#E0E6DA] bg-white p-3'
  return <>
    {picking && <div role="status" className="absolute left-3 right-16 top-[110px] z-30 flex items-center justify-between gap-2 rounded-xl bg-[#253C34] px-3 py-2.5 text-xs text-white shadow-lg sm:left-[402px] sm:top-3"><span>Drop your <strong>{picking}</strong> pin inside the boundary.</span><button onClick={() => setPicking(null)} className="rounded-lg bg-white/15 px-2 py-1.5">Cancel</button></div>}
    <section aria-label="Commute planner" className={`absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border border-[#DCE4D6] bg-[#FDFEFB] shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-[55px] sm:max-h-[calc(100%-75px)] sm:w-[365px] sm:rounded-2xl ${picking ? 'max-h-[80px]' : 'max-h-[55%]'}`}>
      <header className="flex shrink-0 items-center justify-between bg-[#F0F4EB] px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#253C34] text-white"><Car className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[#263D32]">Your weekday commute</h2><p className="text-[10px] text-[#7B886F]">Two pins. Both rush-hour directions.</p></div></div><button aria-label="Close commute planner" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-[#718068] hover:bg-white"><X className="h-4 w-4" /></button></header>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="grid grid-cols-[1fr_30px_1fr] items-center gap-1.5">{(['home', 'swap', 'work'] as const).map(key => key === 'swap' ? <button key={key} aria-label="Swap home and work" disabled={!home || !work} onClick={() => { setHome(work); setWork(home) }} className="grid h-9 w-7 place-items-center text-[#7B886F] disabled:opacity-30"><ArrowLeftRight className="h-3.5 w-3.5" /></button> : <button key={key} disabled={!scope.data} onClick={() => setPicking(key)} aria-pressed={picking === key} className={`${card} text-left hover:bg-[#F4F8EE] ${picking === key ? 'ring-2 ring-[#8CA57C]' : ''}`}>
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: key === 'home' ? AM : PM }}>{key === 'home' ? <Home className="h-3.5 w-3.5" /> : <BriefcaseBusiness className="h-3.5 w-3.5" />}{key === 'home' ? 'Home' : 'Work'}</span><span className="mt-1 block text-[10px] text-[#87947C]">{(key === 'home' ? home : work) ? 'Pin placed · tap to move' : 'Place on map'}</span>
        </button>)}</div>
        <div className="flex items-center justify-between gap-2 text-xs text-[#64785B]"><label>Weekday <select aria-label="Commute weekday" value={weekday} onChange={e => setWeekday(Number(e.target.value))} className="ml-1 rounded-lg border border-[#DCE3D5] bg-white p-2">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label><label className="flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={avoidTolls} onChange={e => setAvoidTolls(e.target.checked)} className="accent-[#344A40]" />Avoid tolls</label></div>
        {notice && <p role="status" className="rounded-lg bg-[#FFF2DC] p-2 text-[11px] text-[#8D6829]">{notice}</p>}
        {scope.isError && <p role="alert" className="text-xs text-[#946631]">Boundary unavailable. <button className="underline" onClick={() => void scope.refetch()}>Retry boundary</button></p>}
        {!home || !work ? <div className="rounded-xl bg-[#F1F5EB] p-4"><MapPin className="mb-2 h-5 w-5 text-[#7D956B]" /><p className="text-[15px] font-semibold text-[#344A40]">Can you live here and work there?</p><p className="mt-2 text-xs leading-relaxed text-[#809072]">Place Home and Work anywhere inside the outlined tracked ZIP area. We’ll estimate leaving home at 6:45 AM and leaving work at 4:00 PM, in Chicago time.</p></div> : result.isFetching && !result.data ? <p role="status" className="flex items-center gap-2 py-5 text-xs text-[#718068]"><Loader2 className="h-4 w-4 animate-spin" />Checking both directions with weekday traffic…</p> : null}
        {result.isError && <p role="alert" className="rounded-xl bg-[#FFF2DC] p-3 text-xs text-[#8D6829]">{result.error.message} <button className="underline" onClick={() => void result.refetch()}>Retry commute</button></p>}
        {result.data && <>
          <div className="space-y-2">{(['morning', 'evening'] as const).map(key => { const leg = result.data[key], am = key === 'morning'; return <button key={key} aria-pressed={show === key} aria-label={am ? 'Show morning commute' : 'Show evening commute'} onClick={() => setShow(key)} className={`${card} w-full text-left ${show === key ? 'ring-1 ring-[#A8B89B]' : 'opacity-75'}`}>
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: am ? AM : PM }}><span>{am ? '6:45 AM · Home → Work' : '4:00 PM · Work → Home'}</span><span className="h-2 w-2 rounded-full" style={{ background: am ? AM : PM }} /></span>
            <span className="mt-2 flex items-end justify-between gap-2"><strong className="font-mono text-[28px] font-semibold tracking-tight text-[#344A40]">≈ {travelTime(leg.seconds)}</strong><span className="mb-1 text-[11px] text-[#88967C]">{(leg.meters / 1609.344).toFixed(1)} mi</span></span>
            <span className="mt-1 block text-xs text-[#7A8B6D]">{am ? 'At work' : 'Home'} around {commuteArrival(am ? 6 : 16, am ? 45 : 0, leg.seconds)}</span>
            {leg.roads && <span className="mt-1 block text-[10px] text-[#9AA48F]">Via {leg.roads}</span>}
          </button> })}</div>
          <div className="flex items-center justify-between rounded-xl bg-[#EAF0E2] px-3 py-3 text-xs text-[#647B56]"><span className="flex items-center gap-1.5"><ArrowDown className="h-3.5 w-3.5" />Time on the road per day</span><strong className="font-mono">≈ {travelTime(result.data.morning.seconds + result.data.evening.seconds)}</strong></div>
          <p className="text-[10px] leading-relaxed text-[#88967C]">Planned for {new Date(`${result.data.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Chicago' })}. Times use America/Chicago, including daylight saving. Tap a trip to see its route. Drag either pin to compare another location.</p>
          {Math.max(result.data.morning.snapMeters, result.data.evening.snapMeters) > 150 && <p className="rounded-lg bg-[#FFF3DE] p-2 text-[10px] text-[#8D6829]">A pin was snapped more than 150 metres to a routable road. Move it onto the intended access road for a better estimate.</p>}
        </>}
        <p className="text-[10px] leading-relaxed text-[#96A089]">Mapbox traffic-aware forecast for the next selected weekday. Historical traffic informs future trips; incidents, weather and holidays can change the result. Driving time excludes parking and walking. Pins stay in this session.</p>
        <details className="text-[10px] leading-relaxed text-[#96A089]"><summary className="cursor-pointer">Boundary & routing source</summary><p className="mt-1">Pins are limited to the directory’s tracked ZIP area, approximated by Census ZCTAs; postal-only ZIPs have no separate polygon. Roads may travel outside that area.</p><a className="underline" href="https://docs.mapbox.com/api/navigation/directions/#optional-parameters-for-the-mapboxdriving-traffic-profile" target="_blank" rel="noopener noreferrer">Mapbox departure-time traffic methodology</a></details>
      </div>
    </section>
  </>
}
