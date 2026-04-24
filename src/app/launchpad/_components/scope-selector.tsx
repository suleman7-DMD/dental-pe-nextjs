"use client"

import { LAUNCHPAD_SCOPES, type LaunchpadScope } from "@/lib/launchpad/scope"

interface LaunchpadScopeSelectorProps {
  value: LaunchpadScope
  onChange: (scope: LaunchpadScope) => void
}

export function LaunchpadScopeSelector({ value, onChange }: LaunchpadScopeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="launchpad-scope"
        className="text-[11px] font-medium uppercase tracking-wider text-[#707064]"
      >
        Living location
      </label>
      <select
        id="launchpad-scope"
        value={value}
        onChange={(event) => onChange(event.target.value as LaunchpadScope)}
        className="h-9 min-w-[230px] rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 pr-8 text-sm font-medium text-[#1A1A1A] outline-none transition-colors hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20"
      >
        {LAUNCHPAD_SCOPES.map((option) => (
          <option key={option.id} value={option.id}>
            {option.shortLabel} ({option.zipCount} ZIPs)
          </option>
        ))}
      </select>
    </div>
  )
}
