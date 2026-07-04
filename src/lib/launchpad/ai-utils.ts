// Shared utilities for Launchpad AI route handlers.
// Defensive coercion + JSON recovery — both routes' raw inputs (from Supabase
// JSONB columns) and outputs (from Claude) can drift from the declared shape.

import { TIER_META, isOwnershipTier } from "@/lib/census/ownership-truth"
import type { PracticeSnapshot } from "./ai-types"

// The ONLY ownership language AI prompts may inject about a practice: the
// census tier when reviewed, an honest unknown otherwise. Never falls back to
// detector estimates.
export function describeCensusOwnership(p: PracticeSnapshot): string {
  if (p.ownership_tier) {
    const label = isOwnershipTier(p.ownership_tier)
      ? TIER_META[p.ownership_tier].label
      : p.ownership_tier
    return [
      `${label} — census-reviewed${p.ownership_confidence ? `, ${p.ownership_confidence} confidence` : ""}`,
      p.network ? `network: ${p.network}` : null,
      p.pe_backed ? "PE-backed" : null,
    ]
      .filter(Boolean)
      .join("; ")
  }
  if (p.census_review_status === "undetermined")
    return "undetermined — census review could not conclude; treat ownership as unknown"
  if (p.census_review_status === "held")
    return "held — census review in progress; treat ownership as unknown"
  return "not census-reviewed yet — treat ownership as unknown (never assume independent or corporate)"
}

export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const item of value) {
      if (typeof item === "string") {
        const trimmed = item.trim()
        if (trimmed.length > 0) out.push(trimmed)
      } else if (item != null) {
        const s = String(item).trim()
        if (s.length > 0) out.push(s)
      }
    }
    return out
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) return []
    return trimmed
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  return []
}

export function joinFlags(value: unknown, separator = ", "): string {
  return coerceStringArray(value).join(separator)
}

// Tries to recover JSON from a model response that may have:
//   - markdown code fences (```json ... ```)
//   - leading/trailing prose
//   - trailing commas
// Returns the parsed value or null.
export function safeParseJson<T = unknown>(text: string): T | null {
  if (typeof text !== "string" || text.trim().length === 0) return null

  const withoutFences = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  const directParse = tryParse<T>(withoutFences)
  if (directParse !== null) return directParse

  const firstBrace = withoutFences.indexOf("{")
  const lastBrace = withoutFences.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = withoutFences.slice(firstBrace, lastBrace + 1)
    const sliced = tryParse<T>(slice)
    if (sliced !== null) return sliced
    const cleaned = slice.replace(/,(\s*[}\]])/g, "$1")
    const cleanedParse = tryParse<T>(cleaned)
    if (cleanedParse !== null) return cleanedParse
  }

  const firstBracket = withoutFences.indexOf("[")
  const lastBracket = withoutFences.lastIndexOf("]")
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const slice = withoutFences.slice(firstBracket, lastBracket + 1)
    const sliced = tryParse<T>(slice)
    if (sliced !== null) return sliced
  }

  return null
}

function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
