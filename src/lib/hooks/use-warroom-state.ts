"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  DEFAULT_WARROOM_LENS,
  DEFAULT_WARROOM_MODE,
  isWarroomLens,
  isWarroomMode,
  type WarroomLens,
  type WarroomMode,
} from "@/lib/warroom/mode"
import {
  DEFAULT_WARROOM_SCOPE_ID,
  isWarroomScopeId,
  type WarroomScopeId,
} from "@/lib/warroom/scope"

export const WARROOM_LOCAL_STORAGE_KEY = "dental-pe-warroom-state-v0"
export const WARROOM_PIN_LIMIT = 20

export const WARROOM_QUERY_PARAMS = {
  scope: "scope",
  mode: "mode",
  lens: "lens",
  selectedEntity: "entity",
  signals: "signals",
  confidence: "confidence",
  pins: "pins",
  intent: "intent",
} as const

export const WARROOM_INTENT_MAX_LENGTH = 512

export const WARROOM_SIGNAL_FILTERS = [
  { id: "stealth_dso", label: "Stealth DSO" },
  { id: "phantom_inventory", label: "Phantom" },
  { id: "revenue_default", label: "Revenue Default" },
  { id: "family_dynasty", label: "Family Dynasty" },
  { id: "micro_cluster", label: "Micro-Cluster" },
  { id: "retirement_risk", label: "Retirement" },
  { id: "recent_changes", label: "Recent Movement" },
  { id: "high_peer_retirement", label: "Peer Retirement" },
  { id: "ada_gap", label: "ADA Gap" },
] as const

export type WarroomSignalFilter = (typeof WARROOM_SIGNAL_FILTERS)[number]["id"]
export type WarroomConfidenceFilter = "all" | "high" | "medium" | "low"

export interface WarroomFilters {
  signals: WarroomSignalFilter[]
  confidence: WarroomConfidenceFilter
  pins: string[]
}

export interface WarroomState {
  scope: WarroomScopeId
  mode: WarroomMode
  lens: WarroomLens
  selectedEntity: string | null
  filters: WarroomFilters
  intent: string
}

type SearchParamReader = Pick<URLSearchParams, "get" | "has" | "toString">

const SIGNAL_FILTER_IDS: ReadonlySet<string> = new Set(
  WARROOM_SIGNAL_FILTERS.map((filter) => filter.id)
)

const CONFIDENCE_FILTER_IDS: ReadonlySet<string> = new Set([
  "all",
  "high",
  "medium",
  "low",
])

const WARROOM_PARAM_KEYS = Object.values(WARROOM_QUERY_PARAMS)

function createDefaultFilters(): WarroomFilters {
  return {
    signals: [],
    confidence: "all",
    pins: [],
  }
}

