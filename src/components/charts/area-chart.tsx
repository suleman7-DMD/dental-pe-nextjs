"use client";

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_THEME, CHART_COLORWAY } from "@/lib/constants/colors";
import { ChartContainer } from "./chart-container";

export interface AreaChartProps {
  data: Record<string, unknown>[];
  dataKeys?: { key: string; color?: string; name?: string }[];
  xAxisKey?: string;
  /** Alias for xAxisKey */
  xKey?: string;
  /** Alias for dataKeys with label instead of name */
  series?: { key: string; label: string; color: string }[];
  height?: number;
  title?: string;
  loading?: boolean;
  stacked?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  dataKeys,
  xAxisKey,
  xKey,
  series,
  height = 300,
  title,
  loading = false,
  stacked = false,
  className,
}: AreaChartProps) {
  const resolvedXKey = xKey ?? xAxisKey ?? "name";
  const resolvedKeys: { key: string; color?: string; name?: string }[] =
    series
      ? series.map((s) => ({ key: s.key, color: s.color, name: s.label }))
      : dataKeys ?? [];
  return (
    <ChartContainer
      title={title}
      height={height}
      loading={loading}
      empty={data.length === 0}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridColor}
          />
          <XAxis
            dataKey={resolvedXKey}
            tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
            axisLine={{ stroke: CHART_THEME.gridColor }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: "8px",
              color: CHART_THEME.tooltipText,
              fontSize: "12px",
            }}
          />
          {resolvedKeys.map((dk, i) => {
            const fill = dk.color ?? CHART_COLORWAY[i % CHART_COLORWAY.length];
            return (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.name ?? dk.key}
                stackId={stacked ? "stack" : undefined}
                stroke={fill}
                fill={fill}
                fillOpacity={0.15}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
