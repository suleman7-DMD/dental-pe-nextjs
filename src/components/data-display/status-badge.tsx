"use client";

import { cn } from "@/lib/utils";
import { formatStatus } from "@/lib/utils/formatting";

interface StatusBadgeProps {
  status: string | null;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({
  status,
  className,
  showDot = true,
}: StatusBadgeProps) {
  const { label, dotClass } = formatStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        className
      )}
    >
      {showDot && (
        <span className={cn("inline-block h-2 w-2 rounded-full", dotClass)} />
      )}
      <span>{label}</span>
    </span>
  );
}
