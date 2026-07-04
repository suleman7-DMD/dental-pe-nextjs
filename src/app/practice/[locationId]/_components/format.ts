// Plain formatting helpers shared by the server page and the client tabs.
// No "use client" directive — server components import from here too.

import type { PracticeLocationRecord } from "@/lib/supabase/queries/practice-locations"

export function displayName(row: PracticeLocationRecord): string {
  return row.doing_business_as ?? row.practice_name ?? "Unnamed practice"
}

export function formatTitle(value: string | null | undefined): string {
  if (!value) return "Not available"
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatCurrency(value: number | null): string {
  if (value == null) return "Not available"
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${Math.round(value / 1000).toLocaleString()}K`
  return `$${value.toLocaleString()}`
}

export function parseStringList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  } catch {
    // Fall through to comma/newline parsing.
  }
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return null
}

export function websiteHref(value: string | null): string | null {
  if (!value) return null
  return normalizeUrl(value) ?? `https://${value}`
}

/** Narrow the raw census_review_status column to the contract's union. */
export function narrowReviewStatus(
  value: string | null
): "held" | "undetermined" | null {
  return value === "held" || value === "undetermined" ? value : null
}
