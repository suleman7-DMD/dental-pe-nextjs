"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  DEFAULT_LAUNCHPAD_SCOPE,
  isLaunchpadScope,
  type LaunchpadScope,
} from "@/lib/launchpad/scope"
import {
  DEFAULT_LAUNCHPAD_TRACK,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"

export const LAUNCHPAD_LOCAL_STORAGE_KEY = "dental-pe-launchpad-state-v0"
export const LAUNCHPAD_PIN_LIMIT = 20

export const LAUNCHPAD_QUERY_PARAMS = {
  scope: "scope",
  track: "track",
  selectedNpi: "npi",
  pinnedNpis: "pins",
  view: "view",
  mapView: "mapView",
  selectedZip: "zip",
} as const

const LAUNCHPAD_TRACK_IDS: ReadonlySet<string> = new Set([
  "all",
  "succession",
  "high_volume",
  "dso",
])

const LAUNCHPAD_VIEW_IDS: ReadonlySet<string> = new Set(["list", "map", "split"])
const LAUNCHPAD_MAP_VIEW_IDS: ReadonlySet<string> = new Set(["practices", "zips"])

export type LaunchpadView = "list" | "map" | "split"
export type LaunchpadMapView = "practices" | "zips"

export const DEFAULT_LAUNCHPAD_VIEW: LaunchpadView = "list"
export const DEFAULT_LAUNCHPAD_MAP_VIEW: LaunchpadMapView = "practices"

function isLaunchpadTrack(value: unknown): value is LaunchpadTrack {
  return typeof value === "string" && LAUNCHPAD_TRACK_IDS.has(value)
}

function isLaunchpadView(value: unknown): value is LaunchpadView {
  return typeof value === "string" && LAUNCHPAD_VIEW_IDS.has(value)
}

function isLaunchpadMapView(value: unknown): value is LaunchpadMapView {
  return typeof value === "string" && LAUNCHPAD_MAP_VIEW_IDS.has(value)
}

const LAUNCHPAD_PARAM_KEYS = Object.values(LAUNCHPAD_QUERY_PARAMS)

export interface LaunchpadState {
  scope: LaunchpadScope
  track: LaunchpadTrack
  selectedNpi: string | null
  pinnedNpis: string[]
  view: LaunchpadView
  mapView: LaunchpadMapView
  selectedZip: string | null
}

type SearchParamReader = Pick<URLSearchParams, "get" | "has" | "toString">

function sanitizeText(value: unknown, maxLength = 96): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueLimited(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const value of values) {
    const clean = sanitizeText(value)
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    next.push(clean)
    if (next.length >= limit) break
  }
  return next
}

function createDefaultLaunchpadState(): LaunchpadState {
  return {
    scope: DEFAULT_LAUNCHPAD_SCOPE,
    track: DEFAULT_LAUNCHPAD_TRACK,
    selectedNpi: null,
    pinnedNpis: [],
    view: DEFAULT_LAUNCHPAD_VIEW,
    mapView: DEFAULT_LAUNCHPAD_MAP_VIEW,
    selectedZip: null,
  }
}

function sanitizeZip(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!/^\d{5}$/.test(trimmed)) return null
  return trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function coerceStoredState(value: unknown): LaunchpadState | null {
  if (!isRecord(value)) return null
  const defaults = createDefaultLaunchpadState()
  return {
    scope: isLaunchpadScope(value.scope) ? value.scope : defaults.scope,
    track: isLaunchpadTrack(value.track) ? value.track : defaults.track,
    selectedNpi: sanitizeText(value.selectedNpi),
    pinnedNpis: uniqueLimited(
      Array.isArray(value.pinnedNpis)
        ? value.pinnedNpis.filter((item): item is string => typeof item === "string")
        : [],
      LAUNCHPAD_PIN_LIMIT
    ),
    view: isLaunchpadView(value.view) ? value.view : defaults.view,
    mapView: isLaunchpadMapView(value.mapView) ? value.mapView : defaults.mapView,
    selectedZip: sanitizeZip(value.selectedZip),
  }
}

function parseUrlState(searchParams: SearchParamReader): LaunchpadState {
  const defaults = createDefaultLaunchpadState()
  const scope = searchParams.get(LAUNCHPAD_QUERY_PARAMS.scope)
  const track = searchParams.get(LAUNCHPAD_QUERY_PARAMS.track)
  const view = searchParams.get(LAUNCHPAD_QUERY_PARAMS.view)
  const mapView = searchParams.get(LAUNCHPAD_QUERY_PARAMS.mapView)
  return {
    scope: isLaunchpadScope(scope) ? scope : defaults.scope,
    track: isLaunchpadTrack(track) ? track : defaults.track,
    selectedNpi: sanitizeText(searchParams.get(LAUNCHPAD_QUERY_PARAMS.selectedNpi)),
    pinnedNpis: uniqueLimited(
      parseList(searchParams.get(LAUNCHPAD_QUERY_PARAMS.pinnedNpis)),
      LAUNCHPAD_PIN_LIMIT
    ),
    view: isLaunchpadView(view) ? view : defaults.view,
    mapView: isLaunchpadMapView(mapView) ? mapView : defaults.mapView,
    selectedZip: sanitizeZip(searchParams.get(LAUNCHPAD_QUERY_PARAMS.selectedZip)),
  }
}

function hasLaunchpadUrlState(searchParams: SearchParamReader): boolean {
  return LAUNCHPAD_PARAM_KEYS.some((key) => searchParams.has(key))
}

