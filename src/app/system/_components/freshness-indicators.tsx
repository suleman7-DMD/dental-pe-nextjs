'use client'

import { AlertTriangle } from 'lucide-react'
import type {
  SourceCoverage,
  DealSource,
  DealSourceFreshness,
} from '@/lib/supabase/queries/system'

interface FreshnessIndicatorsProps {
  sources: SourceCoverage[]
  dealSources: Record<DealSource, DealSourceFreshness>
}

// Distinguishes "source is dry" (green lastIngest + old lastDeal) from
// "scraper is broken" (old lastIngest AND old lastDeal). Green ≤ 35 days
// matches the monthly cadence of PESP/GDN roundup posts.
function freshnessClass(days: number | null): string {
  if (days == null) return 'text-[#707064]' // gray — no data
  if (days <= 35) return 'text-[#2D8B4E]' // green
  if (days <= 90) return 'text-[#D4920B]' // amber
  return 'text-[#C23B3B]' // red
}

function freshnessDot(days: number | null): string {
  if (days == null) return 'bg-[#9C9C90]'
  if (days <= 35) return 'bg-[#2D8B4E]'
  if (days <= 90) return 'bg-[#D4920B]'
  return 'bg-[#C23B3B]'
}

export function FreshnessIndicators({ sources, dealSources }: FreshnessIndicatorsProps) {
  const nppes = sources.find((s) => s.source.toLowerCase() === 'nppes')
  const adso = sources.find((s) => s.source.toLowerCase() === 'data_axle' || s.source === 'ADSO Scraper')
  const ada = sources.find((s) => s.source.toLowerCase() === 'manual' || s.source === 'ADA HPI')

  // Check for stale demographics (>365 days)
  const demographicsStale =
    nppes?.daysSinceUpdate != null && nppes.daysSinceUpdate > 365

  const dealSourceOrder: DealSource[] = ['GDN', 'PESP', 'PitchBook', 'Manual']

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-xs text-[#6B6B60] uppercase tracking-wide">Demographics (NPPES)</span>
            <p className="text-sm text-[#1A1A1A] mt-1 font-mono">
              {nppes?.lastUpdated ?? '--'}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#6B6B60] uppercase tracking-wide">DSO Locations (ADSO)</span>
            <p className="text-sm text-[#1A1A1A] mt-1 font-mono">
              {adso?.lastUpdated ?? '--'}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#6B6B60] uppercase tracking-wide">ADA Benchmarks</span>
            <p className="text-sm text-[#1A1A1A] mt-1 font-mono">
              {ada?.lastUpdated ?? '--'}
            </p>
          </div>
        </div>

        {demographicsStale && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Demographics data is over 1 year old ({nppes!.daysSinceUpdate} days). Consider running
            the NPPES downloader to refresh provider data.
          </div>
        )}
      </div>

      {/* Deal Source Freshness — separates "source is dry" from "scraper is broken" */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-sans font-semibold text-sm text-[#1A1A1A]">Deal Source Freshness</h3>
          <p className="text-xs text-[#6B6B60] mt-1">
            Color reflects days since the latest deal_date. Green ≤ 35 days (monthly-cadence sources).
            Amber 35–90 days. Red &gt; 90 days (likely stalled upstream or scraper broken).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E5DE] text-[#6B6B60]">
                <th className="text-left px-4 py-2.5 font-medium text-xs">Source</th>
                <th className="text-right px-4 py-2.5 font-medium text-xs">Count</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs">Deal Date Range</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs">Last Ingest</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs">Freshness</th>
              </tr>
            </thead>
            <tbody>
              {dealSourceOrder.map((key) => {
                const src = dealSources[key]
                const range =
                  src.firstDealDate && src.lastDealDate
                    ? `${src.firstDealDate} → ${src.lastDealDate}`
                    : '—'
                const ingest = src.lastIngestDate
                  ? new Date(src.lastIngestDate).toISOString().slice(0, 10)
                  : '—'
                const freshnessLabel =
                  src.daysSinceLastDeal == null
                    ? 'No data'
                    : `${src.daysSinceLastDeal}d since last deal`
                return (
                  <tr
                    key={key}
                    className="border-b border-[#E8E5DE]/50 hover:bg-[#E8E5DE]/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-[#1A1A1A] font-medium">{key}</td>
                    <td className="px-4 py-2.5 text-[#6B6B60] font-mono tabular-nums text-right">
                      {src.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">{range}</td>
                    <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">{ingest}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${freshnessClass(
                          src.daysSinceLastDeal
                        )}`}
                      >
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${freshnessDot(
                            src.daysSinceLastDeal
                          )}`}
                        />
                        {freshnessLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
