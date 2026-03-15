'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { BarChart } from '@/components/charts/bar-chart'
import type { Deal } from '@/lib/supabase/queries/deals'

interface SponsorPlatformChartsProps {
  deals: Deal[]
}

export function SponsorPlatformCharts({ deals }: SponsorPlatformChartsProps) {
  const sponsorData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of deals) {
      if (d.pe_sponsor) {
        counts.set(d.pe_sponsor, (counts.get(d.pe_sponsor) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, deals: count }))
  }, [deals])

  const platformData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of deals) {
      if (d.platform_company) {
        counts.set(d.platform_company, (counts.get(d.platform_company) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, deals: count }))
  }, [deals])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top 15 PE Sponsors */}
      <div>
        <SectionHeader
          title="Top 15 PE Sponsors"
          helpText="Private equity firms ranked by deal count. These are the financial backers funding dental acquisitions. Higher bars = more aggressive acquirers in dentistry."
        />
        <div className="mt-4 rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
          {sponsorData.length > 0 ? (
            <BarChart
              data={sponsorData}
              xKey="name"
              yKey="deals"
              color="#0066FF"
              height={450}
              horizontal
              showValues
              xLabel="Deals"
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-[#8892A0] text-sm">
              No PE sponsor data available.
            </div>
          )}
        </div>
      </div>

      {/* Top 15 Platforms */}
      <div>
        <SectionHeader
          title="Top 15 Platforms"
          helpText="Platform companies (DSOs) ranked by deal count. These are the dental companies doing the buying. Examples: Heartland Dental, Aspen Dental. They buy individual practices and bolt them on."
        />
        <div className="mt-4 rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4">
          {platformData.length > 0 ? (
            <BarChart
              data={platformData}
              xKey="name"
              yKey="deals"
              color="#00C853"
              height={450}
              horizontal
              showValues
              xLabel="Deals"
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-[#8892A0] text-sm">
              No platform data available.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
