"use client";

import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { CHART_THEME, CHART_COLORWAY } from "@/lib/constants/colors";
import { ChartContainer } from "./chart-container";

export interface ScatterChartProps {
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  zKey?: string; // bubble size
  colorKey?: string;
  colorMap?: Record<string, string>;
  xLabel?: string;
  yLabel?: string;
  /** Alias for xLabel */
  xAxisLabel?: string;
  /** Alias for yLabel */
  yAxisLabel?: string;
  /** Group legend items */
  groups?: { label: string; color: string }[];
  height?: number;
  title?: string;
  loading?: boolean;
  className?: string;
}

export function ScatterChart({
  data,
  xKey = "x",
  yKey = "y",
  zKey,
  colorKey,
  colorMap,
  xLabel,
  yLabel,
  xAxisLabel,
  yAxisLabel,
  groups: _groups,
  height = 300,
  title,
  loading = false,
  className,
}: ScatterChartProps) {
  const resolvedXLabel = xLabel ?? xAxisLabel;
  const resolvedYLabel = yLabel ?? yAxisLabel;
  return (
    <ChartContainer
      title={title}
      height={height}
      loading={loading}
      empty={data.length === 0}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridColor}
          />
          <XAxis
            dataKey={xKey}
            name={resolvedXLabel ?? xKey}
            tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
            axisLine={{ stroke: CHART_THEME.gridColor }}
            tickLine={false}
            label={
              resolvedXLabel
                ? {
                    value: resolvedXLabel,
                    position: "insideBottom",
                    offset: -5,
                    fill: CHART_THEME.textColor,
                    fontSize: 11,
                  }
                : undefined
            }
          />
          <YAxis
            dataKey={yKey}
            name={resolvedYLabel ?? yKey}
            tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={
              resolvedYLabel
                ? {
                    value: resolvedYLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: CHART_THEME.textColor,
                    fontSize: 11,
                  }
                : undefined
            }
          />
          {zKey && <ZAxis dataKey={zKey} range={[20, 200]} />}
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: "8px",
              color: CHART_THEME.tooltipText,
              fontSize: "12px",
            }}
            cursor={{ strokeDasharray: "3 3" }}
          />
          <Scatter data={data} fill={CHART_COLORWAY[0]}>
            {data.map((entry, index) => {
              let fill: string;
              if (colorKey) {
                const colorValue = String(entry[colorKey] ?? "");
                fill = colorMap?.[colorValue] ?? CHART_COLORWAY[index % CHART_COLORWAY.length];
              } else if (entry.color) {
                fill = String(entry.color);
              } else {
                fill = CHART_COLORWAY[index % CHART_COLORWAY.length];
              }
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Scatter>
        </RechartsScatterChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
