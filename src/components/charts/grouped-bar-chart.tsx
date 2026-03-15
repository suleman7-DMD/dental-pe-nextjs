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
import { chartColorway } from '@/lib/constants/design-tokens'

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
      <div className={`flex items-center justify-center text-[#94A3B8] text-sm ${className ?? ''}`} style={{ height }}>
        No data available
      </div>
    )
  }

  const axisStyle = { fontSize: 11, fill: '#94A3B8' }
  const gridColor = '#1E293B'

  return (
    <div className={className}>
      {title && (
        <h3 className="text-sm font-semibold text-[#F8FAFC] mb-2">{title}</h3>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={axisStyle}
              axisLine={{ stroke: gridColor }}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fill: '#94A3B8', fontSize: 11 } : undefined}
            />
            <YAxis
              tick={axisStyle}
              axisLine={{ stroke: gridColor }}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 } : undefined}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0F1629', border: '1px solid #1E293B', borderRadius: 8, fontSize: 12, color: '#F8FAFC' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 11 }} iconType="rect" />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color ?? chartColorway[i % chartColorway.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
