"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "dental-pe-warroom-reviewed-v0"
const MAX_ENTRIES = 5000

interface ReviewedRecord {
  reviewedAt: string
}

type ReviewedMap = Record<string, ReviewedRecord>

function readFromStorage(): ReviewedMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: ReviewedMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || key.length === 0) continue
      if (!value || typeof value !== "object") continue
      const at = (value as { reviewedAt?: unknown }).reviewedAt
      if (typeof at !== "string" || at.length === 0) continue
      out[key] = { reviewedAt: at }
    }
    return out
  } catch {
    return {}
  }
}

function writeToStorage(map: ReviewedMap): void {
  if (typeof window === "undefined") return
  try {
    const entries = Object.entries(map)
    let trimmed = map
    if (entries.length > MAX_ENTRIES) {
      const sorted = entries
        .sort((a, b) => (a[1].reviewedAt < b[1].reviewedAt ? 1 : -1))
        .slice(0, MAX_ENTRIES)
      trimmed = Object.fromEntries(sorted)
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage quota exceeded or disabled — drop silently
  }
}

export function useWarroomReviewed() {
  const [map, setMap] = useState<ReviewedMap>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setMap(readFromStorage())
    setHydrated(true)

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return
      setMap(readFromStorage())
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const reviewedSet = useMemo(() => new Set(Object.keys(map)), [map])

  const markReviewed = useCallback((npi: string) => {
    if (!npi) return
    setMap((prev) => {
      const next: ReviewedMap = { ...prev, [npi]: { reviewedAt: new Date().toISOString() } }
      writeToStorage(next)
      return next
    })
  }, [])

  const unmarkReviewed = useCallback((npi: string) => {
    if (!npi) return
    setMap((prev) => {
      if (!(npi in prev)) return prev
      const next: ReviewedMap = { ...prev }
      delete next[npi]
      writeToStorage(next)
      return next
    })
  }, [])

  const toggleReviewed = useCallback((npi: string) => {
    if (!npi) return
    setMap((prev) => {
      const next: ReviewedMap = { ...prev }
      if (npi in next) delete next[npi]
      else next[npi] = { reviewedAt: new Date().toISOString() }
      writeToStorage(next)
      return next
    })
  }, [])

  const clearAllReviewed = useCallback(() => {
    setMap({})
    writeToStorage({})
  }, [])

  const reviewedAt = useCallback(
    (npi: string): string | null => map[npi]?.reviewedAt ?? null,
    [map]
  )

  const isReviewed = useCallback((npi: string): boolean => npi in map, [map])

  return {
    map,
    reviewedSet,
    hydrated,
    isReviewed,
    reviewedAt,
    markReviewed,
    unmarkReviewed,
    toggleReviewed,
    clearAllReviewed,
  }
}
