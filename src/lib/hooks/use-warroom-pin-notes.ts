"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "dental-pe-warroom-pin-notes-v0"
const MAX_NOTE_LENGTH = 2000

export type PinNoteMap = Record<string, string>

function readFromStorage(): PinNoteMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: PinNoteMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || key.length === 0) continue
      if (typeof value !== "string" || value.length === 0) continue
      out[key] = value.slice(0, MAX_NOTE_LENGTH)
    }
    return out
  } catch {
    return {}
  }
}

function writeToStorage(notes: PinNoteMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // localStorage quota exceeded or disabled — drop silently
  }
}

export function useWarroomPinNotes() {
  const [notes, setNotes] = useState<PinNoteMap>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setNotes(readFromStorage())
    setHydrated(true)

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return
      setNotes(readFromStorage())
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const setNote = useCallback((npi: string, text: string) => {
    if (!npi) return
    setNotes((prev) => {
      const trimmed = text.slice(0, MAX_NOTE_LENGTH)
      const next: PinNoteMap = { ...prev }
      if (trimmed.trim().length === 0) {
        delete next[npi]
      } else {
        next[npi] = trimmed
      }
      writeToStorage(next)
      return next
    })
  }, [])

  const clearNote = useCallback((npi: string) => {
    if (!npi) return
    setNotes((prev) => {
      if (!(npi in prev)) return prev
      const next: PinNoteMap = { ...prev }
      delete next[npi]
      writeToStorage(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotes({})
    writeToStorage({})
  }, [])

  const getNote = useCallback(
    (npi: string): string => notes[npi] ?? "",
    [notes]
  )

  const hasNote = useCallback(
    (npi: string): boolean => Boolean(notes[npi]?.trim().length),
    [notes]
  )

  return { notes, hydrated, getNote, hasNote, setNote, clearNote, clearAll }
}

export const PIN_NOTE_MAX_LENGTH = MAX_NOTE_LENGTH
