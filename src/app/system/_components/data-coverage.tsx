'use client'

import { StatusDot } from '@/components/data-display/status-dot'
import type { SourceCoverage } from '@/lib/supabase/queries/system'

interface DataCoverageProps {
  sources: SourceCoverage[]
}

export function DataCoverage({ sources }: DataCoverageProps) {
  return (
    <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E5DE] text-[#6B6B60]">
              <th className="text-left px-4 py-2.5 font-medium text-xs">Source</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Records</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Date Range</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Last Updated</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((src) => (
              <tr
                key={src.source}
                className="border-b border-[#E8E5DE]/50 hover:bg-[#E8E5DE]/20 transition-colors"
                title={
                  src.source === 'data_axle' || src.source.toLowerCase() === 'data axle'
                    ? "Counts practices with data_source='data_axle' (literal source attribution, ~481). Home / Market Intel / Job Market show ~2,990 enriched (data_axle_import_date IS NOT NULL — broader: any Data Axle enrichment regardless of source attribution)."
                    : undefined
                }
              >
                <td className="px-4 py-2.5 text-[#1A1A1A] font-medium">{src.source}</td>
                <td className="px-4 py-2.5 text-[#6B6B60] font-mono tabular-nums">
                  {src.records.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">
                  {src.dateRange}
                </td>
                <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs">
                  {src.lastUpdated}
                </td>
                <td className="px-4 py-2.5">
                  <StatusDot daysSinceUpdate={src.daysSinceUpdate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
