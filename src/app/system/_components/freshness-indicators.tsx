'use client'

import { AlertTriangle } from 'lucide-react'
import type { SourceCoverage } from '@/lib/supabase/queries/system'

interface FreshnessIndicatorsProps {
  sources: SourceCoverage[]
}

export function FreshnessIndicators({ sources }: FreshnessIndicatorsProps) {
  const nppes = sources.find((s) => s.source === 'NPPES')
  const adso = sources.find((s) => s.source === 'ADSO Scraper')
  const ada = sources.find((s) => s.source === 'ADA HPI')

  // Check for stale demographics (>365 days)
  const demographicsStale =
    nppes?.daysSinceUpdate != null && nppes.daysSinceUpdate > 365

  return (
    <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-xs text-[#94A3B8] uppercase tracking-wide">Demographics (NPPES)</span>
          <p className="text-sm text-[#F8FAFC] mt-1 font-mono">
            {nppes?.lastUpdated ?? '--'}
          </p>
        </div>
        <div>
          <span className="text-xs text-[#94A3B8] uppercase tracking-wide">DSO Locations (ADSO)</span>
          <p className="text-sm text-[#F8FAFC] mt-1 font-mono">
            {adso?.lastUpdated ?? '--'}
          </p>
        </div>
        <div>
          <span className="text-xs text-[#94A3B8] uppercase tracking-wide">ADA Benchmarks</span>
          <p className="text-sm text-[#F8FAFC] mt-1 font-mono">
            {ada?.lastUpdated ?? '--'}
          </p>
        </div>
      </div>

      {demographicsStale && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Demographics data is over 1 year old ({nppes!.daysSinceUpdate} days). Consider running
          the NPPES downloader to refresh provider data.
        </div>
      )}
    </div>
  )
}