function readStoredLaunchpadState(): LaunchpadState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LAUNCHPAD_LOCAL_STORAGE_KEY)
    if (!raw) return null
    return coerceStoredState(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeStoredLaunchpadState(state: LaunchpadState) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAUNCHPAD_LOCAL_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable
  }
}

function applyStateToParams(params: URLSearchParams, state: LaunchpadState) {
  params.set(LAUNCHPAD_QUERY_PARAMS.scope, state.scope)
  params.set(LAUNCHPAD_QUERY_PARAMS.track, state.track)

  if (state.selectedNpi) {
    params.set(LAUNCHPAD_QUERY_PARAMS.selectedNpi, state.selectedNpi)
  } else {
    params.delete(LAUNCHPAD_QUERY_PARAMS.selectedNpi)
  }

  if (state.pinnedNpis.length > 0) {
    params.set(LAUNCHPAD_QUERY_PARAMS.pinnedNpis, state.pinnedNpis.join(","))
  } else {
    params.delete(LAUNCHPAD_QUERY_PARAMS.pinnedNpis)
  }

  if (state.view !== DEFAULT_LAUNCHPAD_VIEW) {
    params.set(LAUNCHPAD_QUERY_PARAMS.view, state.view)
  } else {
    params.delete(LAUNCHPAD_QUERY_PARAMS.view)
  }

  if (state.mapView !== DEFAULT_LAUNCHPAD_MAP_VIEW) {
    params.set(LAUNCHPAD_QUERY_PARAMS.mapView, state.mapView)
  } else {
    params.delete(LAUNCHPAD_QUERY_PARAMS.mapView)
  }

  if (state.selectedZip) {
    params.set(LAUNCHPAD_QUERY_PARAMS.selectedZip, state.selectedZip)
  } else {
    params.delete(LAUNCHPAD_QUERY_PARAMS.selectedZip)
  }
}

export function useLaunchpadState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const hydratedOnce = useRef(false)
  const [storedState, setStoredState] = useState<LaunchpadState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const hasUrlState = useMemo(
    () => hasLaunchpadUrlState(searchParams),
    [searchParams]
  )

  const urlState = useMemo(() => parseUrlState(searchParams), [searchParams])

  const state = useMemo(
    () => (hasUrlState ? urlState : storedState ?? createDefaultLaunchpadState()),
    [hasUrlState, storedState, urlState]
  )

  const replaceUrl = useCallback(
    (nextState: LaunchpadState) => {
      const params = new URLSearchParams(searchParams.toString())
      applyStateToParams(params, nextState)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    if (hydratedOnce.current) return
    hydratedOnce.current = true
    const stored = readStoredLaunchpadState()
    setStoredState(stored)
    setHydrated(true)
    if (!hasLaunchpadUrlState(searchParams) && stored) {
      replaceUrl(stored)
    }
  }, [replaceUrl, searchParams])

  useEffect(() => {
    if (!hydrated) return
    setStoredState(state)
    writeStoredLaunchpadState(state)
  }, [hydrated, state])

  const commitState = useCallback(
    (nextState: LaunchpadState) => {
      const normalized = coerceStoredState(nextState) ?? createDefaultLaunchpadState()
      setStoredState(normalized)
      writeStoredLaunchpadState(normalized)
      replaceUrl(normalized)
    },
    [replaceUrl]
  )

  const updateState = useCallback(
    (updater: (current: LaunchpadState) => LaunchpadState) => {
      commitState(updater(state))
    },
    [commitState, state]
  )

  const setScope = useCallback(
    (scope: LaunchpadScope) => {
      updateState((current) => ({ ...current, scope }))
    },
    [updateState]
  )

  const setTrack = useCallback(
    (track: LaunchpadTrack) => {
      updateState((current) => ({ ...current, track }))
    },
    [updateState]
  )

  const setSelectedNpi = useCallback(
    (selectedNpi: string | null) => {
      updateState((current) => ({
        ...current,
        selectedNpi: sanitizeText(selectedNpi),
      }))
    },
    [updateState]
  )

  const togglePin = useCallback(
    (npi: string) => {
      const clean = sanitizeText(npi)
      if (!clean) return
      updateState((current) => {
        const already = current.pinnedNpis.includes(clean)
        const pinnedNpis = already
          ? current.pinnedNpis.filter((p) => p !== clean)
          : uniqueLimited([clean, ...current.pinnedNpis], LAUNCHPAD_PIN_LIMIT)
        return { ...current, pinnedNpis }
      })
    },
    [updateState]
  )

  const clearSelection = useCallback(() => {
    updateState((current) => ({ ...current, selectedNpi: null }))
  }, [updateState])

  const setView = useCallback(
    (view: LaunchpadView) => {
      updateState((current) => ({ ...current, view }))
    },
    [updateState]
  )

  const setMapView = useCallback(
    (mapView: LaunchpadMapView) => {
      updateState((current) => ({ ...current, mapView }))
    },
    [updateState]
  )

  const setSelectedZip = useCallback(
    (selectedZip: string | null) => {
      updateState((current) => ({
        ...current,
        selectedZip: sanitizeZip(selectedZip),
      }))
    },
    [updateState]
  )

  const resetLaunchpadState = useCallback(() => {
    commitState(createDefaultLaunchpadState())
  }, [commitState])

  const clearPins = useCallback(() => {
    updateState((current) => ({ ...current, pinnedNpis: [] }))
  }, [updateState])

  return {
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
  }
}
