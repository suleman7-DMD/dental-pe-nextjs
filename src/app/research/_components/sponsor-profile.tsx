'use client'

import { useState, useEffect, useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Deal } from '@/lib/types'

interface SponsorProfileProps {
  sponsors: string[]
}

export function SponsorProfile({ sponsors }: SponsorProfileProps) {
  const [selected, setSelected] = useState(sponsors[0] ?? '')
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    supabase
      .from('deals')
      .select('*')
      .eq('pe_sponsor', selected)
      .order('deal_date', { ascending: false })
      .then(({ data }) => {
        setDeals((data ?? []) as Deal[])
        setLoading(false)
      })
  }, [selected, supabase])

  // Platforms grouped
  const platforms = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of deals) {
      const plat = d.platform_company ?? 'Unknown'
      map[plat] = (map[plat] ?? 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => ({ platform, count }))
  }, [deals])

  // Recent activity
  const recent = useMemo(() => deals.slice(0, 10), [deals])

  // Timeline scatter data
  const timelineData = useMemo(() => {
    return deals
      .filter((d) => d.deal_date)
      .map((d) => ({
        date: d.deal_date!,
        platform: d.platform_company ?? 'Unknown',
        type: d.deal_type ?? 'other',
        target: d.target_name ?? '',
        state: d.target_state ?? '',
      }))
  }, [deals])

  // Group by deal_type for the color legend
  const dealTypes = useMemo(() => {
    return Array.from(new Set(timelineData.map((d) => d.type)))
  }, [timelineData])

  const TYPE_COLORS: Record<string, string> = {
    buyout: '#3B82F6',
    'add-on': '#22C55E',
    recapitalization: '#A855F7',
    growth: '#06B6D4',
    de_novo: '#F59E0B',
    partnership: '#F59E0B',
    other: '#64748B',
  }

  if (sponsors.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8]">
        No PE sponsor data available.
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
        {sponsors.map((s) => (
          <option key={s} value={s}>
            {s}
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
          <KpiCard icon={<Building2 className="h-4 w-4" />} label={selected} value={deals.length.toLocaleString()} suffix="total deals" />

          {/* Timeline */}
          {timelineData.length > 0 && (
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
              <h3 className="text-sm font-medium text-[#F8FAFC] mb-3">Deal Timeline</h3>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                {dealTypes.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[t] ?? '#64748B' }}
                    />
                    {t}
                  </span>
                ))}
              </div>

              {/* Simple scatter */}
              <div className="overflow-x-auto">
                <div className="min-w-[600px] h-[300px] relative border border-[#1E293B] rounded">
                  {/* Y-axis labels (platforms) */}
                  {(() => {
                    const uniquePlatforms = Array.from(
                      new Set(timelineData.map((d) => d.platform))
                    ).slice(0, 15)
                    const dates = timelineData.map((d) => new Date(d.date).getTime())
                    const minDate = Math.min(...dates)
                    const maxDate = Math.max(...dates)
                    const range = maxDate - minDate || 1

                    return timelineData.map((d, i) => {
                      const x = ((new Date(d.date).getTime() - minDate) / range) * 90 + 5
                      const yIndex = uniquePlatforms.indexOf(d.platform)
                      const y =
                        uniquePlatforms.length > 1
                          ? (yIndex / (uniquePlatforms.length - 1)) * 80 + 10
                          : 50
                      return (
                        <div
                          key={i}
                          className="absolute w-3 h-3 rounded-full cursor-pointer hover:scale-150 transition-transform"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            backgroundColor: TYPE_COLORS[d.type] ?? '#64748B',
                          }}
                          title={`${d.date} | ${d.platform} | ${d.target} (${d.state}) | ${d.type}`}
                        />
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Platforms table */}
          {platforms.length > 0 && (
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E293B]">
                <h3 className="text-sm font-medium text-[#F8FAFC]">Platforms</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E293B] text-[#94A3B8]">
                    <th className="text-left px-4 py-2 font-medium text-xs">Platform</th>
                    <th className="text-left px-4 py-2 font-medium text-xs">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => (
                    <tr
                      key={p.platform}
                      className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/20"
                    >
                      <td className="px-4 py-2 text-[#F8FAFC]">{p.platform}</td>
                      <td className="px-4 py-2 text-[#94A3B8] font-mono">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent activity */}
          {recent.length > 0 && (
            <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E293B]">
                <h3 className="text-sm font-medium text-[#F8FAFC]">Recent Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1E293B] text-[#94A3B8]">
                      <th className="text-left px-4 py-2 font-medium text-xs">Date</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">Platform</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">Target</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">State</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((d, idx) => (
                      <tr
                        key={d.id ?? idx}
                        className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/20"
                      >
                        <td className="px-4 py-2 text-[#94A3B8] font-mono text-xs">
                          {d.deal_date ?? '--'}
                        </td>
                        <td className="px-4 py-2 text-[#F8FAFC]">
                          {d.platform_company ?? '--'}
                        </td>
                        <td className="px-4 py-2 text-[#F8FAFC]">{d.target_name ?? '--'}</td>
                        <td className="px-4 py-2 text-[#94A3B8] font-mono">
                          {d.target_state ?? '--'}
                        </td>
                        <td className="px-4 py-2 text-[#94A3B8]">{d.deal_type ?? '--'}</td>
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
