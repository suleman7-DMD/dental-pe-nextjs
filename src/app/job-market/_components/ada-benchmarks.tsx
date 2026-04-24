'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { GroupedBarChart } from '@/components/charts/grouped-bar-chart'
import type { ADABenchmark } from '@/lib/supabase/queries/ada-benchmarks'

interface ADABenchmarksProps {
  data: ADABenchmark[]
}

function transformForChart(stateData: ADABenchmark[]) {
  const years = [...new Set(stateData.map(d => String(d.data_year)))].sort()
  const stages = [...new Set(stateData.map(d => d.career_stage))]

  return {
    years,
    chartData: stages.map(stage => {
      const row: Record<string, unknown> = { career_stage: stage }
      for (const year of years) {
        const match = stateData.find(d => d.career_stage === stage && String(d.data_year) === year)
        row[year] = match ? match.pct_dso_affiliated : 0
      }
      return row
    }),
  }
}

export function ADABenchmarks({ data }: ADABenchmarksProps) {
  const ilData = useMemo(() => data.filter(d => d.state === 'IL'), [data])
  const maData = useMemo(() => data.filter(d => d.state === 'MA'), [data])
  const ilChart = useMemo(() => transformForChart(ilData), [ilData])
  const maChart = useMemo(() => transformForChart(maData), [maData])

  const yearColors = ['#B8860B', '#2D8B4E', '#D4920B', '#7C3AED']

  if (data.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="ADA HPI State-Level DSO Affiliation Benchmarks"
        helpText="Official ADA Health Policy Institute data showing what percentage of dentists in each state are DSO-affiliated, broken down by career stage. Early-career dentists are much more likely to join DSOs."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Illinois */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          {ilData.length > 0 ? (
            <GroupedBarChart
              data={ilChart.chartData}
              xKey="career_stage"
              series={ilChart.years.map((y, i) => ({
                key: y,
                label: y,
                color: yearColors[i % yearColors.length],
              }))}
              title="Illinois"
              yLabel="DSO %"
              height={320}
            />
          ) : (
            <div className="flex items-center justify-center h-[320px] text-[#6B6B60] text-sm">
              No ADA HPI data for Illinois
            </div>
          )}
        </div>

        {/* Massachusetts */}
        <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          {maData.length > 0 ? (
            <GroupedBarChart
              data={maChart.chartData}
              xKey="career_stage"
              series={maChart.years.map((y, i) => ({
                key: y,
                label: y,
                color: yearColors[i % yearColors.length],
              }))}
              title="Massachusetts"
              yLabel="DSO %"
              height={320}
            />
          ) : (
            <div className="flex items-center justify-center h-[320px] text-[#6B6B60] text-sm">
              No ADA HPI data for Massachusetts
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
