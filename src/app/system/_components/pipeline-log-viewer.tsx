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
        return <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
      case 'error':
        return <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
      case 'info':
        return <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
      default:
        return <span className="inline-block h-2 w-2 rounded-full bg-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-6 animate-pulse">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-[#1E2A3A]" />
          ))}
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-6 text-center text-[#8892A0] text-sm">
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
                  className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isSuccess ? (
                      <span className="text-green-400 text-sm">OK</span>
                    ) : (
                      <span className="text-red-400 text-sm">ERR</span>
                    )}
                    <span className="text-xs font-medium text-[#E8ECF1]">
                      {source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[#E8ECF1]">
                    {newRecords ? `${newRecords} new` : 'No changes'}
                  </p>
                  <p className="text-xs text-[#8892A0] mt-1">
                    {duration}s -- {ts}
                  </p>
                </div>
              )
            })}
        </div>
      )}

      {/* Event table */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#141922]">
              <tr className="border-b border-[#1E2A3A] text-[#8892A0]">
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
                  className="border-b border-[#1E2A3A]/50 hover:bg-[#1E2A3A]/20"
                >
                  <td className="px-4 py-2 text-[#8892A0] font-mono text-xs whitespace-nowrap">
                    {ev.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2 text-[#E8ECF1] text-xs">{ev.source}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-[#8892A0]">
                      {statusIcon(ev.status)} {ev.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[#8892A0] text-xs max-w-[300px] truncate">
                    {ev.summary}
                  </td>
                  <td className="px-4 py-2 text-[#8892A0] font-mono text-xs">
                    {ev.details?.new_records ?? '--'}
                  </td>
                  <td className="px-4 py-2 text-[#8892A0] font-mono text-xs">
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
