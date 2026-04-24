"use client"

import { useCallback, useMemo } from "react"
import {
  Building2,
  CheckSquare,
  Crosshair,
  Flag,
  Gauge,
  Layers,
  RotateCcw,
  Square,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ENTITY_CLASSIFICATION_LABELS,
  OWNERSHIP_GROUP_LABELS,
  PRACTICE_FLAG_LABELS,
  WARROOM_TIER_FLOOR_OPTIONS,
  ZIP_FLAG_LABELS,
  buildIntentFromFilter,
  createEmptyFilter,
  filterHasContent,
} from "@/lib/warroom/intent"
import type {
  OwnershipGroup,
  WarroomIntent,
  WarroomIntentFilter,
} from "@/lib/warroom/signals"

interface HuntModePanelProps {
  filter: WarroomIntentFilter
  onFilterChange: (next: WarroomIntentFilter) => void
  matchingCount: number
  totalCandidateCount: number | null
  onReset?: () => void
  className?: string
}

const OWNERSHIP_OPTIONS: { value: OwnershipGroup; hint: string }[] = [
  { value: "independent", hint: "solo_*, family, groups" },
  { value: "corporate", hint: "dso_regional, dso_national" },
  { value: "specialist", hint: "ortho, endo, perio, oms, pedo" },
  { value: "non_clinical", hint: "labs, supply, billing" },
  { value: "unknown", hint: "classification missing" },
]

const ENTITY_CLASSIFICATION_ORDER: string[] = [
  "solo_established",
  "solo_new",
  "solo_inactive",
  "solo_high_volume",
  "family_practice",
  "small_group",
  "large_group",
  "dso_regional",
  "dso_national",
  "specialist",
  "non_clinical",
]

const PRACTICE_FLAGS_ORDER: string[] = [
  "stealth_dso_flag",
  "phantom_inventory_flag",
  "revenue_default_flag",
  "family_dynasty_flag",
  "micro_cluster_flag",
  "intel_quant_disagreement_flag",
  "retirement_combo_flag",
  "last_change_90d_flag",
  "high_peer_buyability_flag",
  "high_peer_retirement_flag",
]

const ZIP_FLAGS_ORDER: string[] = [
  "zip_white_space_flag",
  "zip_compound_demand_flag",
  "zip_mirror_pair",
  "zip_contested_zone_flag",
  "zip_ada_benchmark_gap_flag",
]

const LIMIT_OPTIONS = [25, 50, 100, 200] as const
const CURRENT_YEAR = new Date().getFullYear()

type FlagState = "require" | "exclude" | "ignore"

function flagStateFor(
  flag: string,
  require: string[],
  exclude: string[]
): FlagState {
  if (require.includes(flag)) return "require"
  if (exclude.includes(flag)) return "exclude"
  return "ignore"
}

function setFlagState(
  filter: WarroomIntentFilter,
  flag: string,
  nextState: FlagState
): WarroomIntentFilter {
  const requireFlags = filter.requireFlags.filter((f) => f !== flag)
  const excludeFlags = filter.excludeFlags.filter((f) => f !== flag)

  if (nextState === "require") requireFlags.push(flag)
  if (nextState === "exclude") excludeFlags.push(flag)

  return { ...filter, requireFlags, excludeFlags }
}

function toggleArrayValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export function HuntModePanel({
  filter,
  onFilterChange,
  matchingCount,
  totalCandidateCount,
  onReset,
  className,
}: HuntModePanelProps) {
  const intent = useMemo<WarroomIntent>(
    () => buildIntentFromFilter(filter),
    [filter]
  )

  const hasAnyFilters = useMemo(() => filterHasContent(filter), [filter])

  const handlePatch = useCallback(
    (patch: Partial<WarroomIntentFilter>) => {
      onFilterChange({ ...filter, ...patch })
    },
    [filter, onFilterChange]
  )

  const handleFlagChange = useCallback(
    (flag: string, nextState: FlagState) => {
      onFilterChange(setFlagState(filter, flag, nextState))
    },
    [filter, onFilterChange]
  )

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset()
      return
    }
    onFilterChange(createEmptyFilter())
  }, [onFilterChange, onReset])

  return (
    <section
      className={cn(
        "rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] shadow-sm",
        className
      )}
      aria-label="Hunt mode filter builder"
    >
      <HuntPanelHeader
        chipCount={intent.chips.length}
        matchingCount={matchingCount}
        totalCandidateCount={totalCandidateCount}
        onReset={handleReset}
        hasAnyFilters={hasAnyFilters}
      />

      <div className="grid gap-x-6 gap-y-6 border-t border-[#E8E5DE] px-4 py-4 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <TargetTypeSection filter={filter} onPatch={handlePatch} />
          <MetricsSection filter={filter} onPatch={handlePatch} />
        </div>

        <div className="flex flex-col gap-6">
          <FlagSection
            title="Practice signals"
            description="Evidence on the individual practice"
            icon={Flag}
            flags={PRACTICE_FLAGS_ORDER}
            labels={PRACTICE_FLAG_LABELS}
            require={filter.requireFlags}
            exclude={filter.excludeFlags}
            onChange={handleFlagChange}
          />

          <FlagSection
            title="Market (ZIP) signals"
            description="Evidence at the ZIP/catchment level"
            icon={Layers}
            flags={ZIP_FLAGS_ORDER}
            labels={ZIP_FLAG_LABELS}
            require={filter.requireFlags}
            exclude={filter.excludeFlags}
            onChange={handleFlagChange}
          />

          <EntityClassificationSection
            values={filter.entityClassifications}
            onToggle={(ec) =>
              handlePatch({
                entityClassifications: toggleArrayValue(
                  filter.entityClassifications,
                  ec
                ),
              })
            }
          />
        </div>
      </div>

      <ActiveChipsRow
        chips={intent.chips}
        onRemoveChip={(chip) => {
          onFilterChange(applyChipRemoval(filter, chip))
        }}
      />
    </section>
  )
}

function HuntPanelHeader({
  chipCount,
  matchingCount,
  totalCandidateCount,
  onReset,
  hasAnyFilters,
}: {
  chipCount: number
  matchingCount: number
  totalCandidateCount: number | null
  onReset: () => void
  hasAnyFilters: boolean
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[#B8860B]/10 text-[#B8860B]">
          <Crosshair className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Hunt controls</h2>
          <p className="text-[11px] text-[#707064]">
            Filter the ranked target list in real time
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B60]">
        <span
          className={cn(
            "rounded-full border px-2 py-1 font-mono font-semibold",
            matchingCount === 0 && hasAnyFilters
              ? "border-[#C23B3B]/30 bg-[#C23B3B]/5 text-[#C23B3B]"
              : "border-[#B8860B]/30 bg-[#B8860B]/10 text-[#1A1A1A]"
          )}
        >
          {matchingCount}
          {totalCandidateCount != null && totalCandidateCount > matchingCount && (
            <span className="ml-1 text-[#707064]">/ {totalCandidateCount}</span>
          )}
          <span className="ml-1 text-[10px] uppercase tracking-wider text-[#707064]">
            matches
          </span>
        </span>

        <span className="rounded-full border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1 font-mono">
          {chipCount} filter{chipCount === 1 ? "" : "s"}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!hasAnyFilters}
          className="h-8 text-[#707064] hover:bg-[#F7F7F4] hover:text-[#1A1A1A] disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear all
        </Button>
      </div>
    </header>
  )
}

function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
      <Icon className="h-3.5 w-3.5 text-[#707064]" />
      <span>{title}</span>
      {hint && <span className="font-normal normal-case tracking-normal text-[#707064]">— {hint}</span>}
    </div>
  )
}

