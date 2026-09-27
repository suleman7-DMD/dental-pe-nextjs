'use client'
import { Suspense, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, Download, List, Map as MapIcon, LayoutGrid, Network } from 'lucide-react'
import { useLiveDirectory } from '@/lib/hooks/use-live-directory'
import { RESEARCH_META, RESEARCH_STATES, researchState, summarizeDirectory, type ResearchState } from '@/lib/directory/live-directory'
import { displayName } from '@/lib/census/display-name'
import { formatNetworkId } from '@/lib/census/ownership-truth'
import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'
import { LiveSummary } from './live-summary'
import { OfficeList } from './office-list'
import type { LiveOffice as Practice } from '@/lib/directory/live-directory'

const PracticeMap = dynamic(() => import('@/app/job-market/_components/practice-density-map').then(m => m.PracticeDensityMap), { ssr: false, loading: () => <div className="flex h-[calc(100svh-150px)] min-h-[440px] items-center justify-center rounded-2xl border border-[#DCE1D9] bg-[#EEF1EB] text-sm text-[#52625A] sm:h-[72vh]">Loading map…</div> })
const VIEWS = [{ id: 'directory', label: 'List', icon: List }, { id: 'map', label: 'Map', icon: MapIcon }, { id: 'overview', label: 'ZIPs', icon: LayoutGrid }, { id: 'tree', label: 'Groups', icon: Network }]

export function ZipDirectoryTable({ rows, zips }: { rows: Practice[]; zips: { zip: string; city: string }[] }) {
  const stats = useMemo(() => {
    const groups = new Map<string, Practice[]>()
    for (const p of rows) { const z = p.zip ?? ''; groups.set(z, [...(groups.get(z) ?? []), p]) }
    return zips.map(z => ({ ...z, rows: groups.get(z.zip) ?? [] })).sort((a, b) => b.rows.length - a.rows.length || a.zip.localeCompare(b.zip))
  }, [rows, zips])
  return <div className="overflow-x-auto rounded-2xl border border-[#E8E5DE] bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#FAFBF8] text-xs text-[#747970]"><tr>{['ZIP / city', 'Listed', 'Confirmed', 'Unresolved', 'Not yet checked'].map(t => <th key={t} className="px-4 py-3 font-medium">{t}</th>)}</tr></thead><tbody className="divide-y divide-[#F0F1ED]">{stats.map(z => { const s = summarizeDirectory(z.rows); return <tr key={z.zip}><td className="px-4 py-3"><Link className="font-medium text-[#253C34] hover:underline" href={`/office-census?zip=${z.zip}`}>{z.zip}</Link><span className="ml-2 text-xs text-[#747970]">{z.city}</span></td><td className="px-4 py-3 tabular-nums">{z.rows.length}</td><td className="px-4 py-3 tabular-nums text-[#16836D]">{s.confirmed + s.updated}</td><td className="px-4 py-3 tabular-nums text-[#AF791C]">{s.unresolved}</td><td className="px-4 py-3 tabular-nums text-[#747970]">{s.unchecked}</td></tr> })}</tbody></table></div>
}

