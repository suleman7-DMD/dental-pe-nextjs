'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_THEME, CHART_COLORWAY } from '@/lib/constants/colors'

interface GroupedBarChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  /** The series keys to group side by side */
  series: Array<{
    key: string
    label: string
    color?: string
  }>
  height?: number
  title?: string
  xLabel?: string
  yLabel?: string
  className?: string
}

export function GroupedBarChart({
  data,
  xKey,
  series,
  height = 350,
  title,
  xLabel,
  yLabel,
  className,
}: GroupedBarChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-[#9C9C90] text-sm ${className ?? ''}`} style={{ height }}>
        No data available
      </div>
    )
  }

  const axisStyle = { fontSize: 11, fill: CHART_THEME.textColor }
  const gridColor = CHART_THEME.gridColor

  return (
    <div className={className}>
      {title && (
        <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">{title}</h3>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={axisStyle}
              axisLine={{ stroke: gridColor }}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fill: CHART_THEME.textColor, fontSize: 11 } : undefined}
            />
            <YAxis
              tick={axisStyle}
              axisLine={{ stroke: gridColor }}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: CHART_THEME.textColor, fontSize: 11 } : undefined}
            />
            <Tooltip
              contentStyle={{ backgroundColor: CHART_THEME.tooltipBg, border: `1px solid ${CHART_THEME.tooltipBorder}`, borderRadius: 8, fontSize: 12, color: CHART_THEME.tooltipText }}
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
            />
            <Legend wrapperStyle={{ color: CHART_THEME.textColor, fontSize: 11 }} iconType="rect" />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color ?? CHART_COLORWAY[i % CHART_COLORWAY.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
