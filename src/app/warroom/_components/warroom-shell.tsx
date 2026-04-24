"use client"

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AlertTriangle, Command, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  WARROOM_LENSES,
  getWarroomLensLabel,
  type WarroomLens,
} from "@/lib/warroom/mode"
import {
  getWarroomScopeOption,
  type WarroomScope,
} from "@/lib/warroom/scope"
import {
  WARROOM_SIGNAL_FILTERS,
  useWarroomState,
  type WarroomConfidenceFilter,
  type WarroomSignalFilter,
} from "@/lib/hooks/use-warroom-state"
import { useWarroomData } from "@/lib/hooks/use-warroom-data"
import type {
  RankedTarget,
  WarroomIntent,
  WarroomSitrepBundle,
} from "@/lib/warroom/signals"
import { BriefingRail } from "./briefing-rail"
import { DossierDrawer } from "./dossier-drawer"
import { IntentBar } from "./intent-bar"
import { LivingMap } from "./living-map"
import { ModeSwitcher } from "./mode-switcher"
import { PinboardTray } from "./pinboard-tray"
import { ScopeSelector } from "./scope-selector"
import { SitrepKpiStrip } from "./sitrep-kpi-strip"
import { TargetList } from "./target-list"

interface WarroomShellProps {
  initialBundle?: WarroomSitrepBundle | null
  initialBundleError?: string | null
}

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