function Workspace() {
  const live = useLiveDirectory()
  const params = useSearchParams(); const router = useRouter(); const pathname = usePathname()
  const requestedView = params.get('tab') ?? 'directory'
  const view = requestedView === 'analytics' ? 'overview' : VIEWS.some(v => v.id === requestedView) ? requestedView : 'directory'
  const [search, setSearch] = useState(params.get('q') ?? params.get('zip') ?? '')
  const [status, setStatus] = useState<ResearchState | 'all'>('all')
  const location = params.get('location') || 'All Chicagoland'
  const area = LIVING_LOCATIONS[location] ?? LIVING_LOCATIONS['All Chicagoland']
  const inScope = (p: Practice) => location === 'All Chicagoland' || area.commutable_zips.includes(p.zip ?? '')
  const scopeRows = (live.data?.visible ?? []).filter(inScope)
  const removed = (live.data?.removed ?? []).filter(inScope)
  const term = search.toLowerCase().trim()
  const matches = (p: Practice) => [displayName(p), p.practice_name, p.address, p.city, p.zip, p.network_id, p.phone].some(s => s?.toLowerCase().includes(term))
  const filtered = scopeRows.filter(p => matches(p) && (view === 'map' || status === 'all' || researchState(p) === status)).sort((a, b) => displayName(a).localeCompare(displayName(b)))
  const changeParam = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); router.replace(`${pathname}?${next}`, { scroll: false }) }
  const zips = (live.data?.zips ?? []).filter(z => (location === 'All Chicagoland' || area.commutable_zips.includes(z.zip)) && (!term || z.zip.includes(term) || z.city.toLowerCase().includes(term) || filtered.some(p => p.zip === z.zip)))
  const groups = new Map<string, Practice[]>()
  for (const p of filtered) { const key = p.network_id || 'unassigned'; groups.set(key, [...(groups.get(key) ?? []), p]) }
  const download = () => {
    const escape = (v: unknown) => `"${String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""')}"`
    const csv = [['Practice', 'Address', 'City', 'ZIP', 'Phone', 'Website', 'Validator status', 'Checked at'], ...filtered.map(p => [displayName(p), p.address, p.city, p.zip, p.phone, p.website, RESEARCH_META[researchState(p)].label, p.web_check?.checked_at])].map(r => r.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'directory-current-view.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const isMap = view === 'map'
  return <main className={`mx-auto space-y-3 px-3 pb-6 pt-3 sm:px-5 sm:pt-4 ${isMap ? 'max-w-[1680px]' : 'max-w-[1440px] sm:space-y-4'}`}>
    {/* One compact command bar: title, views, search and area. The map below gets the rest of the screen. */}
    <header className="grid grid-cols-[1fr_auto] items-center gap-2 pl-12 md:flex md:flex-wrap md:pl-0">
      <h1 className="sr-only mr-1 text-xl font-semibold tracking-tight text-[#202824] md:not-sr-only">Directory</h1>
      <div className="col-span-2 flex rounded-xl border border-[#E0E4DD] bg-white p-1 md:col-auto" aria-label="Directory views">{VIEWS.map(v => <button key={v.id} aria-pressed={view === v.id} onClick={() => changeParam('tab', v.id)} className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium md:flex-none md:px-3 ${view === v.id ? 'bg-[#253C34] text-white' : 'text-[#747970] hover:bg-[#F3F5F0]'}`}><v.icon className="h-3.5 w-3.5 shrink-0" />{v.label}</button>)}</div>
      <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E0E4DD] bg-white px-3 py-2 md:min-w-56 md:flex-1"><Search className="h-4 w-4 shrink-0 text-[#939BA8]" /><input aria-label="Search directory" placeholder="Search practices" value={search} onChange={e => setSearch(e.target.value)} className="w-full min-w-0 bg-transparent text-base outline-none md:text-sm" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="text-xs text-[#939BA8] hover:text-[#253C34]">Clear</button>}</label>
      <select aria-label="Directory area" value={location in LIVING_LOCATIONS ? location : 'All Chicagoland'} onChange={e => changeParam('location', e.target.value)} className="max-w-[42vw] rounded-xl border border-[#E0E4DD] bg-white px-3 py-2.5 text-sm md:max-w-none md:py-2">{Object.keys(LIVING_LOCATIONS).map(k => <option key={k}>{k}</option>)}</select>
      {!isMap && <div className="col-span-2 flex gap-2 md:col-auto"><select aria-label="Validator status" value={status} onChange={e => setStatus(e.target.value as typeof status)} className="flex-1 rounded-xl border border-[#E0E4DD] bg-white px-3 py-2.5 text-xs"><option value="all">All check statuses</option>{RESEARCH_STATES.map(s => <option key={s} value={s}>{RESEARCH_META[s].label}</option>)}</select>
        <button onClick={download} disabled={!live.data} aria-label="Download filtered directory" title="Download this view" className="rounded-xl border border-[#E0E4DD] bg-white p-2.5"><Download className="h-4 w-4" /></button></div>}
    </header>
    {!isMap && <LiveSummary data={live.data} rows={scopeRows} removed={removed} scope={location} stale={live.stale} refreshing={live.isFetching} onRefresh={() => void live.refetch()} />}
    {live.data ? <>
      {view === 'directory' && <OfficeList key={`${search}-${status}-${location}`} rows={filtered} />}
      {view === 'map' && <PracticeMap practices={filtered} centerLat={area.center_lat} centerLon={area.center_lon} syncedAt={live.data.fetchedAt} refreshing={live.isFetching} stale={live.stale} removedCount={removed.length} onShowRemoved={() => changeParam('tab', 'directory')} />}
      {view === 'overview' && <><p className="text-xs text-[#747970]">Current listed records in this view. Confirmed includes offices with updated details.</p><ZipDirectoryTable rows={filtered} zips={zips} /></>}
      {view === 'tree' && <div className="space-y-2"><p className="mb-3 text-xs text-[#747970]">Existing group assignments, with live directory membership. Office checks do not establish ownership.</p>{[...groups].sort((a,b) => b[1].length - a[1].length).map(([key, rows]) => <details key={key} className="rounded-xl border border-[#E8E5DE] bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-[#253C34]">{key === 'unassigned' ? 'No group assigned' : formatNetworkId(key)} <span className="ml-2 font-normal text-[#747970]">{rows.length} listed</span></summary><div className="mt-3"><OfficeList rows={rows} /></div></details>)}</div>}
      {!isMap && <details className="rounded-xl border border-[#E8E5DE] bg-white px-4 py-3"><summary className="cursor-pointer text-xs text-[#747970]">Removed records · {removed.length.toLocaleString()}</summary><p className="my-3 text-xs text-[#747970]">Excluded from the directory and all map dots. Search above also filters this history.</p><OfficeList key={`removed-${search}`} rows={removed.filter(matches).sort((a,b) => (b.web_check?.checked_at ?? '').localeCompare(a.web_check?.checked_at ?? ''))} removed /></details>}
    </> : <p role="status" className="rounded-xl border border-[#E8E5DE] bg-white p-10 text-center text-sm text-[#747970]">{live.isError ? 'Directory unavailable. Use the refresh button to retry; no counts are being guessed.' : 'Loading current practices and validator results…'}</p>}
  </main>
}
export function DirectoryWorkspace() { return <Suspense fallback={<p className="p-8">Loading directory…</p>}><Workspace /></Suspense> }
