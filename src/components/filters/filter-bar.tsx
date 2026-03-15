"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronDown, X } from "lucide-react";

interface FilterBarProps {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
}

export function FilterBar({ children, onReset, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3",
        className
      )}
    >
      {children}
      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  );
}

/* ── FilterGroup: labeled wrapper for a single filter control ─────────── */

interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterGroup({ label, children, className }: FilterGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[0.7rem] font-medium uppercase tracking-wider text-[var(--text-muted,#94A3B8)]">
        {label}
      </span>
      {children}
    </div>
  );
}

/* ── MultiSelect: dropdown with checkboxes for multi-value filters ────── */

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "All",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} selected`;

  return (
    <div ref={ref} className={cn("relative min-w-[140px]", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm",
          "border-[var(--border,#1E293B)] bg-[var(--bg-card,#0F1629)] text-[var(--text-primary,#F8FAFC)]",
          "hover:border-[var(--border-hover,#2A3A4E)] transition-colors"
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange([]);
          }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent,#EF4444)] text-white"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[180px] overflow-auto rounded-md border border-[var(--border,#1E293B)] bg-[var(--bg-card,#0F1629)] py-1 shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-muted,#94A3B8)]">
              No options
            </div>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--bg-hover,#1E293B)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="h-3.5 w-3.5 rounded border-[var(--border,#1E293B)] accent-[var(--accent,#4FC3F7)]"
                />
                <span className="truncate text-[var(--text-primary,#F8FAFC)]">
                  {opt}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