function createDefaultWarroomState(): WarroomState {
  return {
    scope: DEFAULT_WARROOM_SCOPE_ID,
    mode: DEFAULT_WARROOM_MODE,
    lens: DEFAULT_WARROOM_LENS,
    selectedEntity: null,
    filters: createDefaultFilters(),
    intent: "",
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

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

function coerceSignals(values: unknown): WarroomSignalFilter[] {
  const raw = Array.isArray(values) ? values : []
  return uniqueLimited(
    raw.filter((value): value is string => typeof value === "string"),
    WARROOM_SIGNAL_FILTERS.length
  ).filter((value): value is WarroomSignalFilter => SIGNAL_FILTER_IDS.has(value))
}

function coerceConfidence(value: unknown): WarroomConfidenceFilter {
  return typeof value === "string" && CONFIDENCE_FILTER_IDS.has(value)
    ? (value as WarroomConfidenceFilter)
    : "all"
}

function coerceFilters(value: unknown, fallback = createDefaultFilters()): WarroomFilters {
  if (!isRecord(value)) return fallback

  return {
    signals: coerceSignals(value.signals),
    confidence: coerceConfidence(value.confidence),
    pins: uniqueLimited(
      Array.isArray(value.pins)
        ? value.pins.filter((item): item is string => typeof item === "string")
        : [],
      WARROOM_PIN_LIMIT
    ),
  }
}

function coerceStoredState(value: unknown): WarroomState | null {
  if (!isRecord(value)) return null

  const defaults = createDefaultWarroomState()
  const selectedEntity = sanitizeText(value.selectedEntity)
  const intent = sanitizeText(value.intent, WARROOM_INTENT_MAX_LENGTH) ?? ""

  return {
    scope: isWarroomScopeId(value.scope) ? value.scope : defaults.scope,
    mode: isWarroomMode(value.mode) ? value.mode : defaults.mode,
    lens: isWarroomLens(value.lens) ? value.lens : defaults.lens,
    selectedEntity,
    filters: coerceFilters(value.filters, defaults.filters),
    intent,
  }
}

function parseUrlState(searchParams: SearchParamReader): WarroomState {
  const defaults = createDefaultWarroomState()
  const scope = searchParams.get(WARROOM_QUERY_PARAMS.scope)
  const mode = searchParams.get(WARROOM_QUERY_PARAMS.mode)
  const lens = searchParams.get(WARROOM_QUERY_PARAMS.lens)
  const confidence = searchParams.get(WARROOM_QUERY_PARAMS.confidence)

  return {
    scope: isWarroomScopeId(scope) ? scope : defaults.scope,
    mode: isWarroomMode(mode) ? mode : defaults.mode,
    lens: isWarroomLens(lens) ? lens : defaults.lens,
    selectedEntity: sanitizeText(searchParams.get(WARROOM_QUERY_PARAMS.selectedEntity)),
    filters: {
      signals: coerceSignals(parseList(searchParams.get(WARROOM_QUERY_PARAMS.signals))),
      confidence: coerceConfidence(confidence),
      pins: uniqueLimited(parseList(searchParams.get(WARROOM_QUERY_PARAMS.pins)), WARROOM_PIN_LIMIT),
    },
    intent:
      sanitizeText(
        searchParams.get(WARROOM_QUERY_PARAMS.intent),
        WARROOM_INTENT_MAX_LENGTH
      ) ?? "",
  }
}

function hasWarroomUrlState(searchParams: SearchParamReader): boolean {
  return WARROOM_PARAM_KEYS.some((key) => searchParams.has(key))
}

function readStoredWarroomState(): WarroomState | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(WARROOM_LOCAL_STORAGE_KEY)
    if (!raw) return null
    return coerceStoredState(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeStoredWarroomState(state: WarroomState) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(WARROOM_LOCAL_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable
  }
}

function applyStateToParams(params: URLSearchParams, state: WarroomState) {
  params.set(WARROOM_QUERY_PARAMS.scope, state.scope)
  params.set(WARROOM_QUERY_PARAMS.mode, state.mode)
  params.set(WARROOM_QUERY_PARAMS.lens, state.lens)

  if (state.selectedEntity) {
    params.set(WARROOM_QUERY_PARAMS.selectedEntity, state.selectedEntity)
  } else {
    params.delete(WARROOM_QUERY_PARAMS.selectedEntity)
  }

  if (state.filters.signals.length > 0) {
    params.set(WARROOM_QUERY_PARAMS.signals, state.filters.signals.join(","))
  } else {
    params.delete(WARROOM_QUERY_PARAMS.signals)
  }

  if (state.filters.confidence !== "all") {
    params.set(WARROOM_QUERY_PARAMS.confidence, state.filters.confidence)
  } else {
    params.delete(WARROOM_QUERY_PARAMS.confidence)
  }

  if (state.filters.pins.length > 0) {
    params.set(WARROOM_QUERY_PARAMS.pins, state.filters.pins.join(","))
  } else {
    params.delete(WARROOM_QUERY_PARAMS.pins)
  }

  if (state.intent) {
    params.set(WARROOM_QUERY_PARAMS.intent, state.intent)
  } else {
    params.delete(WARROOM_QUERY_PARAMS.intent)
  }
}

export function useWarroomState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const hydratedOnce = useRef(false)
  const [storedState, setStoredState] = useState<WarroomState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const hasUrlState = useMemo(
    () => hasWarroomUrlState(searchParams),
    [searchParams]
  )

  const urlState = useMemo(
    () => parseUrlState(searchParams),
    [searchParams]
  )

  const state = useMemo(
    () => (hasUrlState ? urlState : storedState ?? createDefaultWarroomState()),
    [hasUrlState, storedState, urlState]
  )

  const replaceUrl = useCallback(
    (nextState: WarroomState) => {
      const params = new URLSearchParams(searchParams.toString())
      applyStateToParams(params, nextState)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const urlSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUrlState = useRef<WarroomState | null>(null)
  const replaceUrlRef = useRef(replaceUrl)
  useEffect(() => {
    replaceUrlRef.current = replaceUrl
  }, [replaceUrl])

  const scheduleUrlSync = useCallback((nextState: WarroomState) => {
    pendingUrlState.current = nextState
    if (urlSyncTimeout.current != null) return
    urlSyncTimeout.current = setTimeout(() => {
      urlSyncTimeout.current = null
      const snapshot = pendingUrlState.current
      pendingUrlState.current = null
      if (snapshot) replaceUrlRef.current(snapshot)
    }, 150)
  }, [])

  useEffect(
    () => () => {
      if (urlSyncTimeout.current != null) {
        clearTimeout(urlSyncTimeout.current)
        urlSyncTimeout.current = null
      }
    },
    []
  )

  useEffect(() => {
    if (hydratedOnce.current) return
    hydratedOnce.current = true

    const stored = readStoredWarroomState()
    setStoredState(stored)
    setHydrated(true)

    if (!hasWarroomUrlState(searchParams) && stored) {
      replaceUrl(stored)
    }
  }, [replaceUrl, searchParams])

  useEffect(() => {
    if (!hydrated) return
    setStoredState(state)
    writeStoredWarroomState(state)
  }, [hydrated, state])

  const commitState = useCallback(
    (nextState: WarroomState) => {
      const normalized = coerceStoredState(nextState) ?? createDefaultWarroomState()
      setStoredState(normalized)
      writeStoredWarroomState(normalized)
      scheduleUrlSync(normalized)
    },
    [scheduleUrlSync]
  )

  const updateState = useCallback(
    (updater: (current: WarroomState) => WarroomState) => {
      commitState(updater(state))
    },
    [commitState, state]
  )

  const setScope = useCallback(
    (scope: WarroomScopeId) => {
      updateState((current) => ({ ...current, scope }))
    },
    [updateState]
  )

  const setMode = useCallback(
    (mode: WarroomMode) => {
      updateState((current) => ({ ...current, mode }))
    },
    [updateState]
  )

  const setLens = useCallback(
    (lens: WarroomLens) => {
      updateState((current) => ({ ...current, lens }))
    },
    [updateState]
  )

  const setModeAndLens = useCallback(
    (mode: WarroomMode, lens: WarroomLens) => {
      updateState((current) => ({ ...current, mode, lens }))
    },
    [updateState]
  )

  const setSelectedEntity = useCallback(
    (selectedEntity: string | null) => {
      updateState((current) => ({
        ...current,
        selectedEntity: sanitizeText(selectedEntity),
      }))
    },
    [updateState]
  )

  const setFilters = useCallback(
    (
      filters:
        | Partial<WarroomFilters>
        | ((current: WarroomFilters) => WarroomFilters)
    ) => {
      updateState((current) => {
        const nextFilters =
          typeof filters === "function"
            ? filters(current.filters)
            : { ...current.filters, ...filters }

        return {
          ...current,
          filters: coerceFilters(nextFilters, current.filters),
        }
      })
    },
    [updateState]
  )

  const toggleSignalFilter = useCallback(
    (signal: WarroomSignalFilter) => {
      setFilters((current) => {
        const signals = current.signals.includes(signal)
          ? current.signals.filter((item) => item !== signal)
          : [...current.signals, signal]

        return { ...current, signals }
      })
    },
    [setFilters]
  )

  const addPin = useCallback(
    (entity: string): boolean => {
      const clean = sanitizeText(entity)
      if (!clean) return false

      const currentPins = state.filters.pins
      if (
        !currentPins.includes(clean) &&
        currentPins.length >= WARROOM_PIN_LIMIT
      ) {
        return false
      }

      setFilters((current) => ({
        ...current,
        pins: uniqueLimited([clean, ...current.pins], WARROOM_PIN_LIMIT),
      }))
      return true
    },
    [setFilters, state.filters.pins]
  )

  const removePin = useCallback(
    (entity: string) => {
      setFilters((current) => ({
        ...current,
        pins: current.pins.filter((pin) => pin !== entity),
      }))
    },
    [setFilters]
  )

  const reorderPins = useCallback(
    (nextPins: string[]) => {
      setFilters((current) => ({
        ...current,
        pins: uniqueLimited(nextPins, WARROOM_PIN_LIMIT),
      }))
    },
    [setFilters]
  )

  const clearPins = useCallback(() => {
    setFilters((current) => ({ ...current, pins: [] }))
  }, [setFilters])

  const setIntent = useCallback(
    (intent: string) => {
      updateState((current) => ({
        ...current,
        intent:
          sanitizeText(intent, WARROOM_INTENT_MAX_LENGTH) ?? "",
      }))
    },
    [updateState]
  )

  const resetWarroomState = useCallback(() => {
    commitState(createDefaultWarroomState())
  }, [commitState])

  return {
    state,
    hydrated,
    setScope,
    setMode,
    setLens,
    setModeAndLens,
    setSelectedEntity,
    setFilters,
    toggleSignalFilter,
    addPin,
    removePin,
    reorderPins,
    clearPins,
    setIntent,
    resetWarroomState,
  }
}
