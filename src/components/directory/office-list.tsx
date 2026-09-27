'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { LiveOffice as Practice } from '@/lib/directory/live-directory'
import { displayName } from '@/lib/census/display-name'
import { researchState } from '@/lib/directory/live-directory'
import { removalReasonLabel } from '@/lib/directory/web-checks'
import { ResearchBadge } from './live-summary'

export function safeWebsite(value?: string | null) {
  if (!value?.trim()) return null
  try { const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : null } catch { return null }
}
export function OfficeList({ rows, removed = false }: { rows: Practice[]; removed?: boolean }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / 40))
  const activePage = Math.min(page, pages)
  return <div className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white">
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="border-b border-[#E8E5DE] bg-[#FAFBF8] text-[11px] uppercase tracking-wider text-[#777B79]"><tr><th className="px-4 py-3 font-medium">Practice / location</th><th className="px-4 py-3 font-medium">{removed ? 'Reason removed' : 'Office check'}</th><th className="px-4 py-3 font-medium">Contact on file</th><th className="px-4 py-3 font-medium">Evidence</th></tr></thead>
      <tbody className="divide-y divide-[#F0F1ED]">{rows.slice((activePage - 1) * 40, activePage * 40).map(p => {
        const website = safeWebsite(p.website)
        const evidence = p.web_check?.evidence ?? []
        return <tr key={p.location_id ?? p.npi} className="align-top hover:bg-[#FAFBF8]">
          <td className="min-w-56 px-4 py-3"><Link href={`/practice/${encodeURIComponent(p.location_id ?? p.npi)}`} className="font-medium text-[#253C34] hover:underline">{displayName(p)}</Link><p className="mt-1 text-xs text-[#747970]">{p.address || 'Address not on file'}</p><p className="mt-0.5 text-xs text-[#747970]">{p.city} {p.zip}</p></td>
          <td className="px-4 py-3">{removed ? <span className="text-xs text-[#9A4646]">{removalReasonLabel(p.web_check?.reason)}</span> : <ResearchBadge state={researchState(p)} />}
            <p className="mt-1 text-[11px] text-[#85897F]">{p.web_check?.checked_at ? new Date(p.web_check.checked_at).toLocaleDateString() : 'Awaiting validator'}</p></td>
          <td className="min-w-36 px-4 py-3 text-xs"><p className="text-[#626B62]">{p.phone || 'No phone on file'}</p>{website ? <a href={website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[#3975CE] hover:underline">Website <ExternalLink className="h-3 w-3" /></a> : <p className="mt-1 text-[#85897F]">No website on file</p>}</td>
          <td className="max-w-sm px-4 py-3 text-xs text-[#626B62]">{p.web_check ? <details><summary className="cursor-pointer">View check</summary><div className="mt-2 space-y-2"><p>{p.web_check.note || 'See the sources supporting this check.'}</p>{evidence.map((e, i) => { const url = safeWebsite(e.url); return url ? <p key={`${e.url}-${i}`}><a href={url} target="_blank" rel="noopener noreferrer" className="text-[#3975CE] underline">{new URL(url).hostname.replace(/^www\./, '')}</a>{e.quote && <span className="mt-1 block">{e.quote}</span>}</p> : null })}</div></details> : <span className="text-[#85897F]">No validator result</span>}</td>
        </tr>
      })}</tbody>
    </table></div>
    {!rows.length && <p className="p-8 text-center text-sm text-[#747970]">No practices match this view.</p>}
    <div className="flex items-center justify-between border-t border-[#E8E5DE] px-4 py-3 text-xs text-[#747970]"><span>{rows.length.toLocaleString()} records · page {activePage} of {pages}</span><div className="flex gap-2"><button className="rounded-lg border px-3 py-1.5 disabled:opacity-35" disabled={activePage <= 1} onClick={() => setPage(activePage - 1)}>Previous</button><button className="rounded-lg border px-3 py-1.5 disabled:opacity-35" disabled={activePage >= pages} onClick={() => setPage(activePage + 1)}>Next</button></div></div>
  </div>
}