function signalFiltersToFlags(signals: WarroomSignalFilter[]): string[] {
  const flags: string[] = []
  if (signals.includes("recent_changes")) flags.push("last_change_90d_flag")
  if (signals.includes("retirement_risk")) flags.push("retirement_combo_flag")
  return flags
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function WarroomShellInner({ initialBundle, initialBundleError }: WarroomShellProps) {
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

  const [intentText, setIntentText] = useState("")
  const [activeIntent, setActiveIntent] = useState<WarroomIntent | null>(null)
  const [selectedZip, setSelectedZip] = useState<string | null>(null)
  const intentInputRef = useRef<HTMLDivElement>(null)

  const scope = getWarroomScopeOption(state.scope)
  const activeLensLabel = getWarroomLensLabel(state.lens)

  const requireFlags = useMemo(() => {
    const fromSignals = signalFiltersToFlags(state.filters.signals)
    const fromIntent = activeIntent?.filter.requireFlags ?? []
    return dedupeStrings([...fromSignals, ...fromIntent])
  }, [activeIntent, state.filters.signals])

  const excludeFlags = useMemo(() => {
    return dedupeStrings(activeIntent?.filter.excludeFlags ?? [])
  }, [activeIntent])

  const excludeCorporate = useMemo(() => {
    const intentFilter = activeIntent?.filter
    if (!intentFilter) return false
    if (intentFilter.excludeFlags.includes("ownership:corporate")) return true
    if (intentFilter.requirePeBacked === false) return true
    return false
  }, [activeIntent])

  const rankLimit = useMemo(() => activeIntent?.filter.limit ?? 40, [activeIntent])

  const { data: bundle, isFetching, error } = useWarroomData({
    scope: state.scope,
    lens: state.lens,
    rankLimit,
    requireFlags: requireFlags.length > 0 ? requireFlags : undefined,
    excludeFlags: excludeFlags.length > 0 ? excludeFlags : undefined,
    excludeCorporate,
    initialData: initialBundle ?? undefined,
  })

  const effectiveBundle = bundle ?? initialBundle ?? null

  const pinnedNpis = useMemo<Set<string>>(
    () => new Set(state.filters.pins),
    [state.filters.pins]
  )

  const selectedTarget = useMemo<RankedTarget | null>(() => {
    if (!state.selectedEntity || !effectiveBundle) return null
    return (
      effectiveBundle.rankedTargets.find(
        (target) => target.npi === state.selectedEntity
      ) ?? null
    )
  }, [effectiveBundle, state.selectedEntity])

  const nearbyDeals = useMemo(() => {
    if (!selectedTarget?.zip || !effectiveBundle) return []
    return effectiveBundle.recentDeals.filter(
      (deal) => deal.target_zip === selectedTarget.zip
    )
  }, [effectiveBundle, selectedTarget])

  const changesForSelected = useMemo(() => {
    if (!selectedTarget || !effectiveBundle) return []
    return effectiveBundle.recentChanges
      .filter((change) => change.npi === selectedTarget.npi)
      .slice(0, 12)
  }, [effectiveBundle, selectedTarget])

  const handleIntentSubmit = useCallback(
    (intent: WarroomIntent) => {
      setActiveIntent(intent)
      const nextScope = intent.filter.scope as WarroomScope | null
      if (nextScope && nextScope !== state.scope) {
        setScope(nextScope)
      }
    },
    [setScope, state.scope]
  )

  const handleIntentReset = useCallback(() => {
    setIntentText("")
    setActiveIntent(null)
  }, [])

  const handleTargetSelect = useCallback(
    (npi: string) => {
      setSelectedEntity(npi)
    },
    [setSelectedEntity]
  )

  const handleDossierClose = useCallback(() => {
    setSelectedEntity(null)
  }, [setSelectedEntity])

  const handleDossierIntentRequest = useCallback(
    (text: string) => {
      setIntentText(text)
      intentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    []
  )

  const handleCommandShortcut = useCallback(() => {
    const input = intentInputRef.current?.querySelector<HTMLInputElement>(
      "input[aria-label='Describe the targets you want']"
    )
    input?.focus()
    input?.select()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMeta = event.metaKey || event.ctrlKey
      if (isMeta && event.key.toLowerCase() === "k") {
        event.preventDefault()
        handleCommandShortcut()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleCommandShortcut])

  const summary = effectiveBundle?.summary ?? null
  const zipScores = effectiveBundle?.zipScores ?? []
  const zipSignals = effectiveBundle?.zipSignals ?? []
  const rankedTargets = effectiveBundle?.rankedTargets ?? []
  const briefingItems = effectiveBundle?.briefing ?? []
  const dataHealth = effectiveBundle?.dataHealth
  const combinedError =
    (error instanceof Error ? error.message : null) ?? initialBundleError ?? null

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
                  {isFetching && (
                    <span className="rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#B8860B]">
                      Refreshing
                    </span>
                  )}
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
                  {rankedTargets.length > 0 && (
                    <span className="rounded-md border border-[#E8E5DE] bg-[#F7F7F4] px-2 py-1">
                      {rankedTargets.length} ranked
                    </span>
                  )}
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
                  onClick={handleCommandShortcut}
                  className="h-9 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                  aria-label="Focus intent bar"
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
                  onClick={() => {
                    handleIntentReset()
                    resetWarroomState()
                    setSelectedZip(null)
                  }}
                  className="h-8 text-[#9C9C90] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        {combinedError && (
          <div className="flex items-start gap-2 rounded-lg border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-3 text-sm text-[#C23B3B]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Data load issue</p>
              <p className="text-[#6B6B60]">{combinedError}</p>
            </div>
          </div>
        )}

        {dataHealth?.warnings && dataHealth.warnings.length > 0 && !combinedError && (
          <div className="rounded-lg border border-[#D4920B]/30 bg-[#D4920B]/5 px-4 py-3 text-xs text-[#6B6B60]">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#B0780A]">
              Pipeline notes
            </p>
            <ul className="list-inside list-disc space-y-1">
              {dataHealth.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div ref={intentInputRef}>
          <IntentBar
            value={intentText}
            onChange={setIntentText}
            onIntentSubmit={handleIntentSubmit}
            onReset={handleIntentReset}
            pendingHint={
              activeIntent?.chips.length
                ? `${activeIntent.chips.length} filters recognized`
                : undefined
            }
          />
        </div>

        {summary && <SitrepKpiStrip summary={summary} />}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <LivingMap
            lens={state.lens}
            onLensChange={setLens}
            zipScores={zipScores}
            zipSignals={zipSignals}
            rankedTargets={rankedTargets}
            selectedZip={selectedZip}
            onZipSelect={setSelectedZip}
            onTargetSelect={handleTargetSelect}
            className="xl:min-h-[560px]"
          />

          <aside className="space-y-4">
            <BriefingRail
              items={briefingItems}
              onIntentRequest={handleDossierIntentRequest}
              onLensChange={setLens}
            />

            <PinboardTray
              pins={state.filters.pins}
              selectedEntity={state.selectedEntity}
              onPinEntity={addPin}
              onSelectEntity={setSelectedEntity}
              onRemovePin={removePin}
            />
          </aside>
        </div>

        <TargetList
          targets={rankedTargets}
          lens={state.lens}
          selectedNpi={state.selectedEntity}
          onSelect={handleTargetSelect}
          pinnedNpis={pinnedNpis}
          onPin={addPin}
          onUnpin={removePin}
        />
      </div>

      <DossierDrawer
        target={selectedTarget}
        onClose={handleDossierClose}
        onPin={addPin}
        onUnpin={removePin}
        isPinned={selectedTarget ? pinnedNpis.has(selectedTarget.npi) : false}
        onIntentRequest={handleDossierIntentRequest}
        nearbyDeals={nearbyDeals}
        recentChanges={changesForSelected}
      />
    </div>
  )
}

export function WarroomShell(props: WarroomShellProps) {
  return (
    <Suspense fallback={<WarroomLoadingFrame />}>
      <WarroomShellInner {...props} />
    </Suspense>
  )
}

function WarroomLoadingFrame() {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7]">
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        <div className="h-28 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        <div className="h-40 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-[520px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
          <div className="h-[520px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
      </div>
    </div>
  )
}
