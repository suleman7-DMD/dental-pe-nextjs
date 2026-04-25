"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Columns2,
  Download,
  Flame,
  GripVertical,
  Pin,
  StickyNote,
  ThermometerSnowflake,
  ThermometerSun,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { RankedTarget } from "@/lib/warroom/signals"
import {
  PIN_NOTE_MAX_LENGTH,
  useWarroomPinNotes,
} from "@/lib/hooks/use-warroom-pin-notes"
import { PinCompareDrawer } from "./pin-compare-drawer"

interface PinboardTrayProps {
  pins: string[]
  selectedEntity: string | null
  onPinEntity: (entity: string) => void
  onSelectEntity: (entity: string) => void
  onRemovePin: (entity: string) => void
  onReorderPins?: (nextPins: string[]) => void
  onClearPins?: () => void
  pinTargets?: Map<string, RankedTarget>
}

const TIER_META: Record<
  RankedTarget["tier"],
  { label: string; color: string; icon: typeof Flame }
> = {
  hot: { label: "Hot", color: "#C23B3B", icon: Flame },
  warm: { label: "Warm", color: "#D4920B", icon: ThermometerSun },
  cool: { label: "Cool", color: "#2563EB", icon: ThermometerSnowflake },
  cold: { label: "Cold", color: "#6B6B60", icon: ThermometerSnowflake },
}

function formatLocationLine(target: RankedTarget | undefined): string {
  if (!target) return "Practice metadata not loaded"
  const parts = [target.city, target.zip].filter(
    (part): part is string => Boolean(part && part.trim())
  )
  return parts.length > 0 ? parts.join(" · ") : "Location unknown"
}

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return ""
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function buildPinsCsv(
  pins: string[],
  pinTargets: Map<string, RankedTarget> | undefined
): string {
  const header = [
    "rank",
    "npi",
    "practice_name",
    "city",
    "zip",
    "ownership_group",
    "entity_classification",
    "buyability_score",
    "score",
    "tier",
    "flag_count",
    "flags",
    "headline",
  ].join(",")

  const rows = pins.map((npi, index) => {
    const target = pinTargets?.get(npi)
    const flagCount = target?.flagCount ?? ""
    const flagsJoined = target?.flags.join("|") ?? ""
    return [
      index + 1,
      npi,
      target?.practiceName ?? "",
      target?.city ?? "",
      target?.zip ?? "",
      target?.ownershipGroup ?? "",
      target?.entityClassification ?? "",
      target?.buyabilityScore ?? "",
      target?.score ?? "",
      target?.tier ?? "",
      flagCount,
      flagsJoined,
      target?.headline ?? "",
    ]
      .map(csvEscape)
      .join(",")
  })

  return [header, ...rows].join("\n")
}

interface PinNoteEditorProps {
  npi: string
  initialValue: string
  onSave: (value: string) => void
  onClose: () => void
}

function PinNoteEditor({ initialValue, onSave, onClose }: PinNoteEditorProps) {
  const [draft, setDraft] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setDraft(initialValue)
  }, [initialValue])

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(
      textareaRef.current.value.length,
      textareaRef.current.value.length
    )
  }, [])

  const handleCommit = useCallback(() => {
    if (draft !== initialValue) onSave(draft)
    onClose()
  }, [draft, initialValue, onClose, onSave])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setDraft(initialValue)
        onClose()
        return
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleCommit()
      }
    },
    [handleCommit, initialValue, onClose]
  )

  const remaining = PIN_NOTE_MAX_LENGTH - draft.length

  return (
    <div
      className="rounded-md border border-[#B8860B]/30 bg-[#FFFFFF] p-2"
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value.slice(0, PIN_NOTE_MAX_LENGTH))}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        placeholder="e.g., Called 3/15 — owner retiring 2027, wants $1.2M"
        className="block w-full resize-y rounded border border-[#E8E5DE] bg-[#FAFAF7] px-2 py-1.5 text-[12px] text-[#1A1A1A] placeholder:text-[#9C9C90] focus:border-[#B8860B]/60 focus:outline-none focus:ring-2 focus:ring-[#B8860B]/20"
        rows={3}
        maxLength={PIN_NOTE_MAX_LENGTH}
      />
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#707064]">
        <span>
          ⌘+Enter to save · Esc to cancel · saved to this device
        </span>
        <span
          className={cn(
            "font-mono tabular-nums",
            remaining < 100 ? "text-[#D4920B]" : "text-[#9C9C90]"
          )}
        >
          {remaining}
        </span>
      </div>
    </div>
  )
}


