'use client'
import Link from 'next/link'
import { ArrowUpRight, Search, MapPin, ClipboardCheck } from 'lucide-react'
import { useLiveDirectory } from '@/lib/hooks/use-live-directory'
import { displayName } from '@/lib/census/display-name'
import { researchState } from '@/lib/directory/live-directory'
import { removalReasonLabel } from '@/lib/directory/web-checks'
import { LiveSummary, ResearchBadge } from './live-summary'

export function HomeWorkspace() {
  const live = useLiveDirectory()
  const activity = [...(live.data?.visible ?? []), ...(live.data?.removed ?? [])].filter(p => p.web_check).sort((a,b) => (b.web_check?.checked_at ?? '').localeCompare(a.web_check?.checked_at ?? '')).slice(0, 8)
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-7 sm:py-10">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[11px] font-medium uppercase tracking-[.2em] text-[#7A857D]">Chicagoland / practice intelligence</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#202824] sm:text-4xl">A clearer view of the directory.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#747970]">Current listings, the latest office checks, and the evidence behind them. One directory across every view.</p></div><Link href="/directory" className="inline-flex items-center gap-2 rounded-xl bg-[#253C34] px-4 py-3 text-sm font-medium text-white">Explore directory <ArrowUpRight className="h-4 w-4" /></Link></header>
    <LiveSummary data={live.data} stale={live.stale} refreshing={live.isFetching} onRefresh={() => void live.refetch()} />
    <div className="grid gap-3 sm:grid-cols-3">{[
      { href: '/directory', title: 'Find a practice', body: 'Search names, addresses and ZIPs. Open the check behind any record.', icon: Search },
      { href: '/directory?tab=map', title: 'Explore the map', body: 'See where listed practices are, colored by their latest office check.', icon: MapPin },
      { href: '/office-census', title: 'Follow the census', body: 'See what has been checked in each ZIP and what still needs an answer.', icon: ClipboardCheck },
    ].map(c => <Link key={c.href} href={c.href} className="group rounded-2xl border border-[#E8E5DE] bg-white p-5 transition-colors hover:border-[#95A89A]"><div className="flex items-center justify-between"><c.icon className="h-5 w-5 text-[#6D8876]" /><ArrowUpRight className="h-4 w-4 text-[#A0A69B] group-hover:text-[#253C34]" /></div><h2 className="mt-5 text-sm font-semibold text-[#253C34]">{c.title}</h2><p className="mt-2 text-xs leading-5 text-[#747970]">{c.body}</p></Link>)}</div>
    <section className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white"><div className="flex items-center justify-between border-b border-[#EFF1EB] px-5 py-4"><h2 className="text-sm font-semibold text-[#253C34]">Latest office checks</h2><Link href="/office-census" className="text-xs text-[#747970] hover:underline">View census</Link></div><div className="divide-y divide-[#EFF1EB]">{activity.map(p => <Link key={p.location_id} href={`/practice/${encodeURIComponent(p.location_id!)}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-[#FAFBF8]"><div><p className="text-sm font-medium text-[#253C34]">{displayName(p)}</p><p className="mt-0.5 text-xs text-[#85897F]">{p.city} · {p.zip}</p></div><div className="text-right">{p.web_check?.effect === 'removed' ? <span className="text-xs text-[#9A4646]">Removed · {removalReasonLabel(p.web_check.reason)}</span> : <ResearchBadge state={researchState(p)} />}<p className="mt-1 text-[11px] text-[#85897F]">{new Date(p.web_check!.checked_at).toLocaleString()}</p></div></Link>)}</div>{!activity.length && <p className="p-5 text-sm text-[#747970]">{live.data ? 'No validator checks on file yet.' : 'Waiting for live results…'}</p>}</section>
  </main>
}
