"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { CHART_THEME, CHART_COLORWAY } from "@/lib/constants/colors";
import { ChartContainer } from "./chart-container";

export interface StackedBarChartProps {
  data: Record<string, unknown>[];
  /** Original prop: array of { key, color?, name? } */
  dataKeys?: { key: string; color?: string; name?: string }[];
  /** Original prop: x-axis data key */
  xAxisKey?: string;
  /** Alias for xAxisKey used by some page agents */
  xKey?: string;
  /** Alias for dataKeys with label instead of name */
  series?: { key: string; label: string; color: string }[];
  /** Optional overlay line data key */
  lineKey?: string;
  /** Label for the overlay line */
  lineLabel?: string;
  /** Color for the overlay line */
  lineColor?: string;
  /** Y-axis label */
  yLabel?: string;
  /** X-axis label (alias) */
  xAxisLabel?: string;
  /** Orientation alias: "horizontal" = horizontal bars */
  orientation?: "horizontal" | "vertical";
  /** Manual legend items */
  legendItems?: { key: string; color: string }[];
  height?: number;
  title?: string;
  loading?: boolean;
  layout?: "horizontal" | "vertical";
  showLegend?: boolean;
  stacked?: boolean;
  className?: string;
}

export function StackedBarChart({
  data: rawData,
  dataKeys,
  xAxisKey,
  xKey,
  series,
  lineKey,
  lineLabel,
  lineColor = "#1A1A1A",
  yLabel,
  xAxisLabel,
  orientation,
  legendItems,
  height = 300,
  title,
  loading = false,
  layout = "horizontal",
  showLegend = true,
  stacked: _stacked,
  className,
}: StackedBarChartProps) {
  // If data uses {label, segments} format, flatten it for Recharts
  const isSegmentFormat =
    rawData.length > 0 && "segments" in rawData[0] && Array.isArray(rawData[0].segments);

  let data: Record<string, unknown>[];
  let autoKeys: { key: string; color?: string; name?: string }[] = [];

  if (isSegmentFormat) {
    // Flatten {label, segments: [{key, value, color}]} into {label, key1: val, key2: val, ...}
    const segKeySet = new Set<string>();
    const segColorMap: Record<string, string> = {};
    data = rawData.map((row) => {
      const flat: Record<string, unknown> = { label: row.label };
      const segs = row.segments as { key: string; value: number; color: string }[];
      for (const s of segs) {
        flat[s.key] = s.value;
        segKeySet.add(s.key);
        segColorMap[s.key] = s.color;
      }
      return flat;
    });
    autoKeys = Array.from(segKeySet).map((k) => ({
      key: k,
      color: segColorMap[k],
      name: k,
    }));
  } else {
    data = rawData;
  }

  // Resolve layout/orientation
  const resolvedLayout =
    orientation === "horizontal" ? "vertical" : layout;

  // Normalize: prefer series/xKey aliases, fall back to original props
  const resolvedXKey = xKey ?? xAxisKey ?? (isSegmentFormat ? "label" : "name");
  const resolvedKeys: { key: string; color?: string; name?: string }[] =
    series
      ? series.map((s) => ({ key: s.key, color: s.color, name: s.label }))
      : dataKeys ?? autoKeys;

  const hasLine = lineKey && data.length > 0 && lineKey in (data[0] ?? {});

  // Use ComposedChart when we need a line overlay, otherwise plain BarChart
  const ChartComponent = hasLine ? ComposedChart : BarChart;

  return (
    <ChartContainer
      title={title}
      height={height}
      loading={loading}
      empty={data.length === 0}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={data}
          layout={resolvedLayout}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridColor}
          />
          {resolvedLayout === "horizontal" ? (
            <>
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
                label={
                  yLabel
                    ? {
                        value: yLabel,
                        angle: -90,
                        position: "insideLeft",
                        fill: CHART_THEME.textColor,
                        fontSize: 11,
                      }
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                axisLine={{ stroke: CHART_THEME.gridColor }}
                tickLine={false}
                label={
                  xAxisLabel
                    ? {
                        value: xAxisLabel,
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
                width={100}
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
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "11px", color: CHART_THEME.textColor }}
              iconType="rect"
              iconSize={10}
            />
          )}
          {resolvedKeys.map((dk, i) => (
            <Bar
              key={dk.key}
              dataKey={dk.key}
              name={dk.name ?? dk.key}
              stackId="stack"
              fill={dk.color ?? CHART_COLORWAY[i % CHART_COLORWAY.length]}
              radius={
                i === resolvedKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
              }
              maxBarSize={40}
            />
          ))}
          {hasLine && (
            <Line
              type="monotone"
              dataKey={lineKey}
              name={lineLabel ?? lineKey}
              stroke={lineColor}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
