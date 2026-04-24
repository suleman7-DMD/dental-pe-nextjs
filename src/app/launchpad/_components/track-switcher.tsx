"use client"

import { cn } from "@/lib/utils"
import {
  LAUNCHPAD_TRACKS,
  LAUNCHPAD_TRACK_DESCRIPTIONS,
  LAUNCHPAD_TRACK_SHORT_LABELS,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"

interface TrackSwitcherProps {
  value: LaunchpadTrack
  onChange: (track: LaunchpadTrack) => void
}

export function TrackSwitcher({ value, onChange }: TrackSwitcherProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-[#707064]">
        Track
      </label>
      <div className="flex items-center rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-0.5">
        {LAUNCHPAD_TRACKS.map((track) => {
          const active = value === track
          return (
            <button
              key={track}
              type="button"
              onClick={() => onChange(track)}
              className={cn(
                "h-7 rounded px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                active
                  ? "bg-[#B8860B] text-white"
                  : "text-[#6B6B60] hover:bg-[#F7F7F4] hover:text-[#1A1A1A]"
              )}
              aria-pressed={active}
            >
              {LAUNCHPAD_TRACK_SHORT_LABELS[track]}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-[#6B6B60]">{LAUNCHPAD_TRACK_DESCRIPTIONS[value]}</p>
    </div>
  )
}
