'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { PipelineEvent } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PipelineLogViewer() {
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    // Try to fetch pipeline events from a pipeline_events table if it exists
    // Otherwise show a helpful message
    supabase
      .from('pipeline_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          // Table may not exist in Supabase yet
          console.warn('pipeline_events table not available:', error.message)
          setEvents([])
        } else {
          setEvents((data ?? []) as PipelineEvent[])
        }
        setLoading(false)
      })
  }, [supabase])

  // Last run summary by source
  const lastRuns = useMemo(() => {
    const map: Record<string, PipelineEvent> = {}
    for (const ev of events) {
      if (!map[ev.source] || ev.timestamp > map[ev.source].timestamp) {
        map[ev.source] = ev
      }
    }
    return map
  }, [events])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
      case 'error':
        return <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
      case 'info':
        return <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
      default:
        return <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 animate-pulse">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-[#E8E5DE]" />
          ))}
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60] text-sm">
        No pipeline events yet. Events will appear after the first automated refresh runs.
        Pipeline events are logged to pipeline_events.jsonl by each scraper.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Last-run summary cards */}
      {Object.keys(lastRuns).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(lastRuns)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([source, ev]) => {
              const ts = ev.timestamp.slice(0, 16).replace('T', ' ')
              const isSuccess = ev.status === 'success'
              const newRecords = ev.details?.new_records ?? 0
              const duration = ev.details?.duration_seconds ?? 0

              return (
                <div
                  key={source}
                  className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSuccess ? (
                      <span className="text-green-700 text-sm">OK</span>
                    ) : (
                      <span className="text-red-700 text-sm">ERR</span>
                    )}
                    <span className="text-xs font-medium text-[#1A1A1A]">
                      {source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[#1A1A1A]">
                    {newRecords ? `${newRecords} new` : 'No changes'}
                  </p>
                  <p className="text-xs text-[#6B6B60] mt-1">
                    {duration}s -- {ts}
                  </p>
                </div>
              )
            })}
        </div>
      )}

      {/* Event table */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#FFFFFF]">
              <tr className="border-b border-[#E8E5DE] text-[#6B6B60]">
                <th className="text-left px-4 py-2 font-medium text-xs">Time</th>
                <th className="text-left px-4 py-2 font-medium text-xs">Source</th>
                <th className="text-left px-4 py-2 font-medium text-xs">Status</th>
                <th className="text-left px-4 py-2 font-medium text-xs">Summary</th>
                <th className="text-left px-4 py-2 font-medium text-xs">New</th>
                <th className="text-left px-4 py-2 font-medium text-xs">Duration</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[#E8E5DE]/50 hover:bg-[#E8E5DE]/20"
                >
                  <td className="px-4 py-2 text-[#707064] font-mono text-xs whitespace-nowrap">
                    {ev.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2 text-[#1A1A1A] text-xs">{ev.source}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-[#6B6B60]">
                      {statusIcon(ev.status)} {ev.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[#3D3D35] text-xs max-w-[300px] truncate">
                    {ev.summary}
                  </td>
                  <td className="px-4 py-2 text-[#6B6B60] font-mono text-xs">
                    {ev.details?.new_records ?? '--'}
                  </td>
                  <td className="px-4 py-2 text-[#6B6B60] font-mono text-xs">
                    {ev.details?.duration_seconds
                      ? `${ev.details.duration_seconds}s`
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
