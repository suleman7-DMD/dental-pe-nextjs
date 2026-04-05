'use client'

import { useMemo } from 'react'
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { SectionHeader } from '@/components/data-display/section-header'
import { DonutChart } from '@/components/charts/donut-chart'
import { chartColorway } from '@/lib/constants/design-tokens'
import { CHART_THEME } from '@/lib/constants/colors'
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

  // Per-specialty quarterly trend data — top 6 specialties, each as a separate dataset
  const specialtyTrends = useMemo(() => {
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

    if (topSpecs.length === 0) return []

    // Group by quarter per specialty
    const quarterMap = new Map<string, Map<string, number>>()
    for (const d of withDates) {
      if (!topSpecs.includes(d.specialty!)) continue
      const date = new Date(d.deal_date!)
      const q = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`
      if (!quarterMap.has(q)) {
        quarterMap.set(q, new Map())
      }
      const qr = quarterMap.get(q)!
      qr.set(d.specialty!, (qr.get(d.specialty!) ?? 0) + 1)
    }

    const quarters = [...quarterMap.keys()].sort()

    return topSpecs.map((spec, i) => {
      const data = quarters.map(q => ({
        quarter: q,
        count: quarterMap.get(q)?.get(spec) ?? 0,
      }))
      return {
        name: spec,
        color: chartColorway[i % chartColorway.length],
        data,
      }
    })
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
            <DonutChart data={donutData} height={350} showLabels />
          ) : (
            <div className="flex items-center justify-center h-[350px] text-[#6B6B60] text-sm">
              No specialty data available
            </div>
          )}
        </div>
      </div>

      {/* Specialty trends — 3x2 faceted grid */}
      <div>
        <SectionHeader
          title="Specialty Trends"
          helpText="Each specialty's quarterly deal volume shown individually. Compare how PE focus areas are evolving over time."
        />
        <div className="mt-4 rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          {specialtyTrends.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {specialtyTrends.map((spec) => (
                <div key={spec.name} className="flex flex-col">
                  <span className="text-[11px] font-medium text-[#6B6B60] uppercase tracking-wider mb-1 truncate" title={spec.name}>
                    {spec.name}
                  </span>
                  <div style={{ width: '100%', height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart
                        data={spec.data}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="quarter"
                          tick={false}
                          axisLine={{ stroke: CHART_THEME.gridColor }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: CHART_THEME.textColor, fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: CHART_THEME.tooltipBg,
                            border: `1px solid ${CHART_THEME.tooltipBorder}`,
                            borderRadius: '6px',
                            color: CHART_THEME.tooltipText,
                            fontSize: '11px',
                            padding: '4px 8px',
                          }}
                          labelStyle={{ fontSize: '10px', color: CHART_THEME.textColor }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          name={spec.name}
                          stroke={spec.color}
                          fill={spec.color}
                          fillOpacity={0.2}
                          strokeWidth={1.5}
                        />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
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
