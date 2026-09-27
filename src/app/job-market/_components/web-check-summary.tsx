'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { displayName } from '@/lib/census/display-name'
import {
  EVIDENCE_KIND_LABELS,
  evidenceHost,
  removalReasonLabel,
} from '@/lib/directory/web-checks'
import { formatDate } from '@/lib/utils/formatting'
import type { Practice } from '@/lib/types'

interface WebCheckSummaryProps {
  /** Rows the directory shows (web checks already applied). */
  practices: Practice[]
  /** Rows a web check removed from the list and map. */
  removed: Practice[]
}

/**
 * Directory web-check coverage for the current area, plus the rows it removed
 * with their evidence — nothing disappears without a visible reason.
 */
export function WebCheckSummary({ practices, removed }: WebCheckSummaryProps) {
  const [open, setOpen] = useState(false)
  const counts = useMemo(() => {
    const checked = practices.filter((p) => p.web_check).length + removed.length
    const corrected = practices.filter((p) => p.web_check?.effect === 'open_corrected').length
    const confirmed = practices.filter((p) => p.web_check?.effect === 'open_verified').length + corrected
    return { checked, corrected, confirmed, total: practices.length + removed.length }
  }, [practices, removed])

  if (counts.checked === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-[#3D3D35]">
          <span className="font-semibold text-[#1A1A1A]">Web check:</span>{' '}
          {counts.checked.toLocaleString()} of {counts.total.toLocaleString()} offices in this area checked so far
          {' · '}
          <span className="text-[#2D8B4E]">{counts.confirmed.toLocaleString()} confirmed open</span>
          {counts.corrected > 0 ? ` (${counts.corrected.toLocaleString()} with updated details)` : ''}
          {' · '}
          <span className="text-[#C23B3B]">{removed.length.toLocaleString()} removed from the list and map</span>
        </p>
        {removed.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#B8860B] hover:text-[#8B6508]"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {open ? 'Hide removed' : `Show removed (${removed.length})`}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] leading-4 text-[#6B6B60]">
            Removed rows stay in the database and in the ownership figures; the web check only takes
            them off this list and map. A row is never removed just because a search found nothing.
          </p>
          <ul className="divide-y divide-[#F0EEE8]">
            {removed.map((p) => {
              const c = p.web_check
              const ev = c?.evidence?.[0]
              const name = c?.as_seen?.name || displayName(p)
              return (
                <li key={p.location_id ?? p.npi} className="py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[13px] font-medium text-[#1A1A1A]">{name}</span>
                    <span className="text-[11px] text-[#6B6B60]">
                      {[p.address, p.city, (p.zip ?? '').toString().slice(0, 5)].filter(Boolean).join(', ')}
                    </span>
                    <span className="rounded-full bg-[rgba(194,59,59,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#C23B3B]">
                      {removalReasonLabel(c?.reason)}
                    </span>
                    {c?.checked_at ? (
                      <span className="text-[10px] text-[#8F8E82]">checked {formatDate(c.checked_at)}</span>
                    ) : null}
                  </div>
                  {c?.note ? <p className="mt-0.5 text-[11px] leading-4 text-[#3D3D35]">{c.note}</p> : null}
                  {ev ? (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex max-w-full items-start gap-1 text-[11px] leading-4 text-[#8B6508] hover:underline"
                    >
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="break-words">
                        {EVIDENCE_KIND_LABELS[ev.kind] ?? 'Source'} · {evidenceHost(ev.url)}
                        {ev.quote ? ` — “${ev.quote}”` : ''}
                      </span>
                    </a>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
