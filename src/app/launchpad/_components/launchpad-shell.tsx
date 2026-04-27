"use client"

import { Suspense, useCallback, useMemo, useState } from "react"
import { AlertTriangle, List, Map as MapIcon, RotateCcw, SplitSquareHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLaunchpadState } from "@/lib/hooks/use-launchpad-state"
import type { LaunchpadView } from "@/lib/hooks/use-launchpad-state"
import { useLaunchpadData } from "@/lib/hooks/use-launchpad-data"
import type { LaunchpadBundle } from "@/lib/launchpad/signals"
import { LaunchpadScopeSelector } from "./scope-selector"
import { TrackSwitcher } from "./track-switcher"
import { LaunchpadKpiStrip } from "./launchpad-kpi-strip"
import { TrackList } from "./track-list"
import { PracticeDossier } from "./practice-dossier"
import { LaunchpadLivingMap } from "./living-map"
import { LaunchpadZipDossierDrawer } from "./zip-dossier-drawer"
import { RedFlagPatterns } from "./red-flag-patterns"
import { PinboardPanel } from "./pinboard-panel"
import { SmartBriefingBuilder } from "./smart-briefing-builder"

interface LaunchpadShellProps {
  initialBundle?: LaunchpadBundle | null
  initialBundleError?: string | null
}

const VIEW_OPTIONS: Array<{
  id: LaunchpadView
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "list", label: "List", icon: List },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "split", label: "Split", icon: SplitSquareHorizontal },
]

