import { describe, expect, it } from "vitest"
import {
  buildIntentFromFilter,
  createEmptyFilter,
  describeFilter,
  filterHasContent,
  parseIntent,
} from "./intent"

describe("parseIntent", () => {
  it("returns empty filter for blank input", () => {
    const result = parseIntent("")
    expect(filterHasContent(result.filter)).toBe(false)
    expect(result.chips).toHaveLength(0)
  })

  it("recognizes 'family dynasty' as family_dynasty_flag", () => {
    const result = parseIntent("show me practices with family dynasty")
    expect(result.filter.requireFlags).toContain("family_dynasty_flag")
  })

  it("recognizes 'near retirement' as retirement_combo_flag", () => {
    const result = parseIntent("targets near retirement")
    expect(result.filter.requireFlags).toContain("retirement_combo_flag")
  })

  it("recognizes 'stealth dso' as stealth_dso_flag", () => {
    const result = parseIntent("stealth DSO targets")
    expect(result.filter.requireFlags).toContain("stealth_dso_flag")
  })

  it("recognizes scope tokens", () => {
    const result = parseIntent("woodridge practices")
    expect(result.filter.scope).toBe("woodridge")
  })

  it("leaves minTier null for free-text (tier floors are chip-only)", () => {
    // parseIntent doesn't extract tier floors from natural language — UI chips set minTier.
    // This test locks in that contract so we don't accidentally add regex-based tier parsing
    // that conflicts with the chip picker.
    const hot = parseIntent("hot tier only")
    expect(hot.filter.minTier).toBeNull()
    const warm = parseIntent("at least warm")
    expect(warm.filter.minTier).toBeNull()
  })

  it("extracts ZIP codes from text", () => {
    const result = parseIntent("show ZIP 60491 and 60517")
    expect(result.filter.zipCodes).toContain("60491")
    expect(result.filter.zipCodes).toContain("60517")
  })

  it("sets acquisitionTargetsOnly for 'acquisition targets'", () => {
    const result = parseIntent("acquisition targets")
    expect(result.filter.acquisitionTargetsOnly).toBe(true)
  })

  it("sets retirementRiskOnly for 'retirement risk'", () => {
    const result = parseIntent("retirement risk practices")
    expect(result.filter.retirementRiskOnly).toBe(true)
  })

  it("parses numeric buyability thresholds", () => {
    const result = parseIntent("buyability over 70")
    expect(result.filter.minBuyability).toBe(70)
  })

  it("normalizes whitespace and case", () => {
    const a = parseIntent("  Family  Dynasty  ")
    const b = parseIntent("family dynasty")
    expect(a.filter.requireFlags).toEqual(b.filter.requireFlags)
  })

  it("preserves rawText on the result", () => {
    const result = parseIntent("hot targets near retirement")
    expect(result.rawText).toBe("hot targets near retirement")
  })
})

describe("buildIntentFromFilter", () => {
  it("builds chips from a filter with requireFlags", () => {
    const filter = createEmptyFilter()
    filter.requireFlags = ["stealth_dso_flag"]
    const intent = buildIntentFromFilter(filter)
    expect(intent.chips.length).toBeGreaterThan(0)
    expect(intent.chips.some((chip) => chip.key === "requireFlags")).toBe(true)
  })

  it("produces stable rawText for the same filter", () => {
    const filter = createEmptyFilter()
    filter.scope = "woodridge"
    filter.requireFlags = ["retirement_combo_flag"]
    const a = buildIntentFromFilter(filter)
    const b = buildIntentFromFilter(filter)
    expect(a.rawText).toBe(b.rawText)
  })

  it("returns empty chips for an empty filter", () => {
    const intent = buildIntentFromFilter(createEmptyFilter())
    expect(intent.chips).toHaveLength(0)
  })

  it("describeFilter produces readable text when filter has content", () => {
    const filter = createEmptyFilter()
    filter.scope = "woodridge"
    const described = describeFilter(filter)
    expect(described.length).toBeGreaterThan(0)
  })
})

describe("filterHasContent", () => {
  it("returns false for empty filter", () => {
    expect(filterHasContent(createEmptyFilter())).toBe(false)
  })

  it("returns true when any meaningful field is set", () => {
    const filter = createEmptyFilter()
    filter.requireFlags = ["stealth_dso_flag"]
    expect(filterHasContent(filter)).toBe(true)
  })

  it("returns true for scope-only filter", () => {
    const filter = createEmptyFilter()
    filter.scope = "bolingbrook"
    expect(filterHasContent(filter)).toBe(true)
  })
})
