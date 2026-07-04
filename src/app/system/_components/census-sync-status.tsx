'use client'

import { AlertTriangle, Database, FileCheck2 } from 'lucide-react'
import type { CensusSummary } from '@/lib/supabase/queries/census'

/**
 * Census truth-layer sync honesty (charter §1b / Phase 0).
 *
 * Every number here is computed live from Supabase — the same source the rest
 * of the app reads. The canonical census is written to the local research
 * database first and lands here only when the user authorizes a sync, so this
 * card states that gap instead of papering over it. No local-census tallies
 * are hardcoded; the local state is described qualitatively.
 */

function formatPct(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`
}

const SYNC_COMMANDS = [
  'python3 -m scrapers._sync_floor_tables_only',
  'python3 -m scrapers._sync_census_columns_practices',
]

export function CensusSyncStatus({ census }: { census: CensusSummary }) {
  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-white">
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6B6B60]">
            <FileCheck2 className="h-3.5 w-3.5" />
            Live reviewed rows
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#1A1A1A]">
            {census.liveDataAvailable ? census.reviewed.toLocaleString() : '—'}
          </div>
          <p className="mt-1 text-xs text-[#6B6B60]">
            Locations with a census ownership conclusion in the live database
            right now. Source: census-reviewed (live query).
          </p>
        </div>
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6B6B60]">
            <Database className="h-3.5 w-3.5" />
            Live coverage
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#1A1A1A]">
            {census.liveDataAvailable ? formatPct(census.coveragePct) : '—'}
          </div>
          <p className="mt-1 text-xs text-[#6B6B60]">
            Of {census.universe.toLocaleString()} GP locations in the watched
            universe. Everything else renders as unresolved — never guessed.
          </p>
        </div>
        <div className="rounded-md border border-[#D4920B]/40 bg-[#FFF7E5] p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8B6508]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sync gap honesty
          </div>
          <p className="mt-2 text-xs leading-5 text-[#6B6B60]">
            The canonical census is written to the local research database
            first. If the research team reports a bigger reviewed wave than the
            count on the left, the live sync has not run yet — the app shows
            only what has actually landed here. Authorized sync legs:
          </p>
          <div className="mt-2 space-y-1">
            {SYNC_COMMANDS.map((cmd) => (
              <code
                key={cmd}
                className="block truncate rounded bg-[#1A1A1A]/5 px-2 py-1 font-mono text-[10px] text-[#3D3D35]"
                title={cmd}
              >
                {cmd}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
