"use client";

import { formatNumber, formatRelativeTime } from "@/lib/utils/formatting";
import { Database, Clock, BarChart3 } from "lucide-react";

export interface DataFreshnessBarProps {
  totalPractices: number;
  enrichedCount?: number;
  /** Alias for enrichedCount */
  daEnriched?: number;
  lastUpdated?: string | null;
}

export function DataFreshnessBar({
  totalPractices,
  enrichedCount,
  daEnriched,
  lastUpdated,
}: DataFreshnessBarProps) {
  const resolvedEnriched = enrichedCount ?? daEnriched ?? 0;
  const enrichmentPct =
    totalPractices > 0
      ? ((resolvedEnriched / totalPractices) * 100).toFixed(1)
      : "0";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-xs">
      <div
        className="flex items-center gap-1.5 text-[var(--text-secondary)]"
        title="Address-deduped location records tracked in the selected scope — all classes (GP, specialist, non-clinical, unverified). NOT raw federal NPI rows (NPPES emits ~2.4x more rows than physical locations) and NOT the GP-only clinic denominator used by the KPI cards."
      >
        <Database className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
        <span className="font-medium text-[var(--text-primary)]">
          {formatNumber(totalPractices)}
        </span>
        <span>tracked locations</span>
      </div>

      <div className="h-3 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <BarChart3 className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
        <span className="font-medium text-[var(--text-primary)]">
          {formatNumber(resolvedEnriched)}
        </span>
        <span>enriched ({enrichmentPct}%)</span>
      </div>

      {lastUpdated && (
        <>
          <div className="h-3 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Clock className="h-3.5 w-3.5 text-[var(--accent-green)]" />
            <span>Updated {formatRelativeTime(lastUpdated)}</span>
          </div>
        </>
      )}
    </div>
  );
}