function TargetTypeSection({
  filter,
  onPatch,
}: {
  filter: WarroomIntentFilter
  onPatch: (patch: Partial<WarroomIntentFilter>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={Users} title="Target type" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[#707064]">Ownership group</span>
        <div className="flex flex-wrap gap-1.5">
          {OWNERSHIP_OPTIONS.map((option) => {
            const active = filter.ownershipGroups.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onPatch({
                    ownershipGroups: toggleArrayValue(
                      filter.ownershipGroups,
                      option.value
                    ),
                  })
                }
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-[#B8860B]/40 bg-[#B8860B]/10 text-[#1A1A1A]"
                    : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:border-[#D4D0C8] hover:text-[#1A1A1A]"
                )}
                aria-pressed={active}
                title={option.hint}
              >
                {active ? (
                  <CheckSquare className="h-3.5 w-3.5 text-[#B8860B]" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-[#8F8E82]" />
                )}
                {OWNERSHIP_GROUP_LABELS[option.value]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[#707064]">Quick targeting toggles</span>
        <div className="flex flex-wrap gap-1.5">
          <ToggleChip
            active={filter.retirementRiskOnly}
            onClick={() =>
              onPatch({ retirementRiskOnly: !filter.retirementRiskOnly })
            }
            label="Retirement risk only"
          />
          <ToggleChip
            active={filter.acquisitionTargetsOnly}
            onClick={() =>
              onPatch({
                acquisitionTargetsOnly: !filter.acquisitionTargetsOnly,
              })
            }
            label="Acquisition targets only"
          />
          <TriStateChip
            label="PE exposure"
            value={filter.requirePeBacked}
            onChange={(next) => onPatch({ requirePeBacked: next })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[#707064]">Tier floor</span>
        <div className="inline-flex rounded-md border border-[#E8E5DE] bg-[#F5F5F0] p-1">
          {WARROOM_TIER_FLOOR_OPTIONS.map((option) => {
            const isActive =
              filter.minTier === option.value ||
              (option.value === "cold" && !filter.minTier)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onPatch({
                    minTier: option.value === "cold" ? null : option.value,
                  })
                }
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm"
                    : "text-[#6B6B60] hover:text-[#1A1A1A]"
                )}
                title={option.description}
                aria-pressed={isActive}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricsSection({
  filter,
  onPatch,
}: {
  filter: WarroomIntentFilter
  onPatch: (patch: Partial<WarroomIntentFilter>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={Gauge} title="Metrics" />

      <DualRangeSlider
        label="Buyability score"
        min={0}
        max={100}
        step={5}
        minValue={filter.minBuyability}
        maxValue={filter.maxBuyability}
        onChange={(minVal, maxVal) =>
          onPatch({ minBuyability: minVal, maxBuyability: maxVal })
        }
        formatValue={(value) => `${value}`}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberInputField
          label="Est. after"
          value={filter.minYearEstablished}
          onChange={(value) => onPatch({ minYearEstablished: value })}
          placeholder="e.g. 2000"
          min={1800}
          max={CURRENT_YEAR}
        />
        <NumberInputField
          label="Est. before"
          value={filter.maxYearEstablished}
          onChange={(value) => onPatch({ maxYearEstablished: value })}
          placeholder="e.g. 1995"
          min={1800}
          max={CURRENT_YEAR}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberInputField
          label="Min staff"
          value={filter.minEmployees}
          onChange={(value) => onPatch({ minEmployees: value })}
          placeholder="e.g. 5"
          min={0}
          max={999}
        />
        <NumberInputField
          label="Max staff"
          value={filter.maxEmployees}
          onChange={(value) => onPatch({ maxEmployees: value })}
          placeholder="optional"
          min={0}
          max={999}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-[#707064]">Show top</span>
        <div className="inline-flex rounded-md border border-[#E8E5DE] bg-[#F5F5F0] p-1">
          {LIMIT_OPTIONS.map((count) => {
            const active = (filter.limit ?? 40) === count
            return (
              <button
                key={count}
                type="button"
                onClick={() =>
                  onPatch({ limit: active ? null : count })
                }
                className={cn(
                  "rounded-[5px] px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm"
                    : "text-[#6B6B60] hover:text-[#1A1A1A]"
                )}
                aria-pressed={active}
              >
                {count}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FlagSection({
  title,
  description,
  icon,
  flags,
  labels,
  require,
  exclude,
  onChange,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  flags: string[]
  labels: Record<string, string>
  require: string[]
  exclude: string[]
  onChange: (flag: string, next: FlagState) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading icon={icon} title={title} hint={description} />
      <div className="flex flex-col divide-y divide-[#F1EFE9] rounded-md border border-[#E8E5DE] bg-[#FAFAF7]">
        {flags.map((flag) => {
          const state = flagStateFor(flag, require, exclude)
          return (
            <div
              key={flag}
              className="flex items-center justify-between gap-2 px-3 py-1.5"
            >
              <span className="text-xs text-[#1A1A1A]">{labels[flag] ?? flag}</span>
              <FlagTriState state={state} onChange={(next) => onChange(flag, next)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FlagTriState({
  state,
  onChange,
}: {
  state: FlagState
  onChange: (next: FlagState) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-0.5 text-[11px] font-medium">
      <button
        type="button"
        onClick={() => onChange(state === "require" ? "ignore" : "require")}
        className={cn(
          "rounded-[4px] px-2 py-0.5 transition-colors",
          state === "require"
            ? "bg-[#2D8B4E]/15 text-[#2D8B4E]"
            : "text-[#6B6B60] hover:text-[#1A1A1A]"
        )}
        aria-pressed={state === "require"}
      >
        Require
      </button>
      <button
        type="button"
        onClick={() => onChange(state === "exclude" ? "ignore" : "exclude")}
        className={cn(
          "rounded-[4px] px-2 py-0.5 transition-colors",
          state === "exclude"
            ? "bg-[#C23B3B]/15 text-[#C23B3B]"
            : "text-[#6B6B60] hover:text-[#1A1A1A]"
        )}
        aria-pressed={state === "exclude"}
      >
        Exclude
      </button>
      <button
        type="button"
        onClick={() => onChange("ignore")}
        className={cn(
          "rounded-[4px] px-2 py-0.5 transition-colors",
          state === "ignore"
            ? "bg-[#F5F5F0] text-[#1A1A1A]"
            : "text-[#707064] hover:text-[#6B6B60]"
        )}
        aria-pressed={state === "ignore"}
      >
        Any
      </button>
    </div>
  )
}

function EntityClassificationSection({
  values,
  onToggle,
}: {
  values: string[]
  onToggle: (ec: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading icon={Building2} title="Entity classification" />
      <div className="flex flex-wrap gap-1.5">
        {ENTITY_CLASSIFICATION_ORDER.map((ec) => {
          const active = values.includes(ec)
          return (
            <button
              key={ec}
              type="button"
              onClick={() => onToggle(ec)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                active
                  ? "border-[#B8860B]/40 bg-[#B8860B]/10 text-[#1A1A1A]"
                  : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:border-[#D4D0C8] hover:text-[#1A1A1A]"
              )}
              aria-pressed={active}
            >
              {ENTITY_CLASSIFICATION_LABELS[ec] ?? ec}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[#B8860B]/40 bg-[#B8860B]/10 text-[#1A1A1A]"
          : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:border-[#D4D0C8] hover:text-[#1A1A1A]"
      )}
      aria-pressed={active}
    >
      {active ? (
        <CheckSquare className="h-3.5 w-3.5 text-[#B8860B]" />
      ) : (
        <Square className="h-3.5 w-3.5 text-[#8F8E82]" />
      )}
      {label}
    </button>
  )
}

function TriStateChip({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (next: boolean | null) => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-xs font-medium">
      <span className="px-2.5 py-1 text-[#707064]">{label}</span>
      <div className="flex border-l border-[#E8E5DE] p-0.5">
        <TriStateButton
          pressed={value === true}
          onClick={() => onChange(value === true ? null : true)}
          tone="positive"
        >
          Require
        </TriStateButton>
        <TriStateButton
          pressed={value === false}
          onClick={() => onChange(value === false ? null : false)}
          tone="negative"
        >
          Exclude
        </TriStateButton>
        <TriStateButton
          pressed={value === null}
          onClick={() => onChange(null)}
          tone="neutral"
        >
          Any
        </TriStateButton>
      </div>
    </div>
  )
}

function TriStateButton({
  pressed,
  onClick,
  tone,
  children,
}: {
  pressed: boolean
  onClick: () => void
  tone: "positive" | "negative" | "neutral"
  children: React.ReactNode
}) {
  const toneClasses =
    tone === "positive"
      ? "bg-[#2D8B4E]/15 text-[#2D8B4E]"
      : tone === "negative"
        ? "bg-[#C23B3B]/15 text-[#C23B3B]"
        : "bg-[#F5F5F0] text-[#1A1A1A]"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[4px] px-2 py-0.5 text-[11px] font-medium transition-colors",
        pressed ? toneClasses : "text-[#6B6B60] hover:text-[#1A1A1A]"
      )}
      aria-pressed={pressed}
    >
      {children}
    </button>
  )
}

function NumberInputField({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  min?: number
  max?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-[#707064]">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value
          if (!raw) {
            onChange(null)
            return
          }
          const num = Number(raw)
          if (!Number.isFinite(num)) {
            onChange(null)
            return
          }
          onChange(num)
        }}
        className="h-8 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 text-xs text-[#1A1A1A] outline-none transition-colors placeholder:text-[#8F8E82] hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20"
      />
    </div>
  )
}

function DualRangeSlider({
  label,
  min,
  max,
  step = 1,
  minValue,
  maxValue,
  onChange,
  formatValue,
}: {
  label: string
  min: number
  max: number
  step?: number
  minValue: number | null
  maxValue: number | null
  onChange: (min: number | null, max: number | null) => void
  formatValue: (value: number) => string
}) {
  const effectiveMin = minValue ?? min
  const effectiveMax = maxValue ?? max

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] text-[#707064]">
        <span>{label}</span>
        <span className="font-mono text-[#1A1A1A]">
          {formatValue(effectiveMin)} – {formatValue(effectiveMax)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={effectiveMin}
            onChange={(event) => {
              const next = Number(event.target.value)
              const capped = Math.min(next, effectiveMax)
              onChange(capped === min ? null : capped, maxValue)
            }}
            className="accent-[#B8860B]"
            aria-label={`${label} minimum`}
          />
          <span className="text-center text-[10px] text-[#707064]">
            min {formatValue(effectiveMin)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={effectiveMax}
            onChange={(event) => {
              const next = Number(event.target.value)
              const capped = Math.max(next, effectiveMin)
              onChange(minValue, capped === max ? null : capped)
            }}
            className="accent-[#B8860B]"
            aria-label={`${label} maximum`}
          />
          <span className="text-center text-[10px] text-[#707064]">
            max {formatValue(effectiveMax)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ActiveChipsRow({
  chips,
  onRemoveChip,
}: {
  chips: WarroomIntent["chips"]
  onRemoveChip: (chip: WarroomIntent["chips"][number]) => void
}) {
  if (chips.length === 0) {
    return (
      <footer className="border-t border-[#E8E5DE] px-4 py-3 text-[11px] text-[#707064]">
        No filters active. Your target list is ranked by the default Warroom
        formula for the current lens.
      </footer>
    )
  }

  return (
    <footer className="border-t border-[#E8E5DE] px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
        <span>Active filters</span>
        <span className="font-mono text-[#6B6B60]">{chips.length}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1 rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-0.5 text-[11px] text-[#1A1A1A]"
          >
            {chip.label}
            <button
              type="button"
              onClick={() => onRemoveChip(chip)}
              aria-label={`Remove ${chip.label}`}
              className="grid h-4 w-4 place-items-center rounded-full text-[#B8860B] hover:bg-[#B8860B]/20 hover:text-[#1A1A1A]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </footer>
  )
}

function applyChipRemoval(
  filter: WarroomIntentFilter,
  chip: WarroomIntent["chips"][number]
): WarroomIntentFilter {
  const chipId = chip.id
  const key = chip.key

  if (chipId.startsWith("own:")) {
    const group = chipId.slice("own:".length) as OwnershipGroup
    return {
      ...filter,
      ownershipGroups: filter.ownershipGroups.filter((g) => g !== group),
    }
  }
  if (chipId.startsWith("ec:")) {
    const ec = chipId.slice("ec:".length)
    return {
      ...filter,
      entityClassifications: filter.entityClassifications.filter((c) => c !== ec),
    }
  }
  if (chipId.startsWith("flag:")) {
    const flag = chipId.slice("flag:".length)
    return {
      ...filter,
      requireFlags: filter.requireFlags.filter((f) => f !== flag),
    }
  }
  if (chipId.startsWith("xflag:")) {
    const flag = chipId.slice("xflag:".length)
    return {
      ...filter,
      excludeFlags: filter.excludeFlags.filter((f) => f !== flag),
    }
  }
  if (chipId.startsWith("zip:")) {
    const zip = chipId.slice("zip:".length)
    return { ...filter, zipCodes: filter.zipCodes.filter((z) => z !== zip) }
  }
  if (chipId.startsWith("subzone:")) {
    const sub = chipId.slice("subzone:".length)
    return { ...filter, subzones: filter.subzones.filter((s) => s !== sub) }
  }
  if (chipId.startsWith("dso:")) {
    const name = chipId.slice("dso:".length)
    return { ...filter, dsoNames: filter.dsoNames.filter((n) => n !== name) }
  }
  if (chipId.startsWith("pe:") && chipId !== "pe:exclude" && chipId !== "pe:require") {
    const name = chipId.slice("pe:".length)
    return { ...filter, peSponsorNames: filter.peSponsorNames.filter((n) => n !== name) }
  }

  switch (key) {
    case "scope":
      return { ...filter, scope: null }
    case "limit":
      return { ...filter, limit: null }
    case "minTier":
      return { ...filter, minTier: null }
    case "minBuyability":
      return { ...filter, minBuyability: null }
    case "maxBuyability":
      return { ...filter, maxBuyability: null }
    case "minYearEstablished":
      return { ...filter, minYearEstablished: null }
    case "maxYearEstablished":
      return { ...filter, maxYearEstablished: null }
    case "minEmployees":
      return { ...filter, minEmployees: null }
    case "maxEmployees":
      return { ...filter, maxEmployees: null }
    case "requirePeBacked":
      return { ...filter, requirePeBacked: null }
    case "retirementRiskOnly":
      return { ...filter, retirementRiskOnly: false }
    case "acquisitionTargetsOnly":
      return { ...filter, acquisitionTargetsOnly: false }
    default:
      return filter
  }
}
