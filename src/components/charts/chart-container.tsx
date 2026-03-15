"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartContainerProps {
  title?: string;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: React.ReactNode;
}

export function ChartContainer({
  title,
  height = 300,
  loading = false,
  empty = false,
  emptyMessage = "No data available",
  className,
  children,
}: ChartContainerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4",
        className
      )}
    >
      {title && (
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {title}
        </h4>
      )}

      {loading ? (
        <div className="space-y-2" style={{ height }}>
          <Skeleton className="h-full w-full bg-[var(--bg-surface)]" />
        </div>
      ) : empty ? (
        <div
          className="flex items-center justify-center text-sm text-[var(--text-muted)]"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}
