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
        "group relative rounded-lg border border-[#1E293B] bg-[#0F1629] p-4",
        "transition-all duration-200 hover:border-[#334155] hover:-translate-y-[1px]",
        className
      )}
      style={{
        ...(accentColor
          ? {
              borderLeftWidth: "3px",
              borderLeftColor: accentColor,
              backgroundColor: `color-mix(in srgb, ${accentColor} 4%, #0F1629)`,
            }
          : {}),
      }}
    >
      {/* Top row: icon + label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="text-[#64748B]"
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
                    <HelpCircle className="h-3 w-3 text-[#475569]" />
                  </span>
                }
              />
              <TooltipContent
                side="top"
                className="max-w-[260px] bg-[#1E293B] border-[#334155] text-[#F8FAFC] text-xs"
              >
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8]">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[32px] font-bold font-mono leading-none tracking-tight"
          style={{
            color: accentColor ?? "#F8FAFC",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-[#94A3B8] font-mono">{suffix}</span>
        )}
      </div>

      {/* Delta */}
      {normalizedDelta && (
        <div className="mt-2 flex items-center gap-1 text-[11px]">
          {normalizedDelta.value != null && (
            <span
              className={
                normalizedDelta.value >= 0
                  ? "text-[#22C55E]"
                  : "text-[#EF4444]"
              }
            >
              {normalizedDelta.value >= 0 ? "\u2191" : "\u2193"}{" "}
              {Math.abs(normalizedDelta.value)}
            </span>
          )}
          {normalizedDelta.label && (
            <span className="text-[#64748B]">{normalizedDelta.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
