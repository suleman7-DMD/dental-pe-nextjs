/**
 * Locks the user-ratified ownership truth law
 * (DECISION_TRUE_INDEPENDENT_HEADLINE_20260703.md + charter §2).
 * If any assertion here fails, someone changed the census bucketing —
 * that is a truth-rule regression, not a refactor.
 */
import { describe, expect, it } from "vitest"

import {
  ADA_COMPARABLE_BUCKET,
  BUCKET_META,
  HEADLINE_BUCKETS,
  NOT_SOLO_HEADLINE_LABEL,
  OWNERSHIP_TIERS,
  deriveSourceClass,
  getOwnershipRecord,
  summarizeBuckets,
  tierToBucket,
} from "@/lib/census/ownership-truth"

describe("ratified bucket law", () => {
  it("maps every tier to its ratified bucket", () => {
    expect(tierToBucket("true_independent")).toBe("true_solo_owner_operated")
    expect(tierToBucket("single_loc_group")).toBe("dentist_owned_not_solo") // T2 is NOT solo
    expect(tierToBucket("dentist_multi")).toBe("dentist_owned_not_solo") // T3 is NOT a DSO
    expect(tierToBucket("stealth_dso")).toBe("dso_pe_corporate")
    expect(tierToBucket("branded_dso")).toBe("dso_pe_corporate")
    expect(tierToBucket("institutional")).toBe("institutional")
  })

  it("sends unknown/null tiers to unresolved, never to a truth bucket", () => {
    expect(tierToBucket(null)).toBe("unresolved")
    expect(tierToBucket(undefined)).toBe("unresolved")
    expect(tierToBucket("dso_regional")).toBe("unresolved") // legacy detector value
    expect(tierToBucket("undetermined")).toBe("unresolved")
  })

  it("has exactly five buckets and six tiers", () => {
    expect(HEADLINE_BUCKETS).toHaveLength(5)
    expect(OWNERSHIP_TIERS).toHaveLength(6)
  })

  it("keeps the DSO/PE bucket at T4+T5 only — the sole ADA-comparable number", () => {
    expect(BUCKET_META.dso_pe_corporate.tiers).toEqual(["stealth_dso", "branded_dso"])
    expect(ADA_COMPARABLE_BUCKET).toBe("dso_pe_corporate")
  })

  it("labeling law: the broad headline is Not Solo Owner-Operated, never DSO-affiliated", () => {
    expect(NOT_SOLO_HEADLINE_LABEL).toBe("Not Solo Owner-Operated %")
    expect(NOT_SOLO_HEADLINE_LABEL.toLowerCase()).not.toContain("dso")
  })
})

describe("source classes", () => {
  it("only a real tier value earns census_reviewed", () => {
    expect(deriveSourceClass("true_independent")).toBe("census_reviewed")
    expect(deriveSourceClass("branded_dso")).toBe("census_reviewed")
    expect(deriveSourceClass(null)).toBe("unreviewed")
    expect(deriveSourceClass("dso_national")).toBe("unreviewed") // detector value ≠ census truth
    expect(deriveSourceClass(null, "held")).toBe("held")
    expect(deriveSourceClass(null, "undetermined")).toBe("undetermined")
  })

  it("getOwnershipRecord never fabricates evidence for unreviewed rows", () => {
    const record = getOwnershipRecord({
      ownership_tier: null,
      pe_backed: null,
      ownership_evidence_basis: "stale text",
      ownership_evidence_urls: '["https://example.com"]',
      ownership_confidence: "high",
      network_id: null,
    })
    expect(record.isCensusTruth).toBe(false)
    expect(record.confidence).toBeNull()
    expect(record.evidenceBasis).toBeNull()
    expect(record.evidenceUrls).toEqual([])
    expect(record.bucket).toBe("unresolved")
  })
})

describe("summarizeBuckets", () => {
  const rows = [
    { ownership_tier: "true_independent", pe_backed: false },
    { ownership_tier: "true_independent", pe_backed: false },
    { ownership_tier: "single_loc_group", pe_backed: false },
    { ownership_tier: "dentist_multi", pe_backed: false },
    { ownership_tier: "stealth_dso", pe_backed: true },
    { ownership_tier: "branded_dso", pe_backed: true },
    { ownership_tier: "institutional", pe_backed: false },
    { ownership_tier: null, pe_backed: null }, // unreviewed rows never count as reviewed
  ]

  it("counts buckets from tiers and derives unresolved from the universe", () => {
    const summary = summarizeBuckets(rows, 10)
    expect(summary.reviewed).toBe(7)
    expect(summary.counts.true_solo_owner_operated).toBe(2)
    expect(summary.counts.dentist_owned_not_solo).toBe(2)
    expect(summary.counts.dso_pe_corporate).toBe(2)
    expect(summary.counts.institutional).toBe(1)
    expect(summary.counts.unresolved).toBe(3) // 10 − 7, always visible
    expect(summary.peBacked).toBe(2)
  })

  it("bucket shares of the universe sum to 100 (unresolved included)", () => {
    const summary = summarizeBuckets(rows, 10)
    const total = Object.values(summary.pctOfUniverse).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(100, 6)
  })

  it("Not Solo Owner-Operated % = (reviewed − T1) / reviewed", () => {
    const summary = summarizeBuckets(rows, 10)
    expect(summary.notSoloOwnerOperatedPctOfReviewed).toBeCloseTo((5 / 7) * 100, 6)
    expect(summary.dsoPePctOfReviewed).toBeCloseTo((2 / 7) * 100, 6)
  })

  it("handles a zero universe without fake precision", () => {
    const summary = summarizeBuckets([], 0)
    expect(summary.coveragePct).toBe(0)
    expect(summary.notSoloOwnerOperatedPctOfReviewed).toBe(0)
  })
})
