"use client";

import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
  BarChart,
} from "recharts";
import { CHART_THEME, CHART_COLORWAY } from "@/lib/constants/colors";
import { ChartContainer } from "./chart-container";

interface VerticalLineConfig {
  x: number | string;
  color?: string;
  dash?: boolean;
  label?: string;
}

interface HistogramChartProps {
  /** Original format: {bin, count, line?} */
  data: Record<string, unknown>[];
  height?: number;
  title?: string;
  loading?: boolean;
  color?: string;
  showLine?: boolean;
  lineColor?: string;
  /** X-axis data field (defaults to "bin") */
  xField?: string;
  /** Field that determines color grouping for stacked bars */
  colorField?: string;
  /** Map of colorField values to colors */
  colorMap?: Record<string, string>;
  /** Order of categories in the stack */
  categoryOrder?: string[];
  /** X-axis label */
  xAxisLabel?: string;
  /** Y-axis label */
  yAxisLabel?: string;
  /** Whether bars should be stacked */
  stacked?: boolean;
  /** Vertical reference lines */
  verticalLines?: VerticalLineConfig[];
  className?: string;
}

export function HistogramChart({
  data: rawData,
  height = 300,
  title,
  loading = false,
  color = CHART_COLORWAY[0],
  showLine = false,
  lineColor = CHART_COLORWAY[2],
  xField = "bin",
  colorField,
  colorMap = {},
  categoryOrder,
  xAxisLabel,
  yAxisLabel,
  stacked = false,
  verticalLines,
  className,
}: HistogramChartProps) {
  // If colorField is specified, we need to pivot the data for stacked bars
  let chartData: Record<string, unknown>[];
  let stackKeys: string[] = [];

  if (colorField && stacked) {
    // Group raw data by xField, then by colorField
    const groups = new Map<string | number, Record<string, number>>();
    const categories = new Set<string>();

    for (const row of rawData) {
      const x = row[xField] as string | number;
      const cat = String(row[colorField] ?? "Other");
      categories.add(cat);

      if (!groups.has(x)) {
        groups.set(x, {});
      }
      const g = groups.get(x)!;
      g[cat] = (g[cat] ?? 0) + 1;
    }

    stackKeys = categoryOrder
      ? categoryOrder.filter((c) => categories.has(c))
      : Array.from(categories).sort();

    chartData = Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([x, counts]) => ({
        [xField]: x,
        ...counts,
      }));
  } else {
    chartData = rawData;
  }

  const isStacked = stackKeys.length > 0;
  const useComposed = showLine || (verticalLines && verticalLines.length > 0);
  const ChartComp = useComposed ? ComposedChart : BarChart;

  return (
    <ChartContainer
      title={title}
      height={height}
      loading={loading}
      empty={chartData.length === 0}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ChartComp
          data={chartData}
          margin={{ top: 5, right: 20, left: 10, bottom: xAxisLabel ? 25 : 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridColor}
          />
          <XAxis
            dataKey={xField}
            tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
            axisLine={{ stroke: CHART_THEME.gridColor }}
            tickLine={false}
            label={
              xAxisLabel
                ? {
                    value: xAxisLabel,
                    position: "insideBottom",
                    offset: -15,
                    fill: CHART_THEME.textColor,
                    fontSize: 11,
                  }
                : undefined
            }
          />
          <YAxis
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
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: "8px",
              color: CHART_THEME.tooltipText,
              fontSize: "12px",
            }}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
          />

          {isStacked
            ? stackKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="stack"
                  fill={colorMap[key] ?? CHART_COLORWAY[i % CHART_COLORWAY.length]}
                  radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={40}
                />
              ))
            : (
                <Bar
                  dataKey="count"
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              )}

          {showLine && (
            <Line
              type="monotone"
              dataKey="line"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
            />
          )}

          {verticalLines?.map((vl, i) => (
            <ReferenceLine
              key={`vl-${i}`}
              x={vl.x}
              stroke={vl.color ?? "#FF3D00"}
              strokeDasharray={vl.dash ? "6 3" : undefined}
              label={
                vl.label
                  ? {
                      value: vl.label,
                      position: "top",
                      fill: vl.color ?? "#FF3D00",
                      fontSize: 10,
                    }
                  : undefined
              }
            />
          ))}
        </ChartComp>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
