"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BreakdownBlock } from "@/lib/supabase/queries/data-breakdown";
import { formatNumber } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";

interface DataBreakdownChartProps {
  block: BreakdownBlock;
  defaultExpanded?: boolean;
}

/**
 * Single horizontal stacked bar showing how a count breaks down across segments.
 * Hover any segment to see its exact count + share + description. Each block
 * also prints the source query text and a reconciliation row so the user can
 * verify the segments sum to the headline.
 */
export function DataBreakdownChart({ block, defaultExpanded = false }: DataBreakdownChartProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = block.total;
  const driftClean = block.reconciliation && block.reconciliation.drift === 0;

  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F7F7F4]"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#6B6B60]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[#6B6B60]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{block.title}</h3>
            <span className="text-[11px] uppercase tracking-wider text-[#9C9C90]">
              by {block.groupBy}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className="font-bold text-[#1A1A1A]"
              style={{ fontFamily: "var(--font-mono), JetBrains Mono, monospace", fontSize: 22 }}
            >
              {formatNumber(total)}
            </span>
            <span className="text-[11px] text-[#6B6B60]">{block.unit}</span>
            {block.reconciliation && (
              <span
                className={cn(
                  "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  driftClean
                    ? "bg-[#2D8B4E]/10 text-[#2D8B4E]"
                    : "bg-[#D4920B]/10 text-[#D4920B]"
                )}
              >
                {driftClean ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Reconciled
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    Drift {block.reconciliation.drift > 0 ? "+" : ""}
                    {formatNumber(block.reconciliation.drift)}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Bar (always visible) */}
      <div className="px-4 pb-3">
        <div
          className="relative h-7 w-full overflow-hidden rounded-md border border-[#E8E5DE] bg-[#F7F7F4]"
          role="img"
          aria-label={`Breakdown bar for ${block.title}`}
        >
          {block.segments.map((seg, i) => {
            const widthPct = total > 0 ? (seg.count / total) * 100 : 0;
            return (
              <div
                key={`${seg.label}-${i}`}
                className="float-left h-full transition-opacity"
                style={{
                  width: `${widthPct}%`,
                  background: seg.color,
                  opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.4,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                title={`${seg.label}: ${formatNumber(seg.count)} (${widthPct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Hovered segment readout */}
        <div className="mt-2 min-h-[18px] text-[11px] text-[#6B6B60]">
          {hoveredIdx !== null && block.segments[hoveredIdx] && (
            <>
              <span
                className="font-semibold"
                style={{ color: block.segments[hoveredIdx].color }}
              >
                {block.segments[hoveredIdx].label}
              </span>
              {": "}
              <span className="font-semibold text-[#1A1A1A]">
                {formatNumber(block.segments[hoveredIdx].count)}
              </span>
              {" "}
              ({((block.segments[hoveredIdx].count / total) * 100).toFixed(1)}%)
              {block.segments[hoveredIdx].description && (
                <>
                  {" — "}
                  <span className="italic">{block.segments[hoveredIdx].description}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded body — full breakdown table + source */}
      {expanded && (
        <div className="border-t border-[#E8E5DE] bg-[#FAFAF7] px-4 py-3">
          {/* Source */}
          <div className="mb-3 flex items-start gap-2">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9C9C90]" />
            <div className="flex-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
                Source
              </div>
              <code className="mt-0.5 block rounded bg-white px-2 py-1 font-mono text-[11px] text-[#1A1A1A] border border-[#E8E5DE]">
                {block.source}
              </code>
            </div>
          </div>

          {/* Surfaced on */}
          {block.surfacedOn.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
                Surfaced on
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {block.surfacedOn.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded bg-white px-2 py-0.5 text-[10px] text-[#6B6B60] border border-[#E8E5DE]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Per-segment table */}
          <div className="rounded border border-[#E8E5DE] bg-white">
            <table className="w-full text-[12px]">
              <thead className="border-b border-[#E8E5DE] bg-[#F7F7F4]">
                <tr>
                  <th className="w-[1px] px-2 py-1.5 text-left" />
                  <th className="px-2 py-1.5 text-left font-semibold text-[#6B6B60]">
                    Segment
                  </th>
                  <th className="px-2 py-1.5 text-right font-semibold text-[#6B6B60]">
                    Count
                  </th>
                  <th className="px-2 py-1.5 text-right font-semibold text-[#6B6B60]">
                    Share
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold text-[#6B6B60]">
                    Definition
                  </th>
                </tr>
              </thead>
              <tbody>
                {block.segments.map((seg, i) => (
                  <tr
                    key={`${seg.label}-${i}`}
                    className={cn(
                      "border-b border-[#E8E5DE] last:border-b-0",
                      i % 2 === 1 && "bg-[#FAFAF7]"
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ background: seg.color }}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-[#1A1A1A]">
                      {seg.label}
                    </td>
                    <td
                      className="px-2 py-1.5 text-right font-semibold"
                      style={{ fontFamily: "var(--font-mono), JetBrains Mono, monospace" }}
                    >
                      {formatNumber(seg.count)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[#6B6B60]">
                      {total > 0 ? `${((seg.count / total) * 100).toFixed(1)}%` : "--"}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-[#6B6B60]">
                      {seg.description ?? "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#E8E5DE] bg-[#F7F7F4]">
                <tr>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
                    Total
                  </td>
                  <td
                    className="px-2 py-1.5 text-right font-bold text-[#1A1A1A]"
                    style={{ fontFamily: "var(--font-mono), JetBrains Mono, monospace" }}
                  >
                    {formatNumber(total)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-[#1A1A1A]">
                    100.0%
                  </td>
                  <td className="px-2 py-1.5" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Reconciliation note */}
          {block.reconciliation && (
            <div
              className={cn(
                "mt-3 rounded-md border px-3 py-2 text-[11px]",
                driftClean
                  ? "border-[#2D8B4E]/20 bg-[#2D8B4E]/5 text-[#2D8B4E]"
                  : "border-[#D4920B]/30 bg-[#D4920B]/5 text-[#D4920B]"
              )}
            >
              <strong>{driftClean ? "✓ Reconciled: " : "⚠ Drift: "}</strong>
              {block.reconciliation.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
