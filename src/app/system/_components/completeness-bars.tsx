'use client'

import type { CompletenessMetric } from '@/lib/supabase/queries/system'

interface CompletenessBarProps {
  metric: CompletenessMetric
}

function CompletenessBar({ metric }: CompletenessBarProps) {
  const pct = Math.min(metric.pct, 100)
  const color = pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color }}>
          {metric.label}: {pct.toFixed(0)}%
        </span>
        <span className="text-xs text-[#94A3B8] font-mono tabular-nums">
          {metric.count.toLocaleString()} / {metric.total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#1E293B] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

interface CompletenessBarsProps {
  metrics: CompletenessMetric[]
}

export function CompletenessBars({ metrics }: CompletenessBarsProps) {
  return (
    <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4 space-y-4">
      {metrics.map((m) => (
        <CompletenessBar key={m.label} metric={m} />
      ))}
    </div>
  )
}
