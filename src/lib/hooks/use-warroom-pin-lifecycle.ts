"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "dental-pe-warroom-pin-lifecycle-v0"

export const LIFECYCLE_STAGES = [
  "untouched",
  "researching",
  "contacting",
  "in_dialogue",
  "passed",
  "won",
] as const

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  untouched: "Untouched",
  researching: "Researching",
  contacting: "Contacting",
  in_dialogue: "In dialogue",
  passed: "Passed",
  won: "Won",
}

export const LIFECYCLE_STAGE_COLORS: Record<
  LifecycleStage,
  { bg: string; text: string; border: string; dot: string }
> = {
  untouched: {
    bg: "bg-[#F7F7F4]",
    text: "text-[#6B6B60]",
    border: "border-[#E8E5DE]",
    dot: "bg-[#9C9C90]",
  },
  researching: {
    bg: "bg-[#2563EB]/10",
    text: "text-[#2563EB]",
    border: "border-[#2563EB]/30",
    dot: "bg-[#2563EB]",
  },
  contacting: {
    bg: "bg-[#7C3AED]/10",
    text: "text-[#7C3AED]",
    border: "border-[#7C3AED]/30",
    dot: "bg-[#7C3AED]",
  },
  in_dialogue: {
    bg: "bg-[#D4920B]/10",
    text: "text-[#D4920B]",
    border: "border-[#D4920B]/30",
    dot: "bg-[#D4920B]",
  },
  passed: {
    bg: "bg-[#E8E5DE]",
    text: "text-[#6B6B60]",
    border: "border-[#D4D0C8]",
    dot: "bg-[#9C9C90]",
  },
  won: {
    bg: "bg-[#2D8B4E]/10",
    text: "text-[#2D8B4E]",
    border: "border-[#2D8B4E]/30",
    dot: "bg-[#2D8B4E]",
  },
}

const STAGE_SET: ReadonlySet<string> = new Set(LIFECYCLE_STAGES)

export type LifecycleMap = Record<string, LifecycleStage>

function isLifecycleStage(value: unknown): value is LifecycleStage {
  return typeof value === "string" && STAGE_SET.has(value)
}

function readFromStorage(): LifecycleMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: LifecycleMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || key.length === 0) continue
      if (!isLifecycleStage(value)) continue
      if (value === "untouched") continue
      out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function writeToStorage(map: LifecycleMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage quota exceeded or disabled — drop silently
  }
}

export function useWarroomPinLifecycle() {
  const [stages, setStages] = useState<LifecycleMap>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setStages(readFromStorage())
    setHydrated(true)

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return
      setStages(readFromStorage())
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const setStage = useCallback((npi: string, stage: LifecycleStage) => {
    if (!npi) return
    setStages((prev) => {
      const next: LifecycleMap = { ...prev }
      if (stage === "untouched") {
        delete next[npi]
      } else {
        next[npi] = stage
      }
      writeToStorage(next)
      return next
    })
  }, [])

  const clearStage = useCallback((npi: string) => {
    if (!npi) return
    setStages((prev) => {
      if (!(npi in prev)) return prev
      const next: LifecycleMap = { ...prev }
      delete next[npi]
      writeToStorage(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setStages({})
    writeToStorage({})
  }, [])

  const getStage = useCallback(
    (npi: string): LifecycleStage => stages[npi] ?? "untouched",
    [stages]
  )

  const counts = useMemo(() => {
    const tally: Record<LifecycleStage, number> = {
      untouched: 0,
      researching: 0,
      contacting: 0,
      in_dialogue: 0,
      passed: 0,
      won: 0,
    }
    for (const stage of Object.values(stages)) {
      tally[stage] += 1
    }
    return tally
  }, [stages])

  return {
    stages,
    hydrated,
    getStage,
    setStage,
    clearStage,
    clearAll,
    counts,
  }
}
