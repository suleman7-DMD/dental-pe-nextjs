'use client'

import { useState, useEffect, useMemo } from 'react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Deal } from '@/lib/types'

interface StateDeepDiveProps {
  states: string[]
}

export function StateDeepDive({ states }: StateDeepDiveProps) {
  const [selected, setSelected] = useState(states[0] ?? '')
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    supabase
      .from('deals')
      .select('*')
      .eq('target_state', selected)
      .order('deal_date', { ascending: false })
      .then(({ data }) => {
        setDeals((data ?? []) as Deal[])
        setLoading(false)
      })
  }, [selected, supabase])

  // Deals by quarter
  const quarterData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of deals) {
      if (!d.deal_date) continue
      const dt = new Date(d.deal_date)
      const q = Math.ceil((dt.getMonth() + 1) / 3)
      const key = `${dt.getFullYear()} Q${q}`
      map[key] = (map[key] ?? 0) + 1
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([quarter, count]) => ({ quarter, count }))
  }, [deals])

  const maxQuarterCount = useMemo(
    () => Math.max(...quarterData.map((q) => q.count), 1),
    [quarterData]
  )

  // Top 10 platforms
  const topPlatforms = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of deals) {
      const plat = d.platform_company ?? 'Unknown'
      map[plat] = (map[plat] ?? 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([platform, count]) => ({ platform, count }))
  }, [deals])

  const maxPlatformCount = useMemo(
    () => Math.max(...topPlatforms.map((p) => p.count), 1),
    [topPlatforms]
  )

  if (states.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-6 text-center text-[#8892A0]">
        No state data available.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selector */}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-md border border-[#1E2A3A] bg-[#141922] text-[#E8ECF1] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF] min-w-[200px]"
      >
        {states.map((s) => (
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
          <KpiCard
            icon="map"
            label={`${selected} Deals`}
            value={deals.length.toLocaleString()}
            suffix="total deals in state"
          />

          {/* Deals by quarter - bar chart */}
          {quarterData.length > 0 && (
            <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
              <h3 className="text-sm font-medium text-[#E8ECF1] mb-4">Deals by Quarter</h3>
              <div className="space-y-2">
                {quarterData.map((q) => (
                  <div key={q.quarter} className="flex items-center gap-3">
                    <span className="text-xs text-[#8892A0] w-20 font-mono shrink-0">
                      {q.quarter}
                    </span>
                    <div className="flex-1 h-6 bg-[#1E2A3A]/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-[#0066FF] rounded transition-all"
                        style={{ width: `${(q.count / maxQuarterCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#E8ECF1] font-mono w-8 text-right">
                      {q.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 10 platforms - horizontal bar chart */}
          {topPlatforms.length > 0 && (
            <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
              <h3 className="text-sm font-medium text-[#E8ECF1] mb-4">
                Top 10 Platforms in {selected}
              </h3>
              <div className="space-y-2">
                {topPlatforms.map((p) => (
                  <div key={p.platform} className="flex items-center gap-3">
                    <span className="text-xs text-[#8892A0] w-40 truncate shrink-0" title={p.platform}>
                      {p.platform}
                    </span>
                    <div className="flex-1 h-6 bg-[#1E2A3A]/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-[#00C853] rounded transition-all"
                        style={{ width: `${(p.count / maxPlatformCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#E8ECF1] font-mono w-8 text-right">
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
