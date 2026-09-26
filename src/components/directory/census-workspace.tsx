'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLiveDirectory } from '@/lib/hooks/use-live-directory'
import { LiveSummary } from './live-summary'
import { OfficeList, safeWebsite } from './office-list'
import { ZipDirectoryTable } from './directory-workspace'
import { researchState, RESEARCH_META } from '@/lib/directory/live-directory'
import { removalReasonLabel } from '@/lib/directory/web-checks'
import type { OfficeCensusCandidate } from '@/lib/supabase/queries/office-census'
import type { LiveOffice as Practice } from '@/lib/directory/live-directory'

function SourceEvidence({ zip, directory }: { zip: string; directory: Practice[] }) {
  const [open, setOpen] = useState(false)
  const query = useQuery<{ candidates: OfficeCensusCandidate[]; publishedAt: string | null }>({
    queryKey: ['census-evidence', zip], enabled: open, staleTime: 15_000, refetchInterval: open ? 30_000 : false, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => { const r = await fetch(`/api/census-evidence?zip=${zip}`, { signal, cache: 'no-store' }); if (!r.ok) throw new Error('Source evidence unavailable'); return r.json() },
  })
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="rounded-xl border border-[#E8E5DE] bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-[#253C34]">Building research & additional source leads</summary>
    <p className="my-3 text-xs leading-5 text-[#747970]">These are research candidates, not additional confirmed offices. The published research snapshot is separate from the live validator results above.{query.data?.publishedAt && ` Last published ${new Date(query.data.publishedAt).toLocaleString()}.`}</p>
    {query.isError && <p role="alert" className="text-xs text-amber-700">Source evidence could not refresh. Any displayed evidence is from the last successful load.</p>}
    {query.isPending && open && <p className="text-xs text-[#747970]">Loading source evidence…</p>}
    <div className="divide-y divide-[#E8E5DE]">{query.data?.candidates.map(c => {
      const p = directory.find(p => p.location_id === c.location_id)
      const status = p?.web_check?.effect === 'removed' ? `Removed · ${removalReasonLabel(p.web_check.reason)}` : p ? RESEARCH_META[researchState(p)].label : 'Source candidate · not in the live directory'
      const website = safeWebsite(c.website)
      return <details key={c.candidate_id} className="py-3"><summary className="cursor-pointer text-sm text-[#253C34]">{c.name || 'Unnamed source record'}<span className="ml-2 text-xs font-normal text-[#747970]">{status}</span></summary><div className="mt-2 space-y-2 text-xs text-[#747970]"><p>{c.address}{c.suite ? ` · Suite ${c.suite}` : ''}</p><p>Source snapshot: {c.queue_state.toLowerCase().replaceAll('_', ' ')}</p>{website && <a className="block text-[#3975CE] underline" href={website} target="_blank" rel="noopener noreferrer">Source website</a>}{p?.location_id && <Link className="block underline" href={`/practice/${p.location_id}`}>Open practice record</Link>}<details><summary className="cursor-pointer">Source addresses and research notes</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#FAFBF8] p-3 font-sans">{JSON.stringify({ sources: c.source_refs.records, flags: c.flags, decision: c.decision, prior_evidence: c.prior_evidence }, null, 2)}</pre></details></div></details>
    })}</div>
  </details>
}
function Census() {
  const live = useLiveDirectory(); const params = useSearchParams()
  const rawZip = params.get('zip'); const zip = rawZip && /^\d{5}$/.test(rawZip) ? rawZip : null
  const [search, setSearch] = useState('')
  const rows = (live.data?.visible ?? []).filter(p => !zip || p.zip === zip)
  const removed = (live.data?.removed ?? []).filter(p => !zip || p.zip === zip)
  const zips = (live.data?.zips ?? []).filter(z => !search || `${z.zip} ${z.city}`.toLowerCase().includes(search.toLowerCase()))
  const all = [...rows, ...removed]
  const checked = all.filter(p => p.web_check).length
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-7">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[.18em] text-[#8A9189]">Office research</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202824]">{zip ? `Census · ${zip}` : 'Office census'}</h1><p className="mt-2 text-sm text-[#747970]">Follow the checks behind the current directory, ZIP by ZIP.</p></div>{zip && <Link href="/office-census" className="text-sm text-[#3975CE] hover:underline">All ZIPs</Link>}</header>
    <LiveSummary data={live.data} rows={rows} removed={removed} scope={zip || 'Chicagoland'} stale={live.stale} refreshing={live.isFetching} onRefresh={() => void live.refetch()} />
    {live.data ? <>
      <details className="rounded-xl border border-[#E8E5DE] bg-white px-4 py-3 text-xs text-[#747970]"><summary className="cursor-pointer">Validator coverage · {checked.toLocaleString()} checked / {all.length.toLocaleString()} baseline records</summary><div className="mt-3 space-y-2"><div role="progressbar" aria-label="Baseline records checked by the validator" aria-valuemin={0} aria-valuemax={all.length || 1} aria-valuenow={checked} className="h-1.5 overflow-hidden rounded-full bg-[#EFF1EB]"><div className="h-full bg-[#6D8876]" style={{ width: `${all.length ? checked / all.length * 100 : 0}%` }} /></div><p>Includes {removed.length.toLocaleString()} removed records. A completed check can still be unresolved. This measures research of existing records, not discovery of every office.</p></div></details>
      {zip ? <><div className="flex items-center justify-between"><h2 className="text-sm font-medium text-[#253C34]">Currently listed in this ZIP</h2><Link className="text-xs text-[#3975CE]" href={`/directory?tab=map&zip=${zip}`}>See on map</Link></div><OfficeList key={zip} rows={rows} /><details className="rounded-xl border border-[#E8E5DE] bg-white p-4"><summary className="cursor-pointer text-xs text-[#747970]">Removed records · {removed.length}</summary><div className="mt-3"><OfficeList rows={removed} removed /></div></details><SourceEvidence zip={zip} directory={all} /></> : <><label className="block"><span className="sr-only">Find a ZIP or city</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a ZIP or city" className="w-full max-w-md rounded-xl border border-[#E0E4DD] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#6D8876]" /></label><p className="text-xs text-[#747970]">Confirmed includes offices with corrected details. Click a ZIP for records and research sources.</p><ZipDirectoryTable rows={rows} zips={zips} /></>}
    </> : <p className="p-8 text-center text-sm text-[#747970]">{live.isError ? 'The census could not load live directory results. Refresh to retry.' : 'Loading live office checks…'}</p>}
  </main>
}
export function CensusWorkspace() { return <Suspense fallback={<p className="p-8">Loading census…</p>}><Census /></Suspense> }
