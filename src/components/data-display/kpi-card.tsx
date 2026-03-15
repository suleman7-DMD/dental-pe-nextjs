"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowUp, ArrowDown, HelpCircle } from "lucide-react";

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
  const normalizedDelta =
    delta === null || delta === undefined
      ? null
      : typeof delta === "number"
        ? { value: delta, label: deltaLabel }
        : { ...delta, label: delta.label ?? deltaLabel };

  return (
    <div
      className={cn(
        "relative rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4",
        "transition-all duration-200 hover:border-[var(--border-hover)] hover:-translate-y-0.5",
        "shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
          <span className="text-[0.78rem] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            {label}
          </span>
        </div>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger
              delay={200}
              render={
                <span className="cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </span>
              }
            />
            <TooltipContent
              side="top"
              className="max-w-[260px] bg-[var(--bg-card-hover)] border-[var(--border-hover)] text-[var(--text-primary)] text-xs"
            >
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-2">
        <span
          className="text-[1.7rem] font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-mono)", color: accentColor }}
        >
          {value}
        </span>
        {suffix && (
          <span className="ml-1.5 text-sm text-[var(--text-muted)]">
            {suffix}
          </span>
        )}
      </div>

      {normalizedDelta && (
        <div className="mt-1 flex items-center gap-1">
          {normalizedDelta.value >= 0 ? (
            <ArrowUp className="h-3 w-3 text-[var(--accent-green)]" />
          ) : (
            <ArrowDown className="h-3 w-3 text-[var(--accent-red)]" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              normalizedDelta.value >= 0
                ? "text-[var(--accent-green)]"
                : "text-[var(--accent-red)]"
            )}
          >
            {Math.abs(normalizedDelta.value).toFixed(1)}%
            {normalizedDelta.label && (
              <span className="ml-1 text-[var(--text-muted)]">
                {normalizedDelta.label}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
