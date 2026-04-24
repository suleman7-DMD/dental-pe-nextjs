"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Download,
  Flame,
  GripVertical,
  Pin,
  ThermometerSnowflake,
  ThermometerSun,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RankedTarget } from "@/lib/warroom/signals"

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
              onClick={onClearPins}
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
                    "group relative flex items-start gap-2 rounded-md border p-2 transition-colors",
                    active
                      ? "border-[#B8860B]/40 bg-[#B8860B]/10"
                      : "border-[#E8E5DE] bg-[#FAFAF7] hover:bg-[#FFFFFF]",
                    dragging && "opacity-40",
                    isDropTarget && "ring-2 ring-[#B8860B]/40 ring-offset-1"
                  )}
                >
                  {onReorderPins && (
                    <span
                      className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-[#8F8E82] hover:text-[#6B6B60] active:cursor-grabbing"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
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

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemovePin(npi)
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#707064] transition-colors hover:bg-[#FFFFFF] hover:text-[#C23B3B]"
                    aria-label={`Remove ${target?.practiceName ?? npi}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
