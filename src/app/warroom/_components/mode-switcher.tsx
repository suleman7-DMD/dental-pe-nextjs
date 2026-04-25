"use client"

import {
  Crosshair,
  FileSearch,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { WARROOM_MODES, type WarroomMode } from "@/lib/warroom/mode"

interface ModeSwitcherProps {
  value: WarroomMode
  onChange: (mode: WarroomMode) => void
}

const MODE_ICONS: Record<WarroomMode, LucideIcon> = {
  hunt: Crosshair,
  investigate: FileSearch,
}

export function ModeSwitcher({ value, onChange }: ModeSwitcherProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#707064]">
        Mode
      </span>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#E8E5DE] bg-[#F5F5F0] p-1">
        {WARROOM_MODES.map((mode) => {
          const Icon = MODE_ICONS[mode.id]
          const active = value === mode.id

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={cn(
                "flex h-8 min-w-[94px] items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors",
                active
                  ? "border border-[#B8860B]/30 bg-[#FFFFFF] text-[#1A1A1A] shadow-sm"
                  : "border border-transparent text-[#6B6B60] hover:bg-[#FFFFFF]/70 hover:text-[#1A1A1A]"
              )}
              aria-pressed={active}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  active ? "text-[#B8860B]" : "text-[#707064]"
                )}
              />
              <span>{mode.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
