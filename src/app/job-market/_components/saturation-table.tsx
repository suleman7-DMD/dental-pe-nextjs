'use client'

import { useMemo, useCallback } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/types'

interface SaturationTableProps {
  zipScores: ZipScore[]
  watchedZips: WatchedZip[]
}

// Color coding thresholds for DLD, Buyable %, and Corporate %
function dldColor(val: number | null): { bg: string; text: string } | null {
  if (val == null) return null
  if (val < 5.0) return { bg: '#1B5E20', text: '#ffffff' }
  if (val <= 7.0) return { bg: '#F57F17', text: '#ffffff' }
  return { bg: '#B71C1C', text: '#ffffff' }
}

function buyableColor(val: number | null): { bg: string; text: string } | null {
  if (val == null) return null
  const pct = val * 100
  if (pct > 50) return { bg: '#1B5E20', text: '#ffffff' }
  if (pct >= 20) return { bg: '#F57F17', text: '#ffffff' }
  return { bg: '#B71C1C', text: '#ffffff' }
}

function corporateColor(val: number | null): { bg: string; text: string } | null {
  if (val == null) return null
  const pct = val * 100
  if (pct < 15) return { bg: '#1B5E20', text: '#ffffff' }
  if (pct <= 35) return { bg: '#F57F17', text: '#ffffff' }
  return { bg: '#B71C1C', text: '#ffffff' }
}

function confidenceStars(val: string | null): string {
  if (!val) return '\u2014'
  switch (val) {
    case 'high':
      return '\u2605\u2605\u2605'
    case 'medium':
      return '\u2605\u2605'
    case 'low':
      return '\u2605'
    default:
      return '\u2014'
  }
}

