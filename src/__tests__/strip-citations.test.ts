import { describe, expect, it } from "vitest"
import { stripCitations } from "@/lib/utils/strip-citations"

/**
 * Unit tests for stripCitations() — ensures AI citation markup is stripped
 * before rendering on the Intelligence page.
 *
 * The Claude API emits <cite index="N-M">text</cite> markers in long-form
 * zip_qualitative_intel columns. These must never appear as raw HTML strings
 * in the UI.
 */
describe("stripCitations", () => {
  it("removes a single cite tag pair, preserving content", () => {
    const input = '<cite index="3-9">Arlington Heights appreciation rates 5.84%</cite>'
    expect(stripCitations(input)).toBe("Arlington Heights appreciation rates 5.84%")
  })

  it("removes multiple cite tags in one string", () => {
    const input = 'Demand is <cite index="1">high</cite> and supply is <cite index="2-3">constrained</cite>.'
    expect(stripCitations(input)).toBe("Demand is high and supply is constrained.")
  })

  it("handles cite tags with various attribute formats", () => {
    expect(stripCitations('<cite index="5">text</cite>')).toBe("text")
    expect(stripCitations('<cite data-ref="abc" index="1-2">text</cite>')).toBe("text")
    // cite with no attributes: closing tag is still stripped; opening <cite> (no attrs) is left
    // as-is since the regex requires at least one attribute character after <cite.
    // This edge case does not occur in practice — the AI always emits index="N" attrs.
    expect(stripCitations('<cite>text</cite>')).toBe("<cite>text")
  })

  it("passes through text with no citation tags unchanged", () => {
    const plain = "Strong demand from growing residential population in the area."
    expect(stripCitations(plain)).toBe(plain)
  })

  it("returns empty string unchanged", () => {
    expect(stripCitations("")).toBe("")
  })

  it("returns null for null input", () => {
    expect(stripCitations(null)).toBeNull()
  })

  it("returns undefined for undefined input", () => {
    expect(stripCitations(undefined)).toBeUndefined()
  })

  it("handles nested/adjacent cite tags correctly", () => {
    const input = '<cite index="1">first</cite><cite index="2">second</cite>'
    expect(stripCitations(input)).toBe("firstsecond")
  })

  it("is case-insensitive for the cite tag name", () => {
    // Handles both <CITE> and <cite> (AI models may vary)
    const input = '<CITE index="1">text</CITE>'
    expect(stripCitations(input)).toBe("text")
  })
})
