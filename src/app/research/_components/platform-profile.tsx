'use client'

import { useState, useEffect, useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Deal } from '@/lib/types'

interface PlatformProfileProps {
  platforms: string[]
}

export function PlatformProfile({ platforms }: PlatformProfileProps) {
  const [selected, setSelected] = useState(platforms[0] ?? '')
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    supabase
      .from('deals')
      .select('*')
      .eq('platform_company', selected)
      .order('deal_date', { ascending: false })
      .then(({ data }) => {
        setDeals((data ?? []) as Deal[])
        setLoading(false)
      })
  }, [selected, supabase])

  const sponsor = useMemo(() => {
    const s = deals.find((d) => d.pe_sponsor)?.pe_sponsor
    return s ?? 'Unknown'
  }, [deals])

  // Timeline scatter by state
  const timelineData = useMemo(() => {
    return deals
      .filter((d) => d.deal_date)
      .map((d) => ({
        date: d.deal_date!,
        state: d.target_state ?? 'Unknown',
        target: d.target_name ?? '',
        type: d.deal_type ?? 'other',
      }))
  }, [deals])

  const uniqueStates = useMemo(
    () => Array.from(new Set(timelineData.map((d) => d.state))),
    [timelineData]
  )

  // Generate a color for each state
  const STATE_COLORS = useMemo(() => {
    const palette = [
      '#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#06B6D4',
      '#EF4444', '#F59E0B', '#64748B', '#7C4DFF', '#E91E63',
      '#009688', '#FF5722', '#3F51B5', '#8BC34A', '#795548',
    ]
    const map: Record<string, string> = {}
    uniqueStates.forEach((s, i) => {
      map[s] = palette[i % palette.length]
    })
    return map
  }, [uniqueStates])

  if (platforms.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
        No platform data available.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selector */}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-md border border-[#1E293B] bg-[#0F1629] text-[#F8FAFC] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] min-w-[300px]"
      >
        {platforms.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="flex items-center gap-2 text-[#7eb8e0] text-sm">
          <div className="h-4 w-4 border-2 border-[#7eb8e0] border-t-transparent rounded-full animate-spin" />
          Loading deals...
        </div>
      ) : (
        <>
          {/* KPI */}
          <KpiCard
            icon={<Building2 className="h-4 w-4" />}
            label={`${selected} (${sponsor})`}
            value={deals.length.toLocaleString()}
            suffix="total deals"
          />

          {/* Timeline scatter by state */}
          {timelineData.length > 0 && (
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
              <h3 className="text-sm font-medium text-[#F8FAFC] mb-3">Deal Timeline by State</h3>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                {uniqueStates.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STATE_COLORS[s] }}
                    />
                    {s}
                  </span>
                ))}
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[600px] h-[300px] relative border border-[#1E293B] rounded">
                  {(() => {
                    const dates = timelineData.map((d) => new Date(d.date).getTime())
                    const minDate = Math.min(...dates)
                    const maxDate = Math.max(...dates)
                    const range = maxDate - minDate || 1

                    return timelineData.map((d, i) => {
                      const x = ((new Date(d.date).getTime() - minDate) / range) * 90 + 5
                      const yIndex = uniqueStates.indexOf(d.state)
                      const y =
                        uniqueStates.length > 1
                          ? (yIndex / (uniqueStates.length - 1)) * 80 + 10
                          : 50
                      return (
                        <div
                          key={i}
                          className="absolute w-3 h-3 rounded-full cursor-pointer hover:scale-150 transition-transform"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            backgroundColor: STATE_COLORS[d.state],
                          }}
                          title={`${d.date} | ${d.state} | ${d.target} | ${d.type}`}
                        />
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* All deals table */}
          {deals.length > 0 && (
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E293B]">
                <h3 className="text-sm font-medium text-[#F8FAFC]">All Deals</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1E293B] text-[#94A3B8]">
                      <th className="text-left px-4 py-2 font-medium text-xs">Date</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">Target</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">State</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">Type</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">Specialty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((d, idx) => (
                      <tr
                        key={d.id ?? idx}
                        className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/20"
                      >
                        <td className="px-4 py-2 text-[#94A3B8] font-mono text-xs">
                          {d.deal_date ?? '--'}
                        </td>
                        <td className="px-4 py-2 text-[#F8FAFC]">{d.target_name ?? '--'}</td>
                        <td className="px-4 py-2 text-[#94A3B8] font-mono">
                          {d.target_state ?? '--'}
                        </td>
                        <td className="px-4 py-2 text-[#94A3B8]">{d.deal_type ?? '--'}</td>
                        <td className="px-4 py-2 text-[#94A3B8]">{d.specialty ?? '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
