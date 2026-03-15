'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { DonutChart } from '@/components/charts/donut-chart'
import { AreaChart } from '@/components/charts/area-chart'
import { chartColorway } from '@/lib/constants/design-tokens'
import type { Deal } from '@/lib/supabase/queries/deals'

interface SpecialtyChartsProps {
  deals: Deal[]
}

export function SpecialtyCharts({ deals }: SpecialtyChartsProps) {
  // Donut data
  const donutData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of deals) {
      if (d.specialty) {
        counts.set(d.specialty, (counts.get(d.specialty) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [deals])

  // Specialty trends by quarter — top 6 specialties as separate area series
  const { trendData, trendSeries } = useMemo(() => {
    const withDates = deals.filter(d => d.deal_date && d.specialty)

    // Find top 6 specialties
    const specCounts = new Map<string, number>()
    for (const d of withDates) {
      specCounts.set(d.specialty!, (specCounts.get(d.specialty!) ?? 0) + 1)
    }
    const topSpecs = [...specCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name)

    if (topSpecs.length === 0) {
      return { trendData: [], trendSeries: [] }
    }

    // Group by quarter
    const quarterMap = new Map<string, Record<string, number>>()
    for (const d of withDates) {
      if (!topSpecs.includes(d.specialty!)) continue
      const date = new Date(d.deal_date!)
      const q = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`
      if (!quarterMap.has(q)) {
        quarterMap.set(q, {})
      }
      const qr = quarterMap.get(q)!
      qr[d.specialty!] = (qr[d.specialty!] ?? 0) + 1
    }

    const quarters = [...quarterMap.keys()].sort()
    const data = quarters.map(q => {
      const row: Record<string, unknown> = { quarter: q }
      for (const spec of topSpecs) {
        row[spec] = quarterMap.get(q)?.[spec] ?? 0
      }
      return row
    })

    const series = topSpecs.map((spec, i) => ({
      key: spec,
      label: spec,
      color: chartColorway[i % chartColorway.length],
    }))

    return { trendData: data, trendSeries: series }
  }, [deals])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Donut chart */}
      <div>
        <SectionHeader
          title="Deals by Specialty"
          helpText="Breakdown of deals by dental specialty. General dentistry dominates, but orthodontics, oral surgery, and pediatric are also PE targets."
        />
        <div className="mt-4 rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          {donutData.length > 0 ? (
            <DonutChart data={donutData} height={350} />
          ) : (
            <div className="flex items-center justify-center h-[350px] text-[#6B6B60] text-sm">
              No specialty data available
            </div>
          )}
        </div>
      </div>

      {/* Specialty trends */}
      <div>
        <SectionHeader
          title="Specialty Trends"
          helpText="How each specialty's deal volume is changing over time (by quarter). Rising areas show where PE firms are expanding focus."
        />
        <div className="mt-4 rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          {trendData.length > 0 ? (
            <AreaChart
              data={trendData}
              xKey="quarter"
              series={trendSeries}
              height={350}
              stacked
            />
          ) : (
            <div className="flex items-center justify-center h-[350px] text-[#6B6B60] text-sm">
              No specialty trend data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
