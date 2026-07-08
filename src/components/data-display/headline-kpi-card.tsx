'use client'

import { KpiCard } from './kpi-card'
import type { HeadlineStat } from '@/lib/census/headline-stats'

/**
 * Renders a canonical headline stat as a KPI card. Pages choose the icon and
 * placement; label, value, sublabel, tooltip, and accent all come from the
 * stat definition so the same stat can never render differently on two pages.
 */
export function HeadlineKpiCard({
  stat,
  icon,
}: {
  stat: HeadlineStat
  icon?: React.ReactNode
}) {
  return (
    <KpiCard
      icon={icon}
      label={stat.label}
      value={stat.value}
      subtitle={<span className="text-xs text-[#6B6B60]">{stat.sublabel}</span>}
      tooltip={stat.tooltip}
      accentColor={stat.accentColor}
    />
  )
}
