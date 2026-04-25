'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { PipelineEvent } from '@/lib/types'

type HealthState = 'healthy' | 'stale' | 'failing' | 'unknown'

interface SourceHealth {
  source: string
  lastSuccess: PipelineEvent | null
  lastFailure: PipelineEvent | null
  latest: PipelineEvent | null
  state: HealthState
  hoursSinceSuccess: number | null
}

// 8 days = weekly cron (7 days) + 1 day grace.
// 30 days = stale threshold; beyond that we treat the scraper as failing.
const HEALTHY_HOURS = 8 * 24
const STALE_HOURS = 30 * 24

function hoursBetween(iso: string, now: number): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (now - t) / (1000 * 60 * 60)
}

function formatRelative(iso: string | undefined, now: number): string {
  if (!iso) return '—'
  const h = hoursBetween(iso, now)
  if (!Number.isFinite(h) || h < 0) return iso.slice(0, 16).replace('T', ' ')
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`
  if (h < 48) return `${Math.round(h)} hr ago`
  return `${Math.round(h / 24)} d ago`
}

function classifySource(
  lastSuccess: PipelineEvent | null,
  latest: PipelineEvent | null,
  now: number,
): { state: HealthState; hoursSinceSuccess: number | null } {
  if (!lastSuccess && !latest) return { state: 'unknown', hoursSinceSuccess: null }
  const hoursSinceSuccess = lastSuccess ? hoursBetween(lastSuccess.timestamp, now) : null
  const latestIsFailure = latest?.status === 'error'

  if (hoursSinceSuccess === null) {
    return { state: 'failing', hoursSinceSuccess: null }
  }
  if (latestIsFailure && hoursSinceSuccess > 24) {
    return { state: 'failing', hoursSinceSuccess }
  }
  if (hoursSinceSuccess > STALE_HOURS) {
    return { state: 'failing', hoursSinceSuccess }
  }
  if (hoursSinceSuccess > HEALTHY_HOURS) {
    return { state: 'stale', hoursSinceSuccess }
  }
  return { state: 'healthy', hoursSinceSuccess }
}

function StateBadge({ state }: { state: HealthState }) {
  const map: Record<HealthState, { label: string; bg: string; text: string; Icon: typeof CheckCircle2 }> = {
    healthy: { label: 'Healthy', bg: '#E8F5EE', text: '#2D8B4E', Icon: CheckCircle2 },
    stale: { label: 'Stale', bg: '#FBF1DC', text: '#A8740B', Icon: Clock },
    failing: { label: 'Failing', bg: '#FBE7E7', text: '#C23B3B', Icon: XCircle },
    unknown: { label: 'No data', bg: '#F0F0EB', text: '#707064', Icon: AlertTriangle },
  }
  const { label, bg, text, Icon } = map[state]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: bg, color: text }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// Order matches the weekly-refresh pipeline so the panel reads top-to-bottom in run order.
const SOURCE_ORDER = [
  'pesp_scraper',
  'gdn_scraper',
  'pitchbook_importer',
  'adso_location_scraper',
  'ada_hpi_downloader',
  'ada_hpi_importer',
  'dso_classifier',
  'merge_and_score',
  'sync_to_supabase',
]

function compareSources(a: string, b: string): number {
  const ai = SOURCE_ORDER.indexOf(a)
  const bi = SOURCE_ORDER.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

function prettyName(source: string): string {
  return source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ScraperHealthPanel() {
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    // Pull a window large enough to find the last successful run even when
    // recent events are dominated by failures. 500 covers ~3 months of weekly
    // runs across 9 sources.
    supabase
      .from('pipeline_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) {
          setTableMissing(true)
          setEvents([])
        } else {
          setEvents((data ?? []) as PipelineEvent[])
        }
        setLoading(false)
      })
  }, [supabase])

  const now = useMemo(() => Date.now(), [events])

  const healthBySource: SourceHealth[] = useMemo(() => {
    if (events.length === 0) return []
    const lastSuccess: Record<string, PipelineEvent> = {}
    const lastFailure: Record<string, PipelineEvent> = {}
    const latest: Record<string, PipelineEvent> = {}

    for (const ev of events) {
      const isSuccess = ev.status === 'success'
      const isFailure = ev.status === 'error'
      if (!latest[ev.source] || ev.timestamp > latest[ev.source].timestamp) {
        latest[ev.source] = ev
      }
      if (isSuccess && (!lastSuccess[ev.source] || ev.timestamp > lastSuccess[ev.source].timestamp)) {
        lastSuccess[ev.source] = ev
      }
      if (isFailure && (!lastFailure[ev.source] || ev.timestamp > lastFailure[ev.source].timestamp)) {
        lastFailure[ev.source] = ev
      }
    }

    const sources = Array.from(
      new Set([...Object.keys(latest), ...Object.keys(lastSuccess), ...Object.keys(lastFailure)]),
    ).sort(compareSources)

    return sources.map((source) => {
      const ls = lastSuccess[source] ?? null
      const lf = lastFailure[source] ?? null
      const lt = latest[source] ?? null
      const { state, hoursSinceSuccess } = classifySource(ls, lt, now)
      return { source, lastSuccess: ls, lastFailure: lf, latest: lt, state, hoursSinceSuccess }
    })
  }, [events, now])

  const summary = useMemo(() => {
    const counts = { healthy: 0, stale: 0, failing: 0, unknown: 0 }
    for (const row of healthBySource) counts[row.state] += 1
    return counts
  }, [healthBySource])

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 animate-pulse">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-[#E8E5DE]" />
          ))}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-sm text-[#6B6B60]">
        <p className="font-semibold text-[#1A1A1A]">pipeline_events table not available in Supabase.</p>
        <p className="mt-1">
          Run <code className="rounded bg-[#F5F5F0] px-1 py-0.5 font-mono text-xs">python3 scrapers/sync_to_supabase.py</code> to bootstrap it.
        </p>
      </div>
    )
  }

  if (healthBySource.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-sm text-[#6B6B60]">
        No scraper runs recorded yet. The first weekly refresh will populate this panel.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Health summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">Healthy</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#2D8B4E]">{summary.healthy}</p>
        </div>
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">Stale</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#A8740B]">{summary.stale}</p>
        </div>
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">Failing</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#C23B3B]">{summary.failing}</p>
        </div>
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">No data</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#707064]">{summary.unknown}</p>
        </div>
      </div>

      {/* Per-source rows */}
      <div className="overflow-hidden rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF]">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAF7]">
            <tr className="border-b-2 border-[#E8E5DE] text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-left">Last successful run</th>
              <th className="px-4 py-2 text-left">Last failure</th>
              <th className="px-4 py-2 text-right">New rows</th>
              <th className="px-4 py-2 text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {healthBySource.map((row, idx) => {
              const newRecords = row.lastSuccess?.details?.new_records
              const duration = row.lastSuccess?.details?.duration_seconds
              const failureNewerThanSuccess =
                row.lastFailure &&
                (!row.lastSuccess || row.lastFailure.timestamp > row.lastSuccess.timestamp)
              return (
                <tr
                  key={row.source}
                  className={idx % 2 === 0 ? 'bg-[#FFFFFF]' : 'bg-[#FAFAF7]'}
                >
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{prettyName(row.source)}</td>
                  <td className="px-4 py-3">
                    <StateBadge state={row.state} />
                  </td>
                  <td className="px-4 py-3 text-[#3D3D35]">
                    {row.lastSuccess ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">
                          {formatRelative(row.lastSuccess.timestamp, now)}
                        </span>
                        <span className="font-mono text-[10px] text-[#707064]">
                          {row.lastSuccess.timestamp.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#9C9C90]">never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#3D3D35]">
                    {row.lastFailure ? (
                      <div className="flex flex-col">
                        <span
                          className="font-mono text-xs"
                          style={{ color: failureNewerThanSuccess ? '#C23B3B' : '#707064' }}
                        >
                          {formatRelative(row.lastFailure.timestamp, now)}
                          {failureNewerThanSuccess ? ' (newer than success)' : ''}
                        </span>
                        <span
                          className="font-mono text-[10px]"
                          title={row.lastFailure.summary}
                          style={{ color: '#9C9C90' }}
                        >
                          {row.lastFailure.summary.slice(0, 60)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#9C9C90]">none</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#3D3D35]">
                    {newRecords ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#3D3D35]">
                    {duration ? `${duration}s` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
