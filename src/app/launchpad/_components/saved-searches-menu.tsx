"use client"

import { useEffect, useRef, useState } from "react"
import { Bookmark, BookmarkPlus, Check, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getLaunchpadScopeOption, type LaunchpadScope } from "@/lib/launchpad/scope"
import {
  LAUNCHPAD_TRACK_SHORT_LABELS,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"
import type { LaunchpadSavedSearch } from "@/lib/hooks/use-launchpad-saved-searches"

interface SavedSearchesMenuProps {
  searches: LaunchpadSavedSearch[]
  currentScope: LaunchpadScope
  currentTrack: LaunchpadTrack
  currentPinnedCount: number
  onSave: (name: string) => string | null
  onDelete: (id: string) => void
  onLoad: (search: LaunchpadSavedSearch) => void
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export function SavedSearchesMenu({
  searches,
  currentScope,
  currentTrack,
  currentPinnedCount,
  onSave,
  onDelete,
  onLoad,
}: SavedSearchesMenuProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [justSavedId, setJustSavedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (!justSavedId) return
    const timer = window.setTimeout(() => setJustSavedId(null), 1600)
    return () => window.clearTimeout(timer)
  }, [justSavedId])

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = onSave(trimmed)
    if (id) {
      setName("")
      setJustSavedId(id)
    }
  }

  const scopeLabel = getLaunchpadScopeOption(currentScope).shortLabel
  const trackLabel = LAUNCHPAD_TRACK_SHORT_LABELS[currentTrack] ?? currentTrack

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[11px] font-medium uppercase tracking-wider transition-colors",
          open
            ? "border-[#B8860B] bg-[#B8860B]/10 text-[#B8860B]"
            : "border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#FAFAF7] hover:text-[#1A1A1A]"
        )}
      >
        <Bookmark className="h-3.5 w-3.5" />
        Saved
        {searches.length > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B8860B] px-1 text-[10px] font-bold text-white">
            {searches.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Saved searches"
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-[320px] rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] shadow-lg"
        >
          {/* Save current view */}
          <div className="border-b border-[#E8E5DE] p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
              Save current view
            </p>
            <p className="mb-2 text-[11px] text-[#9C9C90]">
              {scopeLabel} · {trackLabel} · {currentPinnedCount} pin
              {currentPinnedCount === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSave()
                  }
                }}
                placeholder="Name this view…"
                maxLength={64}
                className="h-8 flex-1 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-2 text-xs text-[#1A1A1A] placeholder:text-[#9C9C90] focus:border-[#B8860B] focus:bg-[#FFFFFF] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim() || searches.length >= 12}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-[#B8860B] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#A67309] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BookmarkPlus className="h-3 w-3" />
                Save
              </button>
            </div>
            {searches.length >= 12 && (
              <p className="mt-1 text-[10px] text-[#C23B3B]">
                Limit reached (12). Delete a saved view to add more.
              </p>
            )}
          </div>

          {/* Saved list */}
          {searches.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[#9C9C90]">
              No saved views yet. Save the current filters + pins to return later.
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {searches.map((search) => {
                const scope = getLaunchpadScopeOption(search.scope)
                const track =
                  LAUNCHPAD_TRACK_SHORT_LABELS[search.track] ?? search.track
                const isFresh = search.id === justSavedId
                return (
                  <li
                    key={search.id}
                    className={cn(
                      "flex items-start justify-between gap-2 border-b border-[#E8E5DE] px-3 py-2 last:border-b-0 transition-colors",
                      isFresh && "bg-[#2D8B4E]/5"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onLoad(search)
                        setOpen(false)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        {isFresh && (
                          <Check className="h-3 w-3 shrink-0 text-[#2D8B4E]" />
                        )}
                        <span className="truncate text-xs font-semibold text-[#1A1A1A]">
                          {search.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="rounded-full bg-[#F5F5F0] px-1.5 py-0.5 text-[9px] font-medium text-[#6B6B60]">
                          {scope.shortLabel}
                        </span>
                        <span className="rounded-full bg-[#B8860B]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#B8860B]">
                          {track}
                        </span>
                        {search.pinnedNpis.length > 0 && (
                          <span className="rounded-full bg-[#2563EB]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#2563EB]">
                            {search.pinnedNpis.length} pin
                            {search.pinnedNpis.length === 1 ? "" : "s"}
                          </span>
                        )}
                        <span className="text-[9px] text-[#9C9C90]">
                          {formatDate(search.createdAt)}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(search.id)}
                      aria-label={`Delete saved view ${search.name}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#9C9C90] transition-colors hover:bg-[#C23B3B]/10 hover:text-[#C23B3B]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-[#E8E5DE] bg-[#FAFAF7] px-3 py-2">
            <span className="text-[10px] text-[#9C9C90]">
              Stored on this device
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-[#9C9C90] transition-colors hover:bg-[#F5F5F0] hover:text-[#1A1A1A]"
              aria-label="Close saved searches"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
