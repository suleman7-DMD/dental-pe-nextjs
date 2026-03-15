'use client'

import { useMemo } from 'react'
import { KpiCard } from '@/components/data-display/kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import type { Deal } from '@/lib/supabase/queries/deals'

interface DealKpisProps {
  deals: Deal[]
}

export function DealKpis({ deals }: DealKpisProps) {
  const kpis = useMemo(() => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const lastYear = thisYear - 1
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(thisYear, 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    )

    const hasDates = deals.some(d => d.deal_date)

    const dealsThisYear = hasDates
      ? deals.filter(d => d.deal_date && new Date(d.deal_date).getFullYear() === thisYear)
      : []
    const dealsLastYear = hasDates
      ? deals.filter(d => d.deal_date && new Date(d.deal_date).getFullYear() === lastYear)
      : []
    const ytdLastYear = dealsLastYear.filter(d => {
      if (!d.deal_date) return false
      const dd = new Date(d.deal_date)
      const doy = Math.floor(
        (dd.getTime() - new Date(lastYear, 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      )
      return doy <= dayOfYear
    })

    const sponsorsNow = new Set(dealsThisYear.map(d => d.pe_sponsor).filter(Boolean)).size
    const sponsorsPrev = new Set(dealsLastYear.map(d => d.pe_sponsor).filter(Boolean)).size
    const platsNow = new Set(dealsThisYear.map(d => d.platform_company).filter(Boolean)).size
    const platsPrev = new Set(dealsLastYear.map(d => d.platform_company).filter(Boolean)).size

    return {
      total: deals.length,
      totalDelta: dealsLastYear.length > 0 ? dealsThisYear.length - dealsLastYear.length : null,
      activeSponsors: new Set(deals.map(d => d.pe_sponsor).filter(Boolean)).size,
      sponsorDelta: sponsorsPrev > 0 ? sponsorsNow - sponsorsPrev : null,
      activePlatforms: new Set(deals.map(d => d.platform_company).filter(Boolean)).size,
      platformDelta: platsPrev > 0 ? platsNow - platsPrev : null,
      ytd: dealsThisYear.length,
      ytdDelta: ytdLastYear.length > 0 ? dealsThisYear.length - ytdLastYear.length : null,
    }
  }, [deals])

  return (
    <div>
      <SectionHeader
        title="Key Metrics"
        helpText="Top-line numbers for the filtered deal set. Green/red arrows show year-over-year change. Total Deals = all acquisitions matching your filters. PE Sponsors = distinct private equity firms. Platforms = DSO companies doing the buying. YTD = deals so far this calendar year vs same point last year."
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <KpiCard
          label="Total Deals"
          value={kpis.total.toLocaleString()}
          delta={kpis.totalDelta}
          deltaLabel="vs last year"
        />
        <KpiCard
          label="Active PE Sponsors"
          value={kpis.activeSponsors}
          delta={kpis.sponsorDelta}
          deltaLabel="YoY"
        />
        <KpiCard
          label="Active Platforms"
          value={kpis.activePlatforms}
          delta={kpis.platformDelta}
          deltaLabel="YoY"
        />
        <KpiCard
          label="Deals YTD"
          value={kpis.ytd}
          delta={kpis.ytdDelta}
          deltaLabel="vs last year"
        />
      </div>
    </div>
  )
}
