'use client'

import {
  BUCKET_META,
  HEADLINE_BUCKETS,
  type BucketSummary,
  type HeadlineBucket,
} from '@/lib/census/ownership-truth'

interface CensusBucketSummaryCardProps {
  summary: BucketSummary
  /** Human scope name, e.g. "All Chicagoland" — coverage is stated FOR this scope. */
  scopeLabel: string
  className?: string
}

/**
 * The five-bucket census ownership strip: stacked bar + per-bucket chips +
 * coverage line. This is the ONLY headline ownership visual — all five
 * buckets always render (Unresolved included, rule §2: never collapsed).
 * Counts come from `summarizeBuckets` over live census rows; the universe is
 * the live GP-location denominator for the scope, never a constant.
 */
export function CensusBucketSummaryCard({
  summary,
  scopeLabel,
  className = '',
}: CensusBucketSummaryCardProps) {
  const { universe, reviewed, coveragePct, counts, pctOfUniverse } = summary
  // Bar segments normalize against max(universe, reviewed) so widths stay
  // sane even if row counts momentarily exceed the zip_scores denominator.
  const barTotal = Math.max(universe, reviewed)

  if (barTotal <= 0) {
    return (
      <div className={`rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4 ${className}`}>
        <p className="text-sm text-[#6B6B60]">
          Census ownership coverage is unavailable for {scopeLabel} — no GP-location
          denominator loaded for this scope.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-sans font-semibold text-sm text-[#1A1A1A]">
          Ownership census — {scopeLabel}
        </h2>
        <span className="text-xs text-[#6B6B60] font-mono">
          {reviewed.toLocaleString()} of {universe.toLocaleString()} GP clinics reviewed
          {' '}({coveragePct.toFixed(1)}%)
        </span>
      </div>

      {/* Stacked five-bucket bar */}
      <div
        className="flex h-3.5 w-full rounded-full overflow-hidden border border-[#E8E5DE]"
        role="img"
        aria-label={`Census ownership mix for ${scopeLabel}`}
      >
        {HEADLINE_BUCKETS.map((bucket: HeadlineBucket) => {
          const count = counts[bucket]
          if (count <= 0) return null
          const widthPct = (count / barTotal) * 100
          return (
            <div
              key={bucket}
              title={`${BUCKET_META[bucket].label}: ${count.toLocaleString()}`}
              style={{
                width: `${widthPct}%`,
                backgroundColor: BUCKET_META[bucket].color,
                opacity: bucket === 'unresolved' ? 0.45 : 1,
              }}
            />
          )
        })}
      </div>

      {/* Per-bucket chips — all five, always */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {HEADLINE_BUCKETS.map((bucket: HeadlineBucket) => (
          <div key={bucket} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{
                backgroundColor: BUCKET_META[bucket].color,
                opacity: bucket === 'unresolved' ? 0.55 : 1,
              }}
            />
            <span className="text-[#1A1A1A] font-medium">
              {BUCKET_META[bucket].shortLabel}
            </span>
            <span className="text-[#6B6B60] font-mono">
              {counts[bucket].toLocaleString()}
              {' '}({pctOfUniverse[bucket].toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#8A8A7E] mt-2.5">
        Source: hand-reviewed ownership census (evidence-backed tiers). Percentages are of the
        full GP-clinic universe for this scope. Unresolved = no reviewed conclusion yet — shown
        honestly, never filled with estimates.
      </p>
    </div>
  )
}
