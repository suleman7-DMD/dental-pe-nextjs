// Shared utilities for Launchpad AI route handlers.
// Defensive coercion + JSON recovery — both routes' raw inputs (from Supabase
// JSONB columns) and outputs (from Claude) can drift from the declared shape.

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
