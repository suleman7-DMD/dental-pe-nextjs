"use client"

import { useCallback, useEffect, useState } from "react"
import {
  DEFAULT_LAUNCHPAD_SCOPE,
  isLaunchpadScope,
  type LaunchpadScope,
} from "@/lib/launchpad/scope"
import {
  DEFAULT_LAUNCHPAD_TRACK,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"

const STORAGE_KEY = "dental-pe-launchpad-saved-searches-v0"
const SEARCH_LIMIT = 12
const TRACK_IDS: ReadonlySet<string> = new Set([
  "all",
  "succession",
  "high_volume",
  "dso",
])

export interface LaunchpadSavedSearch {
  id: string
  name: string
  scope: LaunchpadScope
  track: LaunchpadTrack
  pinnedNpis: string[]
  createdAt: string
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function isTrack(value: unknown): value is LaunchpadTrack {
  return typeof value === "string" && TRACK_IDS.has(value)
}

function sanitizeNpi(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, 16)
  return /^[0-9A-Z_-]+$/i.test(trimmed) ? trimmed : null
}

function sanitizeName(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, 64)
}

function coerce(raw: unknown): LaunchpadSavedSearch | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === "string" && r.id.length > 0 ? r.id : genId()
  const name = sanitizeName(r.name)
  if (!name) return null
  const scope = isLaunchpadScope(r.scope) ? r.scope : DEFAULT_LAUNCHPAD_SCOPE
  const track = isTrack(r.track) ? r.track : DEFAULT_LAUNCHPAD_TRACK
  const pinnedNpis = Array.isArray(r.pinnedNpis)
    ? (r.pinnedNpis
        .map((n) => sanitizeNpi(n))
        .filter((n): n is string => n !== null) as string[])
    : []
  const createdAt =
    typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString()
  return { id, name, scope, track, pinnedNpis, createdAt }
}

function readAll(): LaunchpadSavedSearch[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(coerce)
      .filter((s): s is LaunchpadSavedSearch => s !== null)
      .slice(0, SEARCH_LIMIT)
  } catch {
    return []
  }
}

function writeAll(entries: LaunchpadSavedSearch[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, SEARCH_LIMIT))
    )
  } catch {
    // localStorage unavailable
  }
}

export function useLaunchpadSavedSearches() {
  const [searches, setSearches] = useState<LaunchpadSavedSearch[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setSearches(readAll())
    setHydrated(true)
  }, [])

  const save = useCallback(
    (
      name: string,
      scope: LaunchpadScope,
      track: LaunchpadTrack,
      pinnedNpis: string[]
    ) => {
      const cleanName = sanitizeName(name)
      if (!cleanName) return null
      const entry: LaunchpadSavedSearch = {
        id: genId(),
        name: cleanName,
        scope,
        track,
        pinnedNpis: pinnedNpis.slice(0, 24),
        createdAt: new Date().toISOString(),
      }
      setSearches((prev) => {
        const next = [entry, ...prev].slice(0, SEARCH_LIMIT)
        writeAll(next)
        return next
      })
      return entry.id
    },
    []
  )

  const remove = useCallback((id: string) => {
    setSearches((prev) => {
      const next = prev.filter((s) => s.id !== id)
      writeAll(next)
      return next
    })
  }, [])

  const rename = useCallback((id: string, name: string) => {
    const cleanName = sanitizeName(name)
    if (!cleanName) return
    setSearches((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, name: cleanName } : s))
      writeAll(next)
      return next
    })
  }, [])

  return { searches, hydrated, save, remove, rename }
}
