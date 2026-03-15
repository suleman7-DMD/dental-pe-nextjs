'use client'

import { useMemo, useCallback } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'

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
  if (zipScores.length === 0) return null

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
      if (wz.demographics_updated_at) {
        try {
          return new Date(wz.demographics_updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        } catch {
          return wz.demographics_updated_at
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

  return (
    <div>
      <SectionHeader
        title="Saturation Analysis"
        helpText="Cross-ZIP comparison of dental market metrics. DLD-GP/10k = GP dental offices per 10,000 residents (national avg ~6.1). Buyable % = share of GP offices that are independently owned solos. Corporate % = share of GP offices that are DSO/PE-affiliated. Color codes: green = favorable, yellow = moderate, red = high competition or limited opportunity."
      />

      <div className="mt-4 rounded-[10px] border border-[#1E2A3A] bg-[#141922] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.82rem] font-sans border-collapse">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    className="px-2.5 py-2.5 text-left border-b-2 border-[#1E2A3A] text-[#8892A0] font-semibold whitespace-nowrap"
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
                  <tr key={row.zip} className="border-b border-[#1E2A3A] hover:bg-[#1A2332] transition-colors">
                    <td className="px-2.5 py-1.5 text-[#E8ECF1] whitespace-nowrap">{row.zip}</td>
                    <td className="px-2.5 py-1.5 text-[#E8ECF1] whitespace-nowrap">{row.town}</td>
                    <td className="px-2.5 py-1.5 text-[#E8ECF1] whitespace-nowrap">{row.pop}</td>
                    <td className="px-2.5 py-1.5 text-[#E8ECF1] whitespace-nowrap">{row.mhi}</td>
                    <td className="px-2.5 py-1.5 text-[#E8ECF1] whitespace-nowrap">{row.gpOffices}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {dldStyle ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: dldStyle.bg, color: dldStyle.text }}
                        >
                          {row.dld}
                        </span>
                      ) : (
                        <span className="text-[#E8ECF1]">{row.dld}</span>
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
                        <span className="text-[#E8ECF1]">{row.buyable}</span>
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
                        <span className="text-[#E8ECF1]">{row.corporate}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-[#E8ECF1] whitespace-nowrap">{row.type}</td>
                    <td className="px-2.5 py-1.5 text-[#FFB300] whitespace-nowrap">{row.confidence}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with download and info */}
        <div className="border-t border-[#1E2A3A] px-3 py-2 flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={handleDownload}
            className="text-[0.78rem] text-[#0066FF] hover:text-[#3399FF] transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download saturation analysis
          </button>
          {demoDate && (
            <span className="text-[0.72rem] text-[#566070]">
              Demographics last updated: {demoDate}
            </span>
          )}
        </div>
      </div>

      {/* Low confidence warning */}
      {lowConfPct > 30 && (
        <div className="mt-3 rounded-lg border border-[#1a3a5c] bg-[#0a1628] px-4 py-3 text-[0.82rem] text-[#7eb8e0]">
          Many ZIPs have limited data quality. Metrics marked with a single star should be
          treated as directional only. Run Data Axle imports for enriched ZIPs to improve accuracy.
        </div>
      )}
    </div>
  )
}
