'use client'

interface StatusDotProps {
  daysSinceUpdate: number | null
}

export function StatusDot({ daysSinceUpdate }: StatusDotProps) {
  if (daysSinceUpdate === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-500" />
        No data
      </span>
    )
  }

  if (daysSinceUpdate <= 7) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        Current
      </span>
    )
  }

  if (daysSinceUpdate <= 30) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
        Stale
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
      <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
      Outdated
    </span>
  )
}
