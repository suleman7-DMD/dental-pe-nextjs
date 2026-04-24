"use client"

import { Keyboard } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface KeyboardShortcutsOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutRow {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  label: string
  rows: ShortcutRow[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: "Navigation",
    rows: [
      { keys: ["?"], description: "Toggle this cheat sheet" },
      { keys: ["⌘", "K"], description: "Focus intent bar" },
      { keys: ["/"], description: "Focus intent bar" },
      { keys: ["Esc"], description: "Close drawer / cheat sheet / clear focus" },
    ],
  },
  {
    label: "Modes",
    rows: [
      { keys: ["1"], description: "Sitrep — situation snapshot" },
      { keys: ["2"], description: "Hunt — target prospecting" },
      { keys: ["3"], description: "Profile — deep dive on one target" },
      { keys: ["4"], description: "Investigate — signal patterns" },
    ],
  },
  {
    label: "Actions",
    rows: [
      { keys: ["R"], description: "Reset filters + intent + selection" },
      { keys: ["P"], description: "Toggle pin on selected target" },
    ],
  },
]

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-[#D4D0C8] bg-[#F7F7F4] px-1.5 font-mono text-[11px] font-semibold text-[#1A1A1A] shadow-sm">
      {label}
    </kbd>
  )
}

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1A1A1A]">
            <Keyboard className="h-4 w-4 text-[#B8860B]" />
            Warroom keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-[#6B6B60]">
            Single-key shortcuts are disabled while typing in an input or
            textarea.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#707064]">
                {group.label}
              </p>
              <ul className="space-y-1.5">
                {group.rows.map((row) => (
                  <li
                    key={row.description}
                    className="flex items-center justify-between gap-3 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-1.5"
                  >
                    <span className="text-[12px] text-[#1A1A1A]">
                      {row.description}
                    </span>
                    <span className="flex items-center gap-1">
                      {row.keys.map((key, idx) => (
                        <span key={`${row.description}-${idx}`} className="flex items-center gap-1">
                          {idx > 0 && (
                            <span className="text-[10px] text-[#707064]">+</span>
                          )}
                          <Key label={key} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
