'use client'

import { StatusDot } from '@/components/data-display/status-dot'
import type { SourceCoverage } from '@/lib/supabase/queries/system'

interface DataCoverageProps {
  sources: SourceCoverage[]
}

export function DataCoverage({ sources }: DataCoverageProps) {
  return (
    <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E2A3A] text-[#8892A0]">
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
                className="border-b border-[#1E2A3A]/50 hover:bg-[#1E2A3A]/20 transition-colors"
              >
                <td className="px-4 py-2.5 text-[#E8ECF1] font-medium">{src.source}</td>
                <td className="px-4 py-2.5 text-[#8892A0] font-mono tabular-nums">
                  {src.records.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-[#8892A0] font-mono text-xs">
                  {src.dateRange}
                </td>
                <td className="px-4 py-2.5 text-[#8892A0] font-mono text-xs">
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
