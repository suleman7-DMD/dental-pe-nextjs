"use client"

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AlertTriangle, Command, Keyboard, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DEFAULT_WARROOM_LENS,
  WARROOM_LENSES,
  getWarroomLensLabel,
  type WarroomLens,
  type WarroomMode,
} from "@/lib/warroom/mode"
import {
  getWarroomScopeOption,
  type WarroomScope,
} from "@/lib/warroom/scope"
import {
  WARROOM_PIN_LIMIT,
  useWarroomState,
  type WarroomConfidenceFilter,
  type WarroomSignalFilter,
} from "@/lib/hooks/use-warroom-state"
import { useWarroomData } from "@/lib/hooks/use-warroom-data"
import { useWarroomPinLifecycle } from "@/lib/hooks/use-warroom-pin-lifecycle"
import type {
  RankedTarget,
  WarroomIntent,
  WarroomIntentFilter,
  WarroomSitrepBundle,
} from "@/lib/warroom/signals"
import {
  buildIntentFromFilter,
  createEmptyFilter,
  describeFilter,
  filterHasContent,
  intentHasFilters,
  parseIntent,
} from "@/lib/warroom/intent"
import { PanelErrorBoundary } from "@/components/ui/panel-error-boundary"
import { BriefingRail } from "./briefing-rail"
import { DossierDrawer } from "./dossier-drawer"
import { HuntModePanel } from "./hunt-mode-panel"
import { IntentBar } from "./intent-bar"
import { InvestigateModePanel } from "./investigate-mode-panel"
import { KeyboardShortcutsOverlay } from "./keyboard-shortcuts-overlay"
import { LivingMap } from "./living-map"
import { ModeSwitcher } from "./mode-switcher"
import { PinboardTray } from "./pinboard-tray"
import { ScopeSelector } from "./scope-selector"
import { SitrepKpiStrip } from "./sitrep-kpi-strip"
import { TargetList } from "./target-list"
import { ZipDossierDrawer } from "./zip-dossier-drawer"

const TIER_RANK: Record<"hot" | "warm" | "cool" | "cold", number> = {
  hot: 3,
  warm: 2,
  cool: 1,
  cold: 0,
}

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

const MODE_DEFAULT_LENS: Record<WarroomMode, WarroomLens> = {
  hunt: "retirement",
  investigate: "buyability",
}

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
        className="text-[11px] font-medium uppercase tracking-wider text-[#707064]"
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
  if (signals.includes("stealth_dso")) flags.push("stealth_dso_flag")
  if (signals.includes("phantom_inventory")) flags.push("phantom_inventory_flag")
  if (signals.includes("revenue_default")) flags.push("revenue_default_flag")
  if (signals.includes("family_dynasty")) flags.push("family_dynasty_flag")
  if (signals.includes("micro_cluster")) flags.push("micro_cluster_flag")
  if (signals.includes("retirement_risk")) flags.push("retirement_combo_flag")
  if (signals.includes("recent_changes")) flags.push("last_change_90d_flag")
  if (signals.includes("high_peer_retirement")) flags.push("high_peer_retirement_flag")
  if (signals.includes("ada_gap")) flags.push("zip_ada_benchmark_gap_flag")
  return flags
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

const ERROR_PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /network|fetch|failed to fetch|cors|abort|timeout|timed out|offline|dns/i,
    message:
      "Unable to reach the data service. Check your connection and retry.",
  },
  {
    test: /permission denied|not authorized|rls|row[- ]level security|forbidden|jwt/i,
    message:
      "Access denied. Your session may have expired — refresh to sign in again.",
  },
  {
    test: /rate limit|too many requests|429/i,
    message: "The service is throttling requests. Please wait a moment and retry.",
  },
]

function sanitizeErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null
  for (const { test, message } of ERROR_PATTERNS) {
    if (test.test(raw)) return message
  }
  return "Unable to load Warroom data. Retry or refresh the page."
}

