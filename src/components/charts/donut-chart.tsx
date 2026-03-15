"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_THEME, CHART_COLORWAY } from "@/lib/constants/colors";
import { ChartContainer } from "./chart-container";

export interface DonutChartProps {
  data?: { name: string; value: number; color?: string }[];
  /** Alias for data with label instead of name */
  segments?: { label: string; value: number; color?: string }[];
  /** Center label text */
  centerLabel?: string;
  /** Custom tooltip formatter */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  tooltipFormat?: (d: any) => string;
  height?: number;
  title?: string;
  loading?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  /** Show name + percentage labels on slices (like Plotly textinfo="label+percent") */
  showLabels?: boolean;
  className?: string;
}

export function DonutChart({
  data: rawData,
  segments,
  centerLabel,
  tooltipFormat: _tooltipFormat,
  height = 300,
  title,
  loading = false,
  innerRadius = 60,
  outerRadius = 90,
  showLegend = true,
  showLabels = false,
  className,
}: DonutChartProps) {
  // Normalize: prefer segments alias, map label→name
  const data: { name: string; value: number; color?: string }[] =
    segments
      ? segments.map((s) => ({ name: s.label, value: s.value, color: s.color }))
      : rawData ?? [];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Custom label renderer: shows "Name XX%" on each slice
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const renderLabel = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, outerRadius: or, name, value } = props;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    // Skip tiny slices
    if (total > 0 && (value / total) < 0.03) return null;
    const radius = (or as number) + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#6B6B60"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={500}
      >
        {`${name} ${pct}%`}
      </text>
    );
  };
  return (
    <ChartContainer
      title={title}
      height={height}
      loading={loading}
      empty={data.length === 0}
      className={className}
    >
      <div className="relative" style={{ width: "100%", height: "100%" }}>
        {centerLabel && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <span className="text-lg font-bold text-[var(--text-primary,#1A1A1A)]">
              {centerLabel}
            </span>
          </div>
        )}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={showLabels ? renderLabel : undefined}
            labelLine={showLabels}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color ?? CHART_COLORWAY[index % CHART_COLORWAY.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: "8px",
              color: CHART_THEME.tooltipText,
              fontSize: "12px",
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "11px", color: CHART_THEME.textColor }}
              iconType="circle"
              iconSize={8}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
