"use client"

import { WARROOM_SCOPES, type WarroomScopeId } from "@/lib/warroom/scope"

interface ScopeSelectorProps {
  value: WarroomScopeId
  onChange: (scope: WarroomScopeId) => void
}

export function ScopeSelector({ value, onChange }: ScopeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="warroom-scope"
        className="text-[11px] font-medium uppercase tracking-wider text-[#9C9C90]"
      >
        Scope
      </label>
      <select
        id="warroom-scope"
        value={value}
        onChange={(event) => onChange(event.target.value as WarroomScopeId)}
        className="h-9 min-w-[210px] rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 pr-8 text-sm font-medium text-[#1A1A1A] outline-none transition-colors hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20"
      >
        {WARROOM_SCOPES.map((scope) => (
          <option key={scope.id} value={scope.id}>
            {scope.label} ({scope.zipCount} ZIPs)
          </option>
        ))}
      </select>
    </div>
  )
}
