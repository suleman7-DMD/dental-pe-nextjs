import { ExternalLink } from 'lucide-react'
import {
  EVIDENCE_KIND_LABELS,
  WEB_CHECK_EFFECT_META,
  WEB_CHECK_SIGNAL_LABELS,
  evidenceHost,
  removalReasonLabel,
} from '@/lib/directory/web-checks'
import type { DirectoryWebCheck, WebCheckFields } from '@/lib/supabase/queries/directory-web-checks'
import { formatDate } from '@/lib/utils/formatting'

const FIELD_LABELS: [keyof WebCheckFields, string][] = [
  ['name', 'Name'],
  ['address', 'Address'],
  ['suite', 'Suite'],
  ['phone', 'Phone'],
  ['website', 'Website'],
  ['zip', 'ZIP'],
]

/**
 * The directory web check for one row: is it a current GP office as listed,
 * what was corrected, and the evidence behind it. Renders only from a
 * directory_web_checks record; says nothing about ownership.
 */
export function DirectoryWebCheckCard({ check }: { check: DirectoryWebCheck }) {
  const meta = WEB_CHECK_EFFECT_META[check.effect] ?? WEB_CHECK_EFFECT_META.needs_review
  const corrections = FIELD_LABELS.filter(([k]) => check.observed?.[k])
  return (
    <div className="rounded-md border p-3" style={{ borderColor: `${meta.color}40`, backgroundColor: meta.bg }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-semibold" style={{ color: meta.color }}>
          {check.effect === 'removed' ? `${meta.label}: ${removalReasonLabel(check.reason)}` : meta.label}
        </div>
        <span className="text-[10px] text-[#8F8E82]">Web check · {formatDate(check.checked_at)}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#3D3D35]">{meta.why}</p>
      {check.note ? <p className="mt-1 text-xs leading-5 text-[#3D3D35]">{check.note}</p> : null}

      {corrections.length > 0 ? (
        <dl className="mt-2 space-y-0.5 text-[11px] leading-4">
          {corrections.map(([k, label]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-16 shrink-0 text-[#6B6B60]">{label}</dt>
              <dd className="min-w-0 break-words text-[#1A1A1A]">
                {check.observed[k]}
                {check.as_seen?.[k] ? (
                  <span className="text-[#8F8E82]"> (registry: {check.as_seen[k]})</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {check.signals?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {check.signals.map((s) => (
            <span key={s} className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-0.5 text-[10px] text-[#3D3D35]">
              {WEB_CHECK_SIGNAL_LABELS[s] ?? s}
            </span>
          ))}
        </div>
      ) : null}

      {check.evidence?.length ? (
        <ul className="mt-2 space-y-1">
          {check.evidence.map((e) => (
            <li key={e.url}>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-start gap-1 text-[11px] leading-4 text-[#8B6508] hover:underline"
              >
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-words">
                  {EVIDENCE_KIND_LABELS[e.kind] ?? 'Source'} · {evidenceHost(e.url)}
                  {e.quote ? ` — “${e.quote}”` : ''}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
