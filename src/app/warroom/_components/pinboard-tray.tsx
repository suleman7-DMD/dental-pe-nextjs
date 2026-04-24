"use client"

import { Pin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PinboardTrayProps {
  pins: string[]
  selectedEntity: string | null
  onPinEntity: (entity: string) => void
  onSelectEntity: (entity: string) => void
  onRemovePin: (entity: string) => void
}

export function PinboardTray({
  pins,
  selectedEntity,
  onPinEntity,
  onSelectEntity,
  onRemovePin,
}: PinboardTrayProps) {
  const selectedIsPinned = selectedEntity
    ? pins.includes(selectedEntity)
    : false

  return (
    <section className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
      <div className="flex items-center justify-between border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Pinboard</h2>
          <p className="text-xs text-[#9C9C90]">{pins.length} pinned</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedEntity || selectedIsPinned}
          onClick={() => selectedEntity && onPinEntity(selectedEntity)}
          className="border-[#E8E5DE] bg-[#FFFFFF] text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
        >
          <Pin className="h-3.5 w-3.5" />
          Pin
        </Button>
      </div>

      <div className="max-h-[260px] overflow-y-auto p-3 scrollbar-thin">
        {pins.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#F7F7F4] px-3 py-5 text-center text-sm text-[#9C9C90]">
            No pinned entities
          </div>
        ) : (
          <div className="space-y-2">
            {pins.map((pin) => {
              const active = selectedEntity === pin

              return (
                <div
                  key={pin}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-2",
                    active
                      ? "border-[#B8860B]/40 bg-[#B8860B]/10"
                      : "border-[#E8E5DE] bg-[#FAFAF7]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectEntity(pin)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[#1A1A1A]"
                  >
                    {pin}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePin(pin)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9C9C90] transition-colors hover:bg-[#FFFFFF] hover:text-[#C23B3B]"
                    aria-label={`Remove ${pin}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