function WarroomShellInner({ initialBundle, initialBundleError }: WarroomShellProps) {
  const {
    state,
    hydrated,
    setScope,
    setLens,
    setModeAndLens,
    setSelectedEntity,
    setFilters,
    addPin,
    removePin,
    reorderPins,
    clearPins,
    setIntent,
    resetWarroomState,
  } = useWarroomState()

  const [intentText, setIntentText] = useState("")
  const [activeIntent, setActiveIntent] = useState<WarroomIntent | null>(null)
  const seededIntentRef = useRef<string | null>(null)

  useEffect(() => {
    if (!hydrated) return
    if (seededIntentRef.current === state.intent) return
    seededIntentRef.current = state.intent

    setIntentText(state.intent)

    if (state.intent) {
      const parsed = parseIntent(state.intent)
      if (intentHasFilters(parsed)) {
        setActiveIntent(parsed)
      } else {
        setActiveIntent(null)
      }
    } else {
      setActiveIntent(null)
    }
  }, [hydrated, state.intent])
  const [selectedZip, setSelectedZip] = useState<string | null>(null)
  const [dossierZip, setDossierZip] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [pinLimitNotice, setPinLimitNotice] = useState(false)
  const intentInputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pinLimitNotice) return
    const timer = window.setTimeout(() => setPinLimitNotice(false), 4000)
    return () => window.clearTimeout(timer)
  }, [pinLimitNotice])

  const handleAddPin = useCallback(
    (entity: string) => {
      const added = addPin(entity)
      if (!added) setPinLimitNotice(true)
      return added
    },
    [addPin]
  )

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
    return false
  }, [activeIntent])

  const rankLimit = useMemo(() => activeIntent?.filter.limit ?? 40, [activeIntent])

  const {
    getStage: getLifecycleStage,
    setStage: setLifecycleStage,
  } = useWarroomPinLifecycle()

  const { data: bundle, isFetching, error } = useWarroomData({
    scope: state.scope,
    lens: state.lens,
    rankLimit,
    requireFlags: requireFlags.length > 0 ? requireFlags : undefined,
    excludeFlags: excludeFlags.length > 0 ? excludeFlags : undefined,
    excludeCorporate,
    confidence: state.filters.confidence,
    intentFilter: activeIntent?.filter ?? null,
    initialData: initialBundle ?? undefined,
  })

  const effectiveBundle = bundle ?? initialBundle ?? null

  const pinnedNpis = useMemo<Set<string>>(
    () => new Set(state.filters.pins),
    [state.filters.pins]
  )

  const pinTargets = useMemo<Map<string, RankedTarget>>(() => {
    const map = new Map<string, RankedTarget>()
    if (!effectiveBundle) return map
    for (const target of effectiveBundle.rankedTargets) {
      if (pinnedNpis.has(target.npi)) {
        map.set(target.npi, target)
      }
    }
    return map
  }, [effectiveBundle, pinnedNpis])

  const selectedTarget = useMemo<RankedTarget | null>(() => {
    if (!state.selectedEntity || !effectiveBundle) return null
    return (
      effectiveBundle.rankedTargets.find(
        (target) => target.npi === state.selectedEntity
      ) ?? null
    )
  }, [effectiveBundle, state.selectedEntity])

  const nearbyDeals = useMemo(() => {
    if (!selectedTarget || !effectiveBundle) return []
    return effectiveBundle.recentDeals
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
      const committed = intent.rawText ?? ""
      seededIntentRef.current = committed
      setIntent(committed)
      const nextScope = intent.filter.scope as WarroomScope | null
      if (nextScope && nextScope !== state.scope) {
        setScope(nextScope)
      }
    },
    [setIntent, setScope, state.scope]
  )

  const handleIntentReset = useCallback(() => {
    setIntentText("")
    setActiveIntent(null)
    seededIntentRef.current = ""
    setIntent("")
  }, [setIntent])

  const currentHuntFilter = useMemo<WarroomIntentFilter>(
    () => activeIntent?.filter ?? createEmptyFilter(),
    [activeIntent]
  )

  const handleHuntFilterChange = useCallback(
    (next: WarroomIntentFilter) => {
      if (!filterHasContent(next)) {
        setActiveIntent(null)
        setIntentText("")
        seededIntentRef.current = ""
        setIntent("")
        return
      }
      const intent = buildIntentFromFilter(next)
      const text = describeFilter(next)
      setActiveIntent(intent)
      setIntentText(text)
      seededIntentRef.current = text
      setIntent(text)
    },
    [setIntent]
  )

  const handleHuntReset = useCallback(() => {
    setActiveIntent(null)
    setIntentText("")
    seededIntentRef.current = ""
    setIntent("")
  }, [setIntent])

  const handleModeChange = useCallback(
    (mode: WarroomMode) => {
      const nextLens =
        state.lens === DEFAULT_WARROOM_LENS
          ? MODE_DEFAULT_LENS[mode]
          : state.lens
      setModeAndLens(mode, nextLens)
    },
    [setModeAndLens, state.lens]
  )

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
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      if (target.isContentEditable) return true
      return false
    }

    function onKeyDown(event: KeyboardEvent) {
      const isMeta = event.metaKey || event.ctrlKey
      if (isMeta && event.key.toLowerCase() === "k") {
        event.preventDefault()
        handleCommandShortcut()
        return
      }

      if (isMeta || event.altKey) return
      if (isTypingTarget(event.target)) return

      const drawerOpen =
        shortcutsOpen ||
        Boolean(state.selectedEntity) ||
        Boolean(dossierZip)

      switch (event.key) {
        case "?":
          event.preventDefault()
          setShortcutsOpen((prev) => !prev)
          return
        case "/":
          event.preventDefault()
          handleCommandShortcut()
          return
        case "Escape":
          if (shortcutsOpen) {
            event.preventDefault()
            setShortcutsOpen(false)
            return
          }
          if (state.selectedEntity) {
            event.preventDefault()
            setSelectedEntity(null)
            return
          }
          if (dossierZip) {
            event.preventDefault()
            setDossierZip(null)
            return
          }
          if (selectedZip) {
            event.preventDefault()
            setSelectedZip(null)
            return
          }
          return
        case "1":
          if (drawerOpen) return
          event.preventDefault()
          handleModeChange("hunt")
          return
        case "2":
          if (drawerOpen) return
          event.preventDefault()
          handleModeChange("investigate")
          return
        case "r":
        case "R":
          if (drawerOpen) return
          event.preventDefault()
          handleIntentReset()
          resetWarroomState()
          setSelectedZip(null)
          return
        case "p":
        case "P":
          if (!state.selectedEntity) return
          event.preventDefault()
          if (pinnedNpis.has(state.selectedEntity)) {
            removePin(state.selectedEntity)
          } else {
            handleAddPin(state.selectedEntity)
          }
          return
        default:
          return
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    handleAddPin,
    dossierZip,
    handleCommandShortcut,
    handleIntentReset,
    handleModeChange,
    pinnedNpis,
    removePin,
    resetWarroomState,
    selectedZip,
    setSelectedEntity,
    shortcutsOpen,
    state.selectedEntity,
  ])

  const summary = effectiveBundle?.summary ?? null
  const zipScores = effectiveBundle?.zipScores ?? []
  const zipSignals = effectiveBundle?.zipSignals ?? []
  const rankedTargets = useMemo(
    () => effectiveBundle?.rankedTargets ?? [],
    [effectiveBundle]
  )
  const briefingItems = effectiveBundle?.briefing ?? []
  const dataHealth = effectiveBundle?.dataHealth
  const rawErrorMessage =
    (error instanceof Error ? error.message : null) ?? initialBundleError ?? null

  useEffect(() => {
    if (error) {
      console.error("[warroom] data load error:", error)
    } else if (initialBundleError) {
      console.error("[warroom] initial bundle error:", initialBundleError)
    }
  }, [error, initialBundleError])

  const combinedError = useMemo(
    () => sanitizeErrorMessage(rawErrorMessage),
    [rawErrorMessage]
  )

  const visibleTargets = useMemo(() => {
    const minTier = activeIntent?.filter.minTier
    if (!minTier) return rankedTargets
    const floor = TIER_RANK[minTier]
    return rankedTargets.filter(
      (target) => (TIER_RANK[target.tier] ?? 0) >= floor
    )
  }, [activeIntent, rankedTargets])

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7] text-[#1A1A1A]">
      {pinLimitNotice && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed right-4 top-16 z-50 flex items-center gap-2 rounded-md border border-[#D4920B]/50 bg-[#FFFBEB] px-3 py-2 text-xs font-medium text-[#7A4A00] shadow-md"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Pin limit reached ({WARROOM_PIN_LIMIT}). Unpin a target first.
        </div>
      )}
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
                    {scope.zipCount === 1 ? "1 ZIP" : `${scope.zipCount} ZIPs`}
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
                <ModeSwitcher value={state.mode} onChange={handleModeChange} />
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
                  <Command className="h-3.5 w-3.5 text-[#8F8E82]" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShortcutsOpen(true)}
                  className="h-9 w-9 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                  aria-label="Keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#E8E5DE] pt-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="warroom-confidence"
                    className="text-[11px] font-medium uppercase tracking-wider text-[#707064]"
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

              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleIntentReset()
                    resetWarroomState()
                    setSelectedZip(null)
                  }}
                  className="h-8 text-[#707064] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
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

        {state.mode === "hunt" && (
          <PanelErrorBoundary panelName="Hunt mode">
            <HuntModePanel
              filter={currentHuntFilter}
              onFilterChange={handleHuntFilterChange}
              matchingCount={visibleTargets.length}
              totalCandidateCount={effectiveBundle?.dataHealth.practicesFetched ?? null}
              onReset={handleHuntReset}
            />
          </PanelErrorBoundary>
        )}

        {state.mode === "investigate" && (
          <PanelErrorBoundary panelName="Investigate mode">
            <InvestigateModePanel
              bundle={effectiveBundle}
              rankedTargets={visibleTargets}
              onTargetSelect={handleTargetSelect}
              onIntentRequest={handleDossierIntentRequest}
            />
          </PanelErrorBoundary>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <PanelErrorBoundary panelName="Living Map">
            <LivingMap
              lens={state.lens}
              onLensChange={setLens}
              zipScores={zipScores}
              zipSignals={zipSignals}
              rankedTargets={visibleTargets}
              selectedZip={selectedZip}
              onZipSelect={setSelectedZip}
              onTargetSelect={handleTargetSelect}
              onZipDossierOpen={setDossierZip}
              className="xl:min-h-[560px]"
            />
          </PanelErrorBoundary>

          <aside className="space-y-4">
            <PanelErrorBoundary panelName="Briefing">
              <BriefingRail
                items={briefingItems}
                onIntentRequest={handleDossierIntentRequest}
                onLensChange={setLens}
              />
            </PanelErrorBoundary>

            <PanelErrorBoundary panelName="Pinboard">
              <PinboardTray
                pins={state.filters.pins}
                selectedEntity={state.selectedEntity}
                onPinEntity={handleAddPin}
                onSelectEntity={setSelectedEntity}
                onRemovePin={removePin}
                onReorderPins={reorderPins}
                onClearPins={clearPins}
                pinTargets={pinTargets}
              />
            </PanelErrorBoundary>
          </aside>
        </div>

        <PanelErrorBoundary panelName="Target list">
          <TargetList
            targets={visibleTargets}
            lens={state.lens}
            selectedNpi={state.selectedEntity}
            onSelect={handleTargetSelect}
            pinnedNpis={pinnedNpis}
            onPin={handleAddPin}
            onUnpin={removePin}
          />
        </PanelErrorBoundary>
      </div>

      <DossierDrawer
        target={selectedTarget}
        onClose={handleDossierClose}
        onPin={handleAddPin}
        onUnpin={removePin}
        isPinned={selectedTarget ? pinnedNpis.has(selectedTarget.npi) : false}
        onIntentRequest={handleDossierIntentRequest}
        nearbyDeals={nearbyDeals}
        recentChanges={changesForSelected}
        currentStage={
          selectedTarget ? getLifecycleStage(selectedTarget.npi) : undefined
        }
        onStageChange={setLifecycleStage}
      />

      <ZipDossierDrawer
        zipCode={dossierZip}
        zipScore={
          dossierZip
            ? zipScores.find((row) => row.zip_code === dossierZip) ?? null
            : null
        }
        zipSignal={
          dossierZip
            ? zipSignals.find((row) => row.zip_code === dossierZip) ?? null
            : null
        }
        rankedTargets={rankedTargets}
        recentChanges={effectiveBundle?.recentChanges ?? []}
        onClose={() => setDossierZip(null)}
        onTargetSelect={(npi) => {
          setDossierZip(null)
          handleTargetSelect(npi)
        }}
        onIntentRequest={handleDossierIntentRequest}
      />

      <KeyboardShortcutsOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
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