export function PinboardTray({
  pins,
  selectedEntity,
  onPinEntity,
  onSelectEntity,
  onRemovePin,
  onReorderPins,
  onClearPins,
  pinTargets,
}: PinboardTrayProps) {
  const selectedIsPinned = selectedEntity ? pins.includes(selectedEntity) : false
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [openNoteNpi, setOpenNoteNpi] = useState<string | null>(null)
  const gripRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusNpi = useRef<string | null>(null)
  const { notes, getNote, hasNote, setNote } = useWarroomPinNotes()
  const canCompare = pins.length >= 2

  useEffect(() => {
    if (!pendingFocusNpi.current) return
    const btn = gripRefs.current.get(pendingFocusNpi.current)
    pendingFocusNpi.current = null
    if (btn) btn.focus()
  }, [pins])

  const hydratedCount = useMemo(() => {
    if (!pinTargets) return 0
    return pins.reduce((count, npi) => (pinTargets.has(npi) ? count + 1 : count), 0)
  }, [pins, pinTargets])

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent, index: number) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setOverIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setOverIndex(null)
  }, [])

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex == null || dragIndex === targetIndex || !onReorderPins) {
        setDragIndex(null)
        setOverIndex(null)
        return
      }
      const next = [...pins]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      onReorderPins(next)
      setDragIndex(null)
      setOverIndex(null)
    },
    [dragIndex, onReorderPins, pins]
  )

  const movePin = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!onReorderPins) return
      if (fromIndex === toIndex) return
      if (toIndex < 0 || toIndex >= pins.length) return
      const next = [...pins]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      pendingFocusNpi.current = moved
      onReorderPins(next)
    },
    [onReorderPins, pins]
  )

  const handleGripKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (!onReorderPins) return
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          movePin(index, index - 1)
          break
        case "ArrowDown":
          event.preventDefault()
          movePin(index, index + 1)
          break
        case "Home":
          event.preventDefault()
          movePin(index, 0)
          break
        case "End":
          event.preventDefault()
          movePin(index, pins.length - 1)
          break
      }
    },
    [movePin, onReorderPins, pins.length]
  )

  const handleExport = useCallback(() => {
    if (pins.length === 0) return
    const csv = buildPinsCsv(pins, pinTargets)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    link.download = `warroom-pinboard-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [pins, pinTargets])

  return (
    <section className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
      <div className="flex items-center justify-between border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Pinboard</h2>
          <p className="text-xs text-[#707064]">
            {pins.length} pinned
            {pinTargets && pins.length > 0 && (
              <span className="ml-1 text-[10px]">
                · {hydratedCount}/{pins.length} hydrated
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCompare}
            onClick={() => setCompareOpen(true)}
            className="h-8 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
            aria-label={
              canCompare
                ? `Compare ${pins.length} pinned practices side-by-side`
                : "Pin at least 2 practices to compare"
            }
            title={canCompare ? "Compare side-by-side" : "Need 2+ pins"}
          >
            <Columns2 className="h-3.5 w-3.5" />
            Compare
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pins.length === 0}
            onClick={handleExport}
            className="h-8 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
            aria-label="Export pinboard as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          {onClearPins && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pins.length === 0}
              onClick={() => setConfirmClearOpen(true)}
              className="h-8 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#C23B3B]"
              aria-label="Clear all pins"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedEntity || selectedIsPinned}
            onClick={() => selectedEntity && onPinEntity(selectedEntity)}
            className="h-8 border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
          >
            <Pin className="h-3.5 w-3.5" />
            Pin
          </Button>
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-3 scrollbar-thin">
        {pins.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#F7F7F4] px-3 py-6 text-center text-sm text-[#707064]">
            <Pin className="mx-auto h-4 w-4 text-[#8F8E82]" />
            <p className="mt-1.5 font-medium">No pinned practices</p>
            <p className="mt-0.5 text-[11px]">Click the pin icon on any target to save it.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pins.map((npi, index) => {
              const active = selectedEntity === npi
              const target = pinTargets?.get(npi)
              const tier = target ? TIER_META[target.tier] : null
              const TierIcon = tier?.icon
              const dragging = dragIndex === index
              const isDropTarget = overIndex === index && dragIndex != null && dragIndex !== index

              return (
                <li
                  key={npi}
                  draggable={Boolean(onReorderPins)}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDragLeave={() => setOverIndex(null)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group relative flex flex-col gap-2 rounded-md border p-2 transition-colors",
                    active
                      ? "border-[#B8860B]/40 bg-[#B8860B]/10"
                      : "border-[#E8E5DE] bg-[#FAFAF7] hover:bg-[#FFFFFF]",
                    dragging && "opacity-40",
                    isDropTarget && "ring-2 ring-[#B8860B]/40 ring-offset-1"
                  )}
                >
                  <div className="flex items-start gap-2">
                  {onReorderPins && (
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) gripRefs.current.set(npi, node)
                        else gripRefs.current.delete(npi)
                      }}
                      onKeyDown={(event) => handleGripKeyDown(event, index)}
                      className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-[#8F8E82] hover:text-[#6B6B60] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]/60 active:cursor-grabbing"
                      aria-label={`Reorder ${target?.practiceName ?? npi}. Position ${index + 1} of ${pins.length}. Use arrow up or down to move.`}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectEntity(npi)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#1A1A1A]">
                          {target?.practiceName ?? `NPI ${npi}`}
                        </p>
                        <p className="truncate text-[11px] text-[#6B6B60]">
                          {formatLocationLine(target)}
                        </p>
                      </div>
                      {target && (
                        <span className="shrink-0 font-mono text-[13px] font-bold text-[#1A1A1A]">
                          {target.score}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {tier && TierIcon && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${tier.color}15`,
                            color: tier.color,
                          }}
                        >
                          <TierIcon className="h-3 w-3" />
                          {tier.label}
                        </span>
                      )}
                      {target?.ownershipGroup && (
                        <span className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 uppercase tracking-wider text-[#6B6B60]">
                          {target.ownershipGroup}
                        </span>
                      )}
                      {target && target.flagCount > 0 && (
                        <span className="rounded-full bg-[#B8860B]/10 px-1.5 py-0.5 font-semibold text-[#B8860B]">
                          {target.flagCount} flag{target.flagCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {!target && (
                        <span className="rounded-full border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[10px] text-[#707064]">
                          {npi}
                        </span>
                      )}
                    </div>
                    {target?.flags[0] && (
                      <p className="mt-1 truncate text-[11px] italic text-[#6B6B60]">
                        Top signal: {target.flags[0].replace(/_/g, " ")}
                      </p>
                    )}
                  </button>

                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setOpenNoteNpi((current) => (current === npi ? null : npi))
                      }}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                        hasNote(npi)
                          ? "bg-[#B8860B]/15 text-[#B8860B] hover:bg-[#B8860B]/25"
                          : "text-[#707064] hover:bg-[#FFFFFF] hover:text-[#1A1A1A]",
                        openNoteNpi === npi && "ring-1 ring-[#B8860B]/40"
                      )}
                      aria-label={
                        openNoteNpi === npi
                          ? `Close note for ${target?.practiceName ?? npi}`
                          : hasNote(npi)
                            ? `Edit note for ${target?.practiceName ?? npi}`
                            : `Add note for ${target?.practiceName ?? npi}`
                      }
                      aria-expanded={openNoteNpi === npi}
                      title={hasNote(npi) ? "Edit note" : "Add note"}
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemovePin(npi)
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#707064] transition-colors hover:bg-[#FFFFFF] hover:text-[#C23B3B]"
                      aria-label={`Remove ${target?.practiceName ?? npi}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  </div>
                  {openNoteNpi === npi ? (
                    <PinNoteEditor
                      npi={npi}
                      initialValue={getNote(npi)}
                      onSave={(value) => setNote(npi, value)}
                      onClose={() => setOpenNoteNpi(null)}
                    />
                  ) : hasNote(npi) ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setOpenNoteNpi(npi)
                      }}
                      className="-mt-1 truncate rounded bg-[#B8860B]/8 px-2 py-1 text-left text-[11px] italic text-[#1A1A1A] hover:bg-[#B8860B]/15"
                      aria-label={`Edit note for ${target?.practiceName ?? npi}`}
                      title="Click to edit note"
                    >
                      <StickyNote className="mr-1 inline h-3 w-3 text-[#B8860B]" />
                      {getNote(npi)}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Clear all pins?</DialogTitle>
            <DialogDescription>
              {pins.length} pinned {pins.length === 1 ? "practice" : "practices"} will be removed from the
              pinboard. This cannot be undone — re-pin them individually if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmClearOpen(false)}
              className="border-[#E8E5DE]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onClearPins?.()
                setConfirmClearOpen(false)
              }}
              className="bg-[#C23B3B] text-white hover:bg-[#A82F2F]"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear {pins.length} {pins.length === 1 ? "pin" : "pins"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinCompareDrawer
        open={compareOpen}
        onOpenChange={setCompareOpen}
        pins={pins}
        pinTargets={pinTargets}
        pinNotes={notes}
        onSelectEntity={onSelectEntity}
        onRemovePin={onRemovePin}
      />
    </section>
  )
}
