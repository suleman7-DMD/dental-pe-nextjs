"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { CHART_THEME, CHART_COLORWAY } from "@/lib/constants/colors";
import { ChartContainer } from "./chart-container";

interface BarChartProps {
  /** Accepts either { name, value } or generic records with xKey/yKey. */
  data: Record<string, unknown>[];
  height?: number;
  title?: string;
  loading?: boolean;
  color?: string;
  /** Alias for color */
  barColor?: string;
  colorByIndex?: boolean;
  /** Original prop: "horizontal" means bars go left-to-right, "vertical" means bars go bottom-up. */
  layout?: "horizontal" | "vertical";
  /** Alias: when true, renders horizontal bars (layout="vertical" in Recharts terms). */
  horizontal?: boolean;
  /** Alias for horizontal/layout — "horizontal" = bars go left-to-right */
  orientation?: "horizontal" | "vertical";
  showGrid?: boolean;
  /** Key for the category axis (defaults to "name", also maps "label" automatically). */
  xKey?: string;
  /** Key for the value axis (defaults to "value"). */
  yKey?: string;
  /** X-axis label */
  xLabel?: string;
  /** Alias for xLabel */
  xAxisLabel?: string;
  /** Y-axis label */
  yAxisLabel?: string;
  /** Show value labels on bars */
  showValues?: boolean;
  /** Custom tooltip formatter (accepted for API compat) */
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  tooltipFormat?: (d: any) => string;
  /** X-axis range [min, max] */
  xRange?: [number, number];
  /** Color scale config for gradient coloring */
  colorScale?: {
    type: string;
    min: number;
    max: number;
    colors: string[];
  };
  className?: string;
}

export function BarChart({
  data,
  height = 300,
  title,
  loading = false,
  color,
  barColor,
  colorByIndex = false,
  layout,
  horizontal,
  orientation,
  showGrid = true,
  xKey,
  yKey = "value",
  xLabel,
  xAxisLabel,
  showValues = false,
  tooltipFormat: _tooltipFormat,
  xRange,
  colorScale,
  yAxisLabel,
  className,
}: BarChartProps) {
  const resolvedColor = color ?? barColor ?? CHART_COLORWAY[0];

  // Resolve layout:
  // - `horizontal` prop or `orientation="horizontal"` means bars go left-to-right
  //   which is Recharts' "vertical" layout
  // - `orientation="vertical"` means normal vertical bars = Recharts "horizontal" layout
  // - `layout` prop uses Recharts convention directly
  const isHorizontalBars = horizontal || orientation === "horizontal";
  const isVerticalBars = orientation === "vertical";
  const resolvedLayout = layout
    ? layout
    : isHorizontalBars
      ? "vertical"
      : isVerticalBars
        ? "horizontal"
        : "vertical"; // default to horizontal bars (Recharts "vertical")

  // Resolve x-axis label
  const resolvedXLabel = xLabel ?? xAxisLabel;

  // Resolve xKey: auto-detect "label" if data has it but not "name"
  const resolvedXKey = xKey ?? (data.length > 0 && "label" in data[0] && !("name" in data[0]) ? "label" : "name");

  // Color scale interpolation helper
  function getBarColor(entry: Record<string, unknown>, index: number): string {
    if (entry.color) return entry.color as string;
    if (colorByIndex) return CHART_COLORWAY[index % CHART_COLORWAY.length];
    if (colorScale && colorScale.colors.length >= 2) {
      const val = Number(entry[yKey] ?? 0);
      const ratio = Math.min(1, Math.max(0, (val - colorScale.min) / (colorScale.max - colorScale.min || 1)));
      // Simple 3-stop interpolation
      const colors = colorScale.colors;
      if (colors.length === 3) {
        const midRatio = ratio <= 0.5 ? ratio * 2 : (ratio - 0.5) * 2;
        const fromIdx = ratio <= 0.5 ? 0 : 1;
        const toIdx = ratio <= 0.5 ? 1 : 2;
        const from = colors[fromIdx];
        const to = colors[toIdx];
        // Parse hex
        const fr = parseInt(from.slice(1, 3), 16);
        const fg = parseInt(from.slice(3, 5), 16);
        const fb = parseInt(from.slice(5, 7), 16);
        const tr = parseInt(to.slice(1, 3), 16);
        const tg = parseInt(to.slice(3, 5), 16);
        const tb = parseInt(to.slice(5, 7), 16);
        const r = Math.round(fr + (tr - fr) * midRatio);
        const g = Math.round(fg + (tg - fg) * midRatio);
        const b = Math.round(fb + (tb - fb) * midRatio);
        return `rgb(${r},${g},${b})`;
      }
    }
    return resolvedColor;
  }

  return (
    <ChartContainer
      title={title}
      height={height}
      loading={loading}
      empty={data.length === 0}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={resolvedLayout}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_THEME.gridColor}
              vertical={resolvedLayout === "vertical"}
              horizontal={resolvedLayout === "horizontal"}
            />
          )}

          {resolvedLayout === "vertical" ? (
            <>
              <XAxis
                type="number"
                domain={xRange ?? undefined}
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={{ stroke: CHART_THEME.gridColor }}
                tickLine={false}
                label={
                  resolvedXLabel
                    ? {
                        value: resolvedXLabel,
                        position: "insideBottom",
                        offset: -2,
                        fill: CHART_THEME.textColor,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
              <YAxis
                dataKey={resolvedXKey}
                type="category"
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={resolvedXKey}
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={{ stroke: CHART_THEME.gridColor }}
                tickLine={false}
              />
              <YAxis
                type="number"
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={
                  yAxisLabel
                    ? {
                        value: yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                        fill: CHART_THEME.textColor,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
            </>
          )}

          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: "8px",
              color: CHART_THEME.tooltipText,
              fontSize: "12px",
            }}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
          />

          <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry, index)}
              />
            ))}
            {showValues && (
              <LabelList
                dataKey={yKey}
                position={resolvedLayout === "vertical" ? "right" : "top"}
                fill={CHART_THEME.textColor}
                fontSize={10}
              />
            )}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
