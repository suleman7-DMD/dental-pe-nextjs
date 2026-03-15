"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  maxDisplay?: number;
  className?: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select...",
  maxDisplay = 2,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(options.map((o) => o.value));

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[0.7rem] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] text-xs h-9"
        >
          <div className="flex items-center gap-1 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-[var(--text-muted)]">{placeholder}</span>
            ) : selected.length <= maxDisplay ? (
              selected.map((v) => {
                const opt = options.find((o) => o.value === v);
                return (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="text-[0.65rem] bg-[var(--bg-card)] text-[var(--text-secondary)] px-1.5 py-0"
                  >
                    {opt?.label ?? v}
                  </Badge>
                );
              })
            ) : (
              <Badge
                variant="secondary"
                className="text-[0.65rem] bg-[var(--bg-card)] text-[var(--text-secondary)] px-1.5 py-0"
              >
                {selected.length} selected
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-[220px] p-0 bg-[var(--bg-card)] border-[var(--border)]"
          align="start"
        >
          <div className="p-2 border-b border-[var(--border)]">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
          <div className="flex gap-1 px-2 py-1.5 border-b border-[var(--border)]">
            <button
              onClick={selectAll}
              className="text-[0.65rem] text-[var(--accent-blue)] hover:underline"
            >
              All
            </button>
            <span className="text-[var(--text-muted)]">|</span>
            <button
              onClick={clearAll}
              className="text-[0.65rem] text-[var(--accent-red)] hover:underline"
            >
              None
            </button>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="p-1">
              {filtered.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected.includes(option.value)
                        ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]"
                        : "border-[var(--border)]"
                    )}
                  >
                    {selected.includes(option.value) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  {option.label}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-0.5 text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--accent-red)]"
        >
          <X className="h-2.5 w-2.5" />
          Clear
        </button>
      )}
    </div>
  );
}
