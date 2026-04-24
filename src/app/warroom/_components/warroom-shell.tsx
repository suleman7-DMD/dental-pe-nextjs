"use client"

import { Suspense } from "react"
import { Command, Map, RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  WARROOM_LENSES,
  getWarroomLensLabel,
  type WarroomLens,
} from "@/lib/warroom/mode"
import { getWarroomScopeOption } from "@/lib/warroom/scope"
import {
  WARROOM_SIGNAL_FILTERS,
  useWarroomState,
  type WarroomConfidenceFilter,
} from "@/lib/hooks/use-warroom-state"
import { ModeSwitcher } from "./mode-switcher"
import { PinboardTray } from "./pinboard-tray"
import { ScopeSelector } from "./scope-selector"

const CONFIDENCE_OPTIONS: { value: WarroomConfidenceFilter; label: string }[] = [
  { value: "all", label: "All Confidence" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

function LensSelector({
  value,
  onChange,
}: {
  value: WarroomLens
  onChange: (lens: WarroomLens) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="warroom-lens"
        className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]"
      >
        Lens
      </label>
      <select
        id="warroom-lens"
        value={value}
        onChange={(event) => onChange(event.target.value as WarroomLens)}
        className="h-9 min-w-[185px] rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 pr-8 text-sm font-medium text-[#1A1A1A] outline-none transition-colors hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20"
      >
        {WARROOM_LENSES.map((lens) => (
          <option key={lens.id} value={lens.id}>
            {lens.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function WarroomShellInner() {
  const {
    state,
    hydrated,
    setScope,
    setMode,
    setLens,
    setSelectedEntity,
    setFilters,
    toggleSignalFilter,
    addPin,
    removePin,
    resetWarroomState,
  } = useWarroomState()

  const scope = getWarroomScopeOption(state.scope)
  const activeLensLabel = getWarroomLensLabel(state.lens)

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7] text-[#1A1A1A]">
      <div className="space-y-4">
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-sans text-2xl font-bold tracking-tight text-[#1A1A1A]">
                    Chicagoland Warroom
                  </h1>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                      hydrated
                        ? "border-[#2D8B4E]/30 bg-[#2D8B4E]/10 text-[#2D8B4E]"
                        : "border-[#D4920B]/30 bg-[#D4920B]/10 text-[#D4920B]"
                    )}
                  >
                    {hydrated ? "Synced" : "Loading"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#6B6B60]">
                  <span className="rounded-md border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1">
                    {scope.shortLabel}
                  </span>
                  <span className="rounded-md border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1">
                    {activeLensLabel}
                  </span>
                  <span className="rounded-md border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1">
                    {scope.zipCount} ZIPs
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <ScopeSelector value={state.scope} onChange={setScope} />
                <ModeSwitcher value={state.mode} onChange={setMode} />
                <LensSelector value={state.lens} onChange={setLens} />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-9 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                  aria-label="Command palette"
                >
                  <Search className="h-4 w-4" />
                  <span>Cmd K</span>
                  <Command className="h-3.5 w-3.5 text-[#B5B5A8]" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#E8E5DE] pt-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="warroom-entity"
                    className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]"
                  >
                    Entity
                  </label>
                  <input
                    id="warroom-entity"
                    value={state.selectedEntity ?? ""}
                    onChange={(event) => setSelectedEntity(event.target.value)}
                    placeholder="NPI, ZIP, platform"
                    className="h-9 w-full min-w-[220px] rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 text-sm text-[#1A1A1A] outline-none transition-colors placeholder:text-[#B5B5A8] hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20 sm:w-[270px]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="warroom-confidence"
                    className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]"
                  >
                    Confidence
                  </label>
                  <select
                    id="warroom-confidence"
                    value={state.filters.confidence}
                    onChange={(event) =>
                      setFilters({
                        confidence: event.target.value as WarroomConfidenceFilter,
                      })
                    }
                    className="h-9 min-w-[160px] rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 pr-8 text-sm font-medium text-[#1A1A1A] outline-none transition-colors hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20"
                  >
                    {CONFIDENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]">
                  Signals
                </span>
                {WARROOM_SIGNAL_FILTERS.map((filter) => {
                  const active = state.filters.signals.includes(filter.id)

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => toggleSignalFilter(filter.id)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        active
                          ? "border-[#B8860B]/30 bg-[#B8860B]/10 text-[#1A1A1A]"
                          : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                      )}
                      aria-pressed={active}
                    >
                      {filter.label}
                    </button>
                  )
                })}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetWarroomState}
                  className="h-8 text-[#9C9C90] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-h-[520px] overflow-hidden rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1A1A1A]">
                  Market Map
                </h2>
                <p className="text-xs text-[#9C9C90]">
                  {scope.label} / {activeLensLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1 text-xs font-medium text-[#6B6B60]">
                <Map className="h-3.5 w-3.5 text-[#B8860B]" />
                Layer Frame
              </div>
            </div>
            <div className="relative min-h-[465px] bg-[#F7F7F4]">
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    "linear-gradient(#E8E5DE 1px, transparent 1px), linear-gradient(90deg, #E8E5DE 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="relative flex min-h-[465px] flex-col justify-between p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-1 text-xs font-medium text-[#6B6B60]">
                    {state.mode}
                  </span>
                  <span className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-2 py-1 text-xs font-medium text-[#6B6B60]">
                    {state.lens}
                  </span>
                  {state.selectedEntity && (
                    <span className="max-w-[260px] truncate rounded-md border border-[#B8860B]/30 bg-[#FFFFFF] px-2 py-1 text-xs font-medium text-[#1A1A1A]">
                      {state.selectedEntity}
                    </span>
                  )}
                </div>
                <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-lg border border-dashed border-[#D4D0C8] bg-[#FFFFFF]/85 px-4 py-6 text-center">
                  <SlidersHorizontal className="h-5 w-5 text-[#B8860B]" />
                  <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
                    Signal layers queued
                  </p>
                  <p className="mt-1 text-xs text-[#9C9C90]">
                    {state.filters.signals.length} active filters
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WARROOM_LENSES.slice(0, 4).map((lens) => (
                    <div
                      key={lens.id}
                      className={cn(
                        "rounded-md border px-3 py-2",
                        state.lens === lens.id
                          ? "border-[#B8860B]/40 bg-[#FFFFFF]"
                          : "border-[#E8E5DE] bg-[#FFFFFF]/75"
                      )}
                    >
                      <p className="truncate text-xs font-medium text-[#1A1A1A]">
                        {lens.label}
                      </p>
                      <p className="mt-1 text-[11px] text-[#9C9C90]">Layer</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
              <div className="border-b border-[#E8E5DE] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#1A1A1A]">
                  Right Rail
                </h2>
                <p className="text-xs text-[#9C9C90]">Signal queue</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]">
                    Active Lens
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1A1A1A]">
                    {activeLensLabel}
                  </p>
                </div>
                <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]">
                    Filters
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1A1A1A]">
                    {state.filters.signals.length === 0
                      ? "None"
                      : `${state.filters.signals.length} active`}
                  </p>
                </div>
                <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]">
                    Selected Entity
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#1A1A1A]">
                    {state.selectedEntity ?? "None"}
                  </p>
                </div>
              </div>
            </section>

            <PinboardTray
              pins={state.filters.pins}
              selectedEntity={state.selectedEntity}
              onPinEntity={addPin}
              onSelectEntity={setSelectedEntity}
              onRemovePin={removePin}
            />
          </aside>

          <section className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Dossier</h2>
                <p className="text-xs text-[#9C9C90]">
                  {state.selectedEntity ?? "No entity selected"}
                </p>
              </div>
              <span className="rounded-md border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1 text-xs font-medium text-[#6B6B60]">
                {state.mode}
              </span>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-3">
              <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[#9C9C90]">
                  Snapshot
                </p>
                <p className="mt-3 text-sm text-[#6B6B60]">Empty</p>
              </div>
              <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[#9C9C90]">
                  Evidence
                </p>
                <p className="mt-3 text-sm text-[#6B6B60]">Empty</p>
              </div>
              <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[#9C9C90]">
                  Actions
                </p>
                <p className="mt-3 text-sm text-[#6B6B60]">Empty</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export function WarroomShell() {
  return (
    <Suspense fallback={<WarroomLoadingFrame />}>
      <WarroomShellInner />
    </Suspense>
  )
}

function WarroomLoadingFrame() {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7]">
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-[520px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
          <div className="h-[520px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
          <div className="h-48 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] xl:col-span-2" />
        </div>
      </div>
    </div>
  )
}
