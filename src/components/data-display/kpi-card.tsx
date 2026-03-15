"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export interface KpiCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  /** Delta can be a number (raw change) or an object { value, label }. */
  delta?: number | null | { value: number; label?: string };
  /** Standalone label for the delta when delta is passed as a number. */
  deltaLabel?: string;
  /** Small text displayed after the value. */
  suffix?: string;
  tooltip?: string;
  accentColor?: string;
  className?: string;
  /** Secondary line rendered below the value (e.g. tiered consolidation detail). */
  subtitle?: React.ReactNode;
}

export function KpiCard({
  icon,
  label,
  value,
  delta,
  deltaLabel,
  suffix,
  tooltip,
  accentColor,
  className,
  subtitle,
}: KpiCardProps) {
  // Normalize delta to { value, label } or null
  const normalizedDelta = useMemo(() => {
    if (delta == null) return null;
    if (typeof delta === "number") return { value: delta, label: deltaLabel };
    return { ...delta, label: delta.label ?? deltaLabel };
  }, [delta, deltaLabel]);

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4 px-5",
        "transition-all duration-200 hover:border-[#D4D0C8] hover:-translate-y-[1px]",
        className
      )}
      style={{
        ...(accentColor
          ? {
              borderLeftWidth: "3px",
              borderLeftColor: accentColor,
              backgroundColor: `color-mix(in srgb, ${accentColor} 4%, #FFFFFF)`,
            }
          : {}),
      }}
    >
      {/* Top row: icon + label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="text-[#6B6B60]"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {typeof icon === "string" ? (
              <span className="text-sm">{icon}</span>
            ) : (
              <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
            )}
          </div>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger
                delay={200}
                render={
                  <span className="cursor-help">
                    <HelpCircle className="h-3 w-3 text-[#B5B5A8]" />
                  </span>
                }
              />
              <TooltipContent
                side="top"
                className="max-w-[260px] bg-[#FFFFFF] border-[#D4D0C8] text-[#1A1A1A] text-xs shadow-md"
              >
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B6B60]">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[28px] font-bold font-mono leading-none tracking-tight"
          style={{
            color: accentColor ?? "#1A1A1A",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-[#6B6B60] font-mono">{suffix}</span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && <div className="mt-1.5">{subtitle}</div>}

      {/* Delta */}
      {normalizedDelta && (
        <div className="mt-2 flex items-center gap-1 text-[11px]">
          {normalizedDelta.value != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
                normalizedDelta.value >= 0
                  ? "bg-[#2D8B4E]/10 text-[#2D8B4E]"
                  : "bg-[#C23B3B]/10 text-[#C23B3B]"
              )}
            >
              {normalizedDelta.value >= 0 ? "\u2191" : "\u2193"}{" "}
              {Math.abs(normalizedDelta.value)}
            </span>
          )}
          {normalizedDelta.label && (
            <span className="text-[#9C9C90]">{normalizedDelta.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
