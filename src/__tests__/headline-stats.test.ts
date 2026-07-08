/**
 * headline-stats.test.ts — locks the anti-babel invariants.
 *
 * The headline module exists so every KPI card on Home / Directory /
 * Ownership / Acquisition Scout shows the same number with the same label
 * for the same stat. These tests fail if a formula drifts from the
 * ownership-truth contract, if two different formulas end up sharing a
 * label, or if a tooltip smuggles in a hardcoded cross-page count again
 * (the old "~34 practices" bug).
 */

import { describe, expect, it } from "vitest"
import {
  acquisitionLeadsBroadStat,
  acquisitionLeadsStrictStat,
  censusHeadlineStats,
  dsoPeShareStat,
  gpLocationsStat,
  handReviewedStat,
  multiLocationReviewedStat,
  notSoloShareStat,
  type HeadlineStat,
} from "@/lib/census/headline-stats"
import { summarizeBuckets } from "@/lib/census/ownership-truth"

// Synthetic scope: 1,000-clinic universe, 100 reviewed rows.
// 40 solo (T1), 25 single-location groups (T2), 15 dentist multi (T3),
// 12 stealth DSO (T4, 5 PE-backed), 6 branded DSO (T5, all PE-backed),
// 2 institutional (T6).
const rows = [
  ...Array.from({ length: 40 }, () => ({ ownership_tier: "true_independent", pe_backed: null })),
  ...Array.from({ length: 25 }, () => ({ ownership_tier: "single_loc_group", pe_backed: null })),
  ...Array.from({ length: 15 }, () => ({ ownership_tier: "dentist_multi", pe_backed: false })),
  ...Array.from({ length: 7 }, () => ({ ownership_tier: "stealth_dso", pe_backed: false })),
  ...Array.from({ length: 5 }, () => ({ ownership_tier: "stealth_dso", pe_backed: true })),
  ...Array.from({ length: 6 }, () => ({ ownership_tier: "branded_dso", pe_backed: true })),
  ...Array.from({ length: 2 }, () => ({ ownership_tier: "institutional", pe_backed: null })),
]
const summary = summarizeBuckets(rows, 1000)

function allStats(): HeadlineStat[] {
  return [
    ...censusHeadlineStats(summary),
    multiLocationReviewedStat(33),
    acquisitionLeadsStrictStat(34),
    acquisitionLeadsBroadStat(412),
  ]
}

describe("headline-stats values derive from the ownership-truth contract", () => {
  it("GP locations card shows the live universe", () => {
    expect(gpLocationsStat(summary).value).toBe("1,000")
  })

  it("hand-reviewed card shows count with coverage sublabel", () => {
    const stat = handReviewedStat(summary)
    expect(stat.value).toBe("100")
    expect(stat.sublabel).toBe("10.0% of 1,000 GP locations")
  })

  it("not-solo share uses the reviewed denominator", () => {
    // 60 of 100 reviewed rows are not T1 solo owner-operated.
    expect(notSoloShareStat(summary).value).toBe("60.0%")
  })

  it("DSO/PE headline is share-of-reviewed with the universe floor as context", () => {
    const stat = dsoPeShareStat(summary)
    // 18 DSO/PE of 100 reviewed; 18 of 1,000 universe.
    expect(stat.value).toBe("18.0%")
    expect(stat.sublabel).toContain("1.8% floor")
    // Counts in the tooltip come from the summary, never hand-entered.
    expect(stat.tooltip).toContain("18 locations")
    expect(stat.tooltip).toContain("11 with confirmed PE backing")
  })

  it("gp locations card falls back to raw rows only when the universe is missing", () => {
    const empty = summarizeBuckets([], 0)
    expect(gpLocationsStat(empty, { gpRowCount: 4321 }).value).toBe("4,321")
    expect(gpLocationsStat(summary, { gpRowCount: 1040 }).sublabel).toContain("1,040")
  })
})

describe("anti-babel invariants", () => {
  it("no two stats share a label or a key", () => {
    const stats = allStats()
    expect(new Set(stats.map((s) => s.key)).size).toBe(stats.length)
    expect(new Set(stats.map((s) => s.label)).size).toBe(stats.length)
  })

  it("strict and broad acquisition leads are distinct, cross-referenced by definition", () => {
    const strict = acquisitionLeadsStrictStat(34)
    const broad = acquisitionLeadsBroadStat(412)
    expect(strict.label).not.toBe(broad.label)
    expect(strict.value).toBe("34")
    expect(broad.value).toBe("412")
  })

  it("no tooltip hardcodes an approximate cross-page count (the '~34' bug)", () => {
    for (const stat of allStats()) {
      expect(stat.tooltip).not.toMatch(/~\s*\d/)
      expect(stat.sublabel).not.toMatch(/~\s*\d/)
    }
  })

  it("every stat explains itself: non-empty label, sublabel, and tooltip", () => {
    for (const stat of allStats()) {
      expect(stat.label.length).toBeGreaterThan(0)
      expect(stat.sublabel.length).toBeGreaterThan(0)
      expect(stat.tooltip.length).toBeGreaterThan(20)
    }
  })

  it("user-facing headline text never says 'legacy heuristic'", () => {
    for (const stat of allStats()) {
      const text = `${stat.label} ${stat.sublabel} ${stat.tooltip}`.toLowerCase()
      expect(text).not.toContain("legacy heuristic")
    }
  })
})
