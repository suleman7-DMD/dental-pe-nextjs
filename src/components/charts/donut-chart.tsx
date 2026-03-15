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
  className,
}: DonutChartProps) {
  // Normalize: prefer segments alias, map label→name
  const data: { name: string; value: number; color?: string }[] =
    segments
      ? segments.map((s) => ({ name: s.label, value: s.value, color: s.color }))
      : rawData ?? [];
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
            <span className="text-lg font-bold text-[var(--text-primary,#E8ECF1)]">
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
