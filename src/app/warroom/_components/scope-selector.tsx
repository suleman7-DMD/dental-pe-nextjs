"use client"

import { useMemo } from "react"
import {
  WARROOM_SCOPES,
  type WarroomScopeGroup,
  type WarroomScopeId,
  type WarroomScopeOption,
} from "@/lib/warroom/scope"

interface ScopeSelectorProps {
  value: WarroomScopeId
  onChange: (scope: WarroomScopeId) => void
}

const GROUP_ORDER: WarroomScopeGroup[] = ["metro", "subzone", "saved"]

function optionDetail(option: WarroomScopeOption): string {
  if (option.zipCount === 1) return "1 ZIP"
  return `${option.zipCount} ZIPs`
}

export function ScopeSelector({ value, onChange }: ScopeSelectorProps) {
  const grouped = useMemo(() => {
    const map = new Map<WarroomScopeGroup, { label: string; options: WarroomScopeOption[] }>()
    for (const option of WARROOM_SCOPES) {
      const existing = map.get(option.group)
      if (existing) {
        existing.options.push(option)
      } else {
        map.set(option.group, { label: option.groupLabel, options: [option] })
      }
    }
    return GROUP_ORDER.filter((group) => map.has(group)).map((group) => ({
      key: group,
      ...map.get(group)!,
    }))
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="warroom-scope"
        className="text-[11px] font-medium uppercase tracking-wider text-[#707064]"
      >
        Scope
      </label>
      <select
        id="warroom-scope"
        value={value}
        onChange={(event) => onChange(event.target.value as WarroomScopeId)}
        className="h-9 min-w-[230px] rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 pr-8 text-sm font-medium text-[#1A1A1A] outline-none transition-colors hover:border-[#D4D0C8] focus:border-[#B8860B] focus:ring-2 focus:ring-[#B8860B]/20"
      >
        {grouped.map((group) => (
          <optgroup key={group.key} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({optionDetail(option)})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
