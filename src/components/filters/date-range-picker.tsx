"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface DateRangePickerProps {
  label?: string;
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  className?: string;
}

export function DateRangePicker({
  label,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="text-[0.7rem] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartChange(e.target.value)}
            className="pl-8 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] text-xs h-9"
          />
        </div>
        <span className="text-xs text-[var(--text-muted)]">to</span>
        <div className="relative flex-1">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndChange(e.target.value)}
            className="pl-8 bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] text-xs h-9"
          />
        </div>
      </div>
    </div>
  );
}
