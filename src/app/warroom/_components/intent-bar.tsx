"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  Lightbulb,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  INTENT_PRESETS,
  emptyIntent,
  intentHasFilters,
  parseIntent,
} from "@/lib/warroom/intent"
import type { WarroomIntent } from "@/lib/warroom/signals"

interface IntentBarProps {
  value: string
  onChange: (value: string) => void
  onIntentSubmit: (intent: WarroomIntent) => void
  onReset?: () => void
  className?: string
  autoFocus?: boolean
  pendingHint?: string
  disabled?: boolean
}

export function IntentBar({
  value,
  onChange,
  onIntentSubmit,
  onReset,
  className,
  autoFocus,
  pendingHint,
  disabled,
}: IntentBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showPresets, setShowPresets] = useState(false)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const debouncedValue = useDebouncedValue(value, 120)
  const parsed = useMemo<WarroomIntent>(
    () => (debouncedValue.trim() ? parseIntent(debouncedValue) : emptyIntent()),
    [debouncedValue]
  )

  const handleSubmit = useCallback(
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.()
      if (!value.trim()) return
      onIntentSubmit(parsed.rawText ? parsed : parseIntent(value))
      setShowPresets(false)
    },
    [onIntentSubmit, parsed, value]
  )

  const handlePreset = useCallback(
    (query: string) => {
      onChange(query)
      onIntentSubmit(parseIntent(query))
      setShowPresets(false)
      inputRef.current?.focus()
    },
    [onChange, onIntentSubmit]
  )

  const recognized = useMemo(() => parsed.chips, [parsed])
  const hasFilters = useMemo(() => intentHasFilters(parsed), [parsed])

  return (
    <section
      className={cn(
        "rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]",
        className
      )}
      aria-label="Intent command bar"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-2 h-4 w-4 shrink-0 text-[#B8860B]" />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => setShowPresets(value.length === 0)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  onReset?.()
                  setShowPresets(false)
                }
              }}
              placeholder={pendingHint ?? "Ask in plain English — e.g. “top 25 acquisition targets in SW suburbs, no PE exposure, retirement risk”"}
              disabled={disabled}
              className="h-10 w-full rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 pr-24 text-sm text-[#1A1A1A] outline-none transition-colors placeholder:text-[#8F8E82] hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20 disabled:opacity-50"
              aria-label="Describe the targets you want"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-[11px] text-[#8F8E82]">
              <span className="rounded border border-[#E8E5DE] bg-[#F7F7F4] px-1 font-mono">⏎</span>
              <span>to hunt</span>
            </div>
          </div>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange("")
                onReset?.()
              }}
              className="inline-flex h-9 items-center rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-xs text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
              aria-label="Clear intent"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#B8860B] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#9C7324] disabled:opacity-40"
          >
            Hunt
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recognized.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recognized.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-0.5 text-[11px] text-[#B8860B]"
              >
                {chip.label}
              </span>
            ))}
            {hasFilters && (
              <span className="inline-flex items-center rounded-full border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-0.5 text-[11px] text-[#6B6B60]">
                {recognized.length} recognized token{recognized.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {parsed.warnings.length > 0 && (
          <div className="flex flex-col gap-1">
            {parsed.warnings.map((warning, index) => (
              <p
                key={`${warning}-${index}`}
                className="inline-flex items-center gap-1 text-[11px] text-[#C23B3B]"
              >
                <AlertCircle className="h-3 w-3" />
                {warning}
              </p>
            ))}
          </div>
        )}
      </form>

      {(showPresets || value.length === 0) && (
        <div className="border-t border-[#E8E5DE] bg-[#FAFAF7] px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#707064]">
            <Lightbulb className="h-3 w-3 text-[#D4920B]" />
            Try a preset
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INTENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset.query)}
                className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#1A1A1A] transition-colors hover:border-[#B8860B] hover:text-[#B8860B]"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])
  return debounced
}
