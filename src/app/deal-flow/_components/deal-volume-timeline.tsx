'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { StackedBarChart } from '@/components/charts/stacked-bar-chart'
import { DEAL_TYPE_COLORS, formatDealType } from '@/lib/constants/deal-type-colors'
import type { Deal } from '@/lib/supabase/queries/deals'

interface DealVolumeTimelineProps {
  deals: Deal[]
}

export function DealVolumeTimeline({ deals }: DealVolumeTimelineProps) {
  const { chartData, series } = useMemo(() => {
    // Filter to deals with dates
    const withDates = deals.filter(d => d.deal_date)

    // Group by month and deal_type
    const monthMap = new Map<string, Record<string, number>>()
    const allTypes = new Set<string>()

    for (const d of withDates) {
      const monthStr = d.deal_date!.slice(0, 7) // "YYYY-MM"
      const type = d.deal_type ?? 'other'
      allTypes.add(type)

      if (!monthMap.has(monthStr)) {
        monthMap.set(monthStr, {})
      }
      const m = monthMap.get(monthStr)!
      m[type] = (m[type] ?? 0) + 1
    }

    // Sort months chronologically
    const months = [...monthMap.keys()].sort()

    // Build chart data with all types and rolling average
    const sortedTypes = [...allTypes].sort()
    const raw = months.map(month => {
      const counts = monthMap.get(month)!
      const row: Record<string, unknown> = { month }
      let total = 0
      for (const t of sortedTypes) {
        row[t] = counts[t] ?? 0
        total += counts[t] ?? 0
      }
      row._total = total
      return row
    })

    // Compute 6-month rolling average
    for (let i = 0; i < raw.length; i++) {
      const windowStart = Math.max(0, i - 5)
      let sum = 0
      let count = 0
      for (let j = windowStart; j <= i; j++) {
        sum += raw[j]._total as number
        count++
      }
      raw[i].rolling_avg = sum / count
    }

    // Build series config
    const seriesConfig = sortedTypes.map(t => ({
      key: t,
      label: formatDealType(t),
      color: DEAL_TYPE_COLORS[t] ?? '#64748B',
    }))

    return { chartData: raw, series: seriesConfig }
  }, [deals])

  return (
    <div>
      <SectionHeader
        title="Deal Volume Over Time"
        helpText="Monthly count of dental PE deals, stacked by type. Buyout = full acquisition. Add-on = bolt-on to existing platform. The white dashed line shows the 6-month rolling average trend. A rising trend means PE firms are accelerating acquisitions."
      />
      <div className="mt-4 rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4">
        <StackedBarChart
          data={chartData}
          xKey="month"
          series={series}
          lineKey="rolling_avg"
          lineLabel="6-mo avg"
          lineColor="#ffffff"
          height={450}
          yLabel="Deals"
        />
      </div>
    </div>
  )
}
