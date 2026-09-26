'use client'
import { RefreshCw } from 'lucide-react'
import { RESEARCH_META, RESEARCH_STATES, summarizeDirectory, type DirectorySnapshot, type ResearchState } from '@/lib/directory/live-directory'
import type { LiveOffice as Practice } from '@/lib/directory/live-directory'

export function ResearchBadge({ state }: { state: ResearchState }) {
  const m = RESEARCH_META[state]
  return <span title={m.description} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium" style={{ color: m.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}</span>
}
export function LiveSummary({ data, stale, refreshing, onRefresh, rows, removed, scope = 'Chicagoland' }: {
  data?: DirectorySnapshot; stale: boolean; refreshing: boolean; onRefresh: () => void
  rows?: Practice[]; removed?: Practice[]; scope?: string
}) {
  const visible = rows ?? data?.visible ?? []
  const excluded = removed ?? data?.removed ?? []
  const counts = summarizeDirectory(visible)
  return <section aria-label="Live directory summary" className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div><p className="text-[11px] font-medium uppercase tracking-[.14em] text-[#777B79]">{scope} · directory</p>
        <p className="mt-1 flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight tabular-nums text-[#202824]">{data ? visible.length.toLocaleString() : '—'}</strong><span className="text-sm text-[#6B6B60]">listed practices</span></p></div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {RESEARCH_STATES.map(s => <div key={s} className="flex items-center gap-2"><ResearchBadge state={s} /><span className="text-sm font-semibold tabular-nums text-[#202824]">{data ? counts[s].toLocaleString() : '—'}</span></div>)}
      </div>
    </div>
    <div aria-label="Breakdown of practices currently listed" className="flex h-1 w-full bg-[#EFF1EF]">
      {RESEARCH_STATES.map(s => <div key={s} style={{ width: `${visible.length ? counts[s] / visible.length * 100 : 0}%`, backgroundColor: RESEARCH_META[s].color }} />)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs text-[#747970]">
      <details className="max-w-2xl"><summary className="cursor-pointer hover:text-[#202824]">What these statuses mean</summary>
        <div className="space-y-2 py-3 leading-relaxed">
          <p>These four groups add up to the current directory. Listed does not mean confirmed. Statuses describe the office validator, not ownership or staffing research.</p>
          {RESEARCH_STATES.map(s => <p key={s}><strong>{RESEARCH_META[s].label}:</strong> {RESEARCH_META[s].description}</p>)}
          <p>{data ? excluded.length.toLocaleString() : '—'} records removed by the validator are excluded from this total and the map. Reasons include duplicates, moves, specialists and non-office addresses, as well as closures.</p>
          <p>The view refreshes every 15 seconds while open and when you return to the tab. It does not establish that every office in a ZIP has been discovered.</p>
        </div>
      </details>
      <div className="flex items-center gap-2" role="status">
        <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-amber-500' : data ? 'bg-emerald-600' : 'bg-slate-300'}`} />
        <span>{stale ? 'Refresh delayed · showing last saved view' : data ? `Auto-refresh · synced ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : 'Connecting to the live directory…'}</span>
        <button onClick={onRefresh} disabled={refreshing} aria-label="Refresh directory" className="rounded-md p-1.5 hover:bg-[#F4F5F1] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /></button>
      </div>
    </div>
  </section>
}
