'use client'

import { LIVING_LOCATIONS } from '@/lib/constants/living-locations'

interface LivingLocationSelectorProps {
  value: string
  onChange: (location: string) => void
}

const locationKeys = Object.keys(LIVING_LOCATIONS)

export function LivingLocationSelector({ value, onChange }: LivingLocationSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="living-location"
        className="text-sm font-medium text-[#6B6B60] whitespace-nowrap"
      >
        Planned Living Area
      </label>
      <select
        id="living-location"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-[#1A1A1A]
          px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-[#B8860B] focus:border-[#B8860B]
          hover:border-[#D4D0C8] transition-colors
          appearance-none cursor-pointer
          min-w-[220px]
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='%236B6B60'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '32px',
        }}
      >
        {locationKeys.map((key) => {
          const loc = LIVING_LOCATIONS[key]
          const zipCount = loc.commutable_zips.length
          return (
            <option key={key} value={key}>
              {key} ({zipCount} ZIPs)
            </option>
          )
        })}
      </select>
    </div>
  )
}