function LaunchpadShellInner({ initialBundle, initialBundleError }: LaunchpadShellProps) {
  const {
    state,
    hydrated,
    setScope,
    setTrack,
    setSelectedNpi,
    togglePin,
    clearPins,
    clearSelection,
    setView,
    setMapView,
    setSelectedZip,
    resetLaunchpadState,
  } = useLaunchpadState()

  const { data: bundle, isFetching, error } = useLaunchpadData({
    scope: state.scope,
    track: state.track,
    initialBundle,
  })

  // Tracks which dossier tab to show when the dossier opens. Default "snapshot",
  // but the "full breakdown →" link on each card switches it to "score".
  const [dossierTab, setDossierTab] = useState<string>("snapshot")
  const openWithScoreTab = useCallback(
    (npi: string) => {
      setDossierTab("score")
      setSelectedNpi(npi)
    },
    [setSelectedNpi]
  )
  const closeDossier = useCallback(() => {
    setDossierTab("snapshot")
    clearSelection()
  }, [clearSelection])

  const effectiveBundle = bundle ?? initialBundle ?? null

  const selectedTarget = useMemo(() => {
    if (!state.selectedNpi || !effectiveBundle) return null
    return (
      effectiveBundle.rankedTargets.find((t) => t.npi === state.selectedNpi) ?? null
    )
  }, [effectiveBundle, state.selectedNpi])

  const pinnedSet = useMemo(() => new Set(state.pinnedNpis), [state.pinnedNpis])

  const combinedError =
    (error instanceof Error ? error.message : null) ?? initialBundleError ?? null

  const generatedAt = effectiveBundle?.generatedAt ?? null

  const showList = state.view === "list" || state.view === "split"
  const showMap = state.view === "map" || state.view === "split"

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7] text-[#1A1A1A]">
      <div className="space-y-4">
        {/* Header card */}
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
          <div className="flex flex-col gap-4 px-4 py-4">
            {/* Title row */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-sans text-2xl font-bold tracking-tight text-[#1A1A1A]">
                    Launchpad
                  </h1>
                  <span
                    className={
                      hydrated
                        ? "rounded-full border border-[#2D8B4E]/30 bg-[#2D8B4E]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#2D8B4E]"
                        : "rounded-full border border-[#D4920B]/30 bg-[#D4920B]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#D4920B]"
                    }
                  >
                    {hydrated ? "Ready" : "Loading"}
                  </span>
                  {isFetching && (
                    <span className="rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#B8860B]">
                      Refreshing
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[#6B6B60]">
                  Your first-job copilot — ranked dental practices for new grads
                </p>
              </div>

              {/* Top bar controls */}
              <div className="flex flex-wrap items-end gap-3">
                <LaunchpadScopeSelector value={state.scope} onChange={setScope} />
                <TrackSwitcher value={state.track} onChange={setTrack} />
                <div className="inline-flex overflow-hidden rounded-md border border-[#E8E5DE]">
                  {VIEW_OPTIONS.map((option, index) => {
                    const Icon = option.icon
                    const active = state.view === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setView(option.id)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 px-3 text-[11px] font-medium uppercase tracking-wider transition-colors",
                          index > 0 && "border-l border-[#E8E5DE]",
                          active
                            ? "bg-[#B8860B]/10 text-[#B8860B]"
                            : "bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#FAFAF7] hover:text-[#1A1A1A]"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-end gap-2">
                  {generatedAt && (
                    <span className="mb-1 text-[11px] text-[#9C9C90]">
                      {new Date(generatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  <SmartBriefingBuilder
                    pinnedNpis={state.pinnedNpis}
                    bundle={effectiveBundle}
                    track={state.track}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetLaunchpadState}
                    className="h-9 text-[#707064] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {combinedError && (
          <div className="flex items-start gap-2 rounded-lg border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-3 text-sm text-[#C23B3B]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Data load issue</p>
              <p className="text-[#6B6B60]">{combinedError}</p>
            </div>
          </div>
        )}

        {/* KPI strip */}
        <LaunchpadKpiStrip bundle={effectiveBundle} />

        {/* Pinboard panel (only renders when pins exist) */}
        <PinboardPanel
          bundle={effectiveBundle}
          pinnedNpis={state.pinnedNpis}
          onSelectNpi={setSelectedNpi}
          onTogglePin={togglePin}
          onClearAll={clearPins}
        />

        {/* Red flag patterns — co-occurrence matrix + compound targets */}
        <RedFlagPatterns
          bundle={effectiveBundle}
          onSelectNpi={setSelectedNpi}
        />

        {/* Main content — list, map, or split */}
        <div
          className={cn(
            "grid gap-4",
            state.view === "split"
              ? "grid-cols-1 xl:grid-cols-2"
              : "grid-cols-1"
          )}
        >
          {showMap && (
            <LaunchpadLivingMap
              bundle={effectiveBundle}
              scope={state.scope}
              view={state.mapView}
              onViewChange={setMapView}
              selectedNpi={state.selectedNpi}
              selectedZip={state.selectedZip}
              onSelectNpi={setSelectedNpi}
              onSelectZip={setSelectedZip}
              height={state.view === "split" ? 620 : 620}
            />
          )}
          {showList && (
            <TrackList
              bundle={effectiveBundle}
              track={state.track}
              selectedNpi={state.selectedNpi}
              onSelect={setSelectedNpi}
              pinnedNpis={state.pinnedNpis}
              onTogglePin={togglePin}
              onOpenScore={openWithScoreTab}
            />
          )}
        </div>
      </div>

      {/* Practice dossier drawer */}
      <PracticeDossier
        target={selectedTarget}
        open={selectedTarget !== null}
        onClose={closeDossier}
        track={state.track}
        bundle={effectiveBundle}
        isPinned={
          selectedTarget ? pinnedSet.has(selectedTarget.npi) : false
        }
        onTogglePin={togglePin}
        tab={dossierTab}
        onTabChange={setDossierTab}
      />

      {/* ZIP dossier drawer */}
      <LaunchpadZipDossierDrawer
        zipCode={state.selectedZip}
        bundle={effectiveBundle}
        onClose={() => setSelectedZip(null)}
        onSelectNpi={(npi) => {
          setSelectedZip(null)
          setSelectedNpi(npi)
        }}
      />
    </div>
  )
}

function LaunchpadLoadingFrame() {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7]">
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        <div className="h-28 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
        <div className="h-[600px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
      </div>
    </div>
  )
}

export function LaunchpadShell(props: LaunchpadShellProps) {
  return (
    <Suspense fallback={<LaunchpadLoadingFrame />}>
      <LaunchpadShellInner {...props} />
    </Suspense>
  )
}