function formatMarketType(val: string | null): string {
  if (!val) return '\u2014'
  return val
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface SaturationRow {
  zip: string
  town: string
  pop: string
  mhi: string
  gpOffices: string
  dld: string
  dldRaw: number | null
  buyable: string
  buyableRaw: number | null
  corporate: string
  corporateRaw: number | null
  type: string
  confidence: string
  confidenceRaw: string | null
}

export function SaturationTable({ zipScores, watchedZips }: SaturationTableProps) {
  // Merge zip_scores with watched_zips demographics
  const wzMap = useMemo(() => {
    const map = new Map<string, WatchedZip>()
    for (const wz of watchedZips) {
      map.set(wz.zip_code, wz)
    }
    return map
  }, [watchedZips])

  const rows = useMemo((): SaturationRow[] => {
    return zipScores.map(zs => {
      const wz = wzMap.get(zs.zip_code)
      return {
        zip: zs.zip_code,
        town: zs.city ?? '\u2014',
        pop: wz?.population != null ? wz.population.toLocaleString() : '\u2014',
        mhi: wz?.median_household_income != null ? `$${wz.median_household_income.toLocaleString()}` : '\u2014',
        gpOffices: zs.total_gp_locations != null ? String(zs.total_gp_locations) : '\u2014',
        dld: zs.dld_gp_per_10k != null ? zs.dld_gp_per_10k.toFixed(1) : '\u2014',
        dldRaw: zs.dld_gp_per_10k,
        buyable: zs.buyable_practice_ratio != null ? `${(zs.buyable_practice_ratio * 100).toFixed(0)}%` : '\u2014',
        buyableRaw: zs.buyable_practice_ratio,
        corporate: zs.corporate_share_pct != null ? `${(zs.corporate_share_pct * 100).toFixed(0)}%` : '\u2014',
        corporateRaw: zs.corporate_share_pct,
        type: formatMarketType(zs.market_type),
        confidence: confidenceStars(zs.metrics_confidence),
        confidenceRaw: zs.metrics_confidence,
      }
    })
  }, [zipScores, wzMap])

  // CSV download
  const handleDownload = useCallback(() => {
    const headers = ['ZIP', 'Town', 'Pop', 'MHI', 'GP Offices', 'DLD-GP/10k', 'Buyable %', 'Corporate %', 'Type', 'Confidence']
    const csvRows = rows.map(r => [r.zip, r.town, r.pop, r.mhi, r.gpOffices, r.dld, r.buyable, r.corporate, r.type, r.confidenceRaw ?? ''].join(','))
    const csv = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'saturation_analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [rows])

  // Demographics date
  const demoDate = useMemo(() => {
    for (const wz of watchedZips) {
      const demoUpdated = (wz as unknown as Record<string, unknown>).demographics_updated_at as string | null | undefined
      if (demoUpdated) {
        try {
          return new Date(demoUpdated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        } catch {
          return demoUpdated
        }
      }
    }
    return null
  }, [watchedZips])

  // Check low confidence percentage
  const lowConfPct = useMemo(() => {
    const lowCount = zipScores.filter(z => z.metrics_confidence === 'low').length
    return zipScores.length > 0 ? (lowCount / zipScores.length) * 100 : 0
  }, [zipScores])

  const columns = ['ZIP', 'Town', 'Pop', 'MHI', 'GP Offices', 'DLD-GP/10k', 'Buyable %', 'Corporate %', 'Type', 'Confidence']

  if (zipScores.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Saturation Analysis"
          helpText="Cross-ZIP comparison of dental market metrics."
        />
        <div className="mt-4 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60]">
          No saturation data available for the selected location. ZIP scores have not been computed for these ZIPs yet.
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader
        title="Saturation Analysis"
        helpText="Cross-ZIP comparison of dental market metrics. DLD-GP/10k = GP dental offices per 10,000 residents (national avg ~6.1). Buyable % = share of GP offices that are independently owned solos. Corporate % = share of GP offices that are DSO/PE-affiliated. Color codes: green = favorable, yellow = moderate, red = high competition or limited opportunity."
      />

      <div className="mt-4 rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.82rem] font-sans border-collapse">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    className="px-2.5 py-2.5 text-left border-b-2 border-[#E8E5DE] text-[#6B6B60] font-semibold whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const dldStyle = dldColor(row.dldRaw)
                const buyableStyle = buyableColor(row.buyableRaw)
                const corpStyle = corporateColor(row.corporateRaw)

                return (
                  <tr key={row.zip} className="border-b border-[#E8E5DE] hover:bg-[#F7F7F4] transition-colors">
                    <td className="px-2.5 py-1.5 text-[#1A1A1A] whitespace-nowrap">{row.zip}</td>
                    <td className="px-2.5 py-1.5 text-[#1A1A1A] whitespace-nowrap">{row.town}</td>
                    <td className="px-2.5 py-1.5 text-[#1A1A1A] whitespace-nowrap">{row.pop}</td>
                    <td className="px-2.5 py-1.5 text-[#1A1A1A] whitespace-nowrap">{row.mhi}</td>
                    <td className="px-2.5 py-1.5 text-[#1A1A1A] whitespace-nowrap">{row.gpOffices}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {dldStyle ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: dldStyle.bg, color: dldStyle.text }}
                        >
                          {row.dld}
                        </span>
                      ) : (
                        <span className="text-[#1A1A1A]">{row.dld}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {buyableStyle ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: buyableStyle.bg, color: buyableStyle.text }}
                        >
                          {row.buyable}
                        </span>
                      ) : (
                        <span className="text-[#1A1A1A]">{row.buyable}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {corpStyle ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: corpStyle.bg, color: corpStyle.text }}
                        >
                          {row.corporate}
                        </span>
                      ) : (
                        <span className="text-[#1A1A1A]">{row.corporate}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-[#1A1A1A] whitespace-nowrap">{row.type}</td>
                    <td className="px-2.5 py-1.5 text-[#D4920B] whitespace-nowrap">{row.confidence}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with download and info */}
        <div className="border-t border-[#E8E5DE] px-3 py-2 flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={handleDownload}
            className="text-[0.78rem] text-[#B8860B] hover:text-[#D4920B] transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download saturation analysis
          </button>
          {demoDate && (
            <span className="text-[0.72rem] text-[#9C9C90]">
              Demographics last updated: {demoDate}
            </span>
          )}
        </div>
      </div>

      {/* Low confidence warning */}
      {lowConfPct > 30 && (
        <div className="mt-3 rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] px-4 py-3 text-[0.82rem] text-[#B8860B]">
          Many ZIPs have limited data quality. Metrics marked with a single star should be
          treated as directional only. Run Data Axle imports for enriched ZIPs to improve accuracy.
        </div>
      )}
    </div>
  )
}
