import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  DSO_LANE_TIERS,
  FUNNEL_PARTITION_KEYS,
  FUNNEL_STAGE_IDS,
  FUNNEL_STAGE_META,
  MIN_HOT_REVIEW_COUNT,
  MIN_HOT_REVIEW_RATING,
  MIN_SIGNAL_PROVIDERS,
  OUTREACH_ELIGIBLE_TIERS,
  PROFILE_TIERS,
  computeFunnel,
  deriveFunnelMembership,
  filterRowsForStage,
  hasHotSignal,
  type FunnelContext,
  type FunnelIntelInput,
  type FunnelRowInput,
} from "@/lib/census/funnel"
import type { JobLaneVerificationInput } from "@/lib/census/job-lane"

// ── Fixtures (job-lane.test.ts conventions) ─────────────────────────────────

const FRESH = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
const STALE = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()

function row(overrides: Partial<FunnelRowInput> = {}): FunnelRowInput {
  return {
    location_id: "L1",
    ownership_tier: "single_loc_group",
    provider_count: 3,
    website: "https://smiles.example.com",
    primary_npi: "1111111111",
    ...overrides,
  }
}

const HOT_INTEL: FunnelIntelInput = {
  hiring_active: 1,
  google_review_count: 12,
  google_rating: 3.9,
}

const COLD_INTEL: FunnelIntelInput = {
  hiring_active: 0,
  google_review_count: 8,
  google_rating: 4.9,
}

function verification(
  overrides: Partial<JobLaneVerificationInput> = {}
): JobLaneVerificationInput {
  return {
    verification_status: "roster_verified",
    website_url: "https://smiles.example.com",
    doctors: [{ name: "Dr. A" }, { name: "Dr. B" }],
    owner_operator_stated: "Dr. A",
    last_checked_at: FRESH,
    ...overrides,
  }
}

function ctx(overrides: Partial<FunnelContext> = {}): FunnelContext {
  return {
    intelByNpi: new Map<string, FunnelIntelInput>(),
    verificationByLocationId: new Map<string, JobLaneVerificationInput>(),
    ...overrides,
  }
}

// ── Metadata invariants ─────────────────────────────────────────────────────

describe("funnel stage metadata", () => {
  it("defines exactly the six ordered stages S0..S5", () => {
    expect(FUNNEL_STAGE_IDS).toEqual([
      "universe",
      "profile",
      "signal_pool",
      "hot_lead",
      "website_checked",
      "outreach_ready",
    ])
  })

  it("labeling law: base-layer labels never claim verification or readiness", () => {
    for (const id of FUNNEL_STAGE_IDS) {
      const meta = FUNNEL_STAGE_META[id]
      if (meta.layer === "base") {
        expect(meta.label.toLowerCase()).not.toMatch(/verified|ready|checked/)
      }
    }
  })

  it("only the two JHV-backed stages sit in the verified layer", () => {
    const verified = FUNNEL_STAGE_IDS.filter(
      (id) => FUNNEL_STAGE_META[id].layer === "verified"
    )
    expect(verified).toEqual(["website_checked", "outreach_ready"])
  })

  it("profile tiers exclude T1, DSO tiers, and institutional", () => {
    expect(PROFILE_TIERS).toEqual(["single_loc_group", "dentist_multi"])
    expect(OUTREACH_ELIGIBLE_TIERS).toContain("true_independent")
    expect(DSO_LANE_TIERS).toEqual(["stealth_dso", "branded_dso"])
  })
})

// ── S1 profile ──────────────────────────────────────────────────────────────

describe("profile stage (S1)", () => {
  it("T2 and T3 are in; T1, T4, T5, T6 are out", () => {
    const c = ctx()
    expect(deriveFunnelMembership(row({ ownership_tier: "single_loc_group" }), c).profile).toBe(true)
    expect(deriveFunnelMembership(row({ ownership_tier: "dentist_multi" }), c).profile).toBe(true)
    expect(deriveFunnelMembership(row({ ownership_tier: "true_independent" }), c).profile).toBe(false)
    expect(deriveFunnelMembership(row({ ownership_tier: "stealth_dso" }), c).profile).toBe(false)
    expect(deriveFunnelMembership(row({ ownership_tier: "branded_dso" }), c).profile).toBe(false)
    expect(deriveFunnelMembership(row({ ownership_tier: "institutional" }), c).profile).toBe(false)
  })

  it("untiered rows join only with a banked research dossier", () => {
    const withDossier = ctx({
      intelByNpi: new Map([["1111111111", COLD_INTEL]]),
    })
    expect(
      deriveFunnelMembership(row({ ownership_tier: null }), withDossier).profile
    ).toBe(true)
    expect(deriveFunnelMembership(row({ ownership_tier: null }), ctx()).profile).toBe(false)
    // no primary_npi → no dossier join possible
    expect(
      deriveFunnelMembership(row({ ownership_tier: null, primary_npi: null }), withDossier)
        .profile
    ).toBe(false)
  })
})

// ── S2 signal pool ──────────────────────────────────────────────────────────

describe("signal pool stage (S2)", () => {
  it("requires profile AND 2+ providers AND a website", () => {
    const c = ctx()
    expect(deriveFunnelMembership(row(), c).signalPool).toBe(true)
    expect(deriveFunnelMembership(row({ provider_count: 1 }), c).signalPool).toBe(false)
    expect(deriveFunnelMembership(row({ provider_count: null }), c).signalPool).toBe(false)
    expect(deriveFunnelMembership(row({ website: "" }), c).signalPool).toBe(false)
    expect(deriveFunnelMembership(row({ website: "   " }), c).signalPool).toBe(false)
    expect(
      deriveFunnelMembership(row({ ownership_tier: "true_independent" }), c).signalPool
    ).toBe(false)
  })

  it(`threshold is exactly ${MIN_SIGNAL_PROVIDERS} providers`, () => {
    const c = ctx()
    expect(
      deriveFunnelMembership(row({ provider_count: MIN_SIGNAL_PROVIDERS }), c).signalPool
    ).toBe(true)
    expect(
      deriveFunnelMembership(row({ provider_count: MIN_SIGNAL_PROVIDERS - 1 }), c).signalPool
    ).toBe(false)
  })
})

// ── S3 hot lead ─────────────────────────────────────────────────────────────

describe("hot lead stage (S3)", () => {
  it("hiring flag qualifies (boolean or 1)", () => {
    expect(hasHotSignal({ hiring_active: 1 })).toBe(true)
    expect(hasHotSignal({ hiring_active: true })).toBe(true)
    expect(hasHotSignal({ hiring_active: 0 })).toBe(false)
    expect(hasHotSignal(null)).toBe(false)
  })

  it("review signal needs BOTH the count floor and the rating floor", () => {
    expect(
      hasHotSignal({
        google_review_count: MIN_HOT_REVIEW_COUNT,
        google_rating: MIN_HOT_REVIEW_RATING,
      })
    ).toBe(true)
    expect(
      hasHotSignal({
        google_review_count: MIN_HOT_REVIEW_COUNT - 1,
        google_rating: 4.9,
      })
    ).toBe(false)
    expect(
      hasHotSignal({
        google_review_count: MIN_HOT_REVIEW_COUNT,
        google_rating: MIN_HOT_REVIEW_RATING - 0.1,
      })
    ).toBe(false)
  })

  it("hot lead nests inside the signal pool; hotSignal counter does not", () => {
    const c = ctx({ intelByNpi: new Map([["1111111111", HOT_INTEL]]) })
    const inPool = deriveFunnelMembership(row(), c)
    expect(inPool.hotLead).toBe(true)
    expect(inPool.hotSignal).toBe(true)
    // hot but no website → outside S2, so not a hot LEAD, but the transparency
    // counter still sees it (nesting hides nothing).
    const noSite = deriveFunnelMembership(row({ website: null }), c)
    expect(noSite.hotLead).toBe(false)
    expect(noSite.hotSignal).toBe(true)
  })
})

// ── S4 website-checked (verification overlay) ───────────────────────────────

describe("website-checked stage (S4)", () => {
  it("any recognized JHV status counts — including stale and conflict", () => {
    for (const status of [
      "roster_verified",
      "hiring_page_found",
      "call_required",
      "no_usable_website",
      "ownership_conflict",
      "stale_recheck",
    ]) {
      const c = ctx({
        verificationByLocationId: new Map([
          ["L1", verification({ verification_status: status })],
        ]),
      })
      expect(deriveFunnelMembership(row(), c).websiteChecked).toBe(true)
    }
  })

  it("unrecognized statuses are treated as absent", () => {
    const c = ctx({
      verificationByLocationId: new Map([
        ["L1", verification({ verification_status: "bogus_status" })],
      ]),
    })
    expect(deriveFunnelMembership(row(), c).websiteChecked).toBe(false)
  })

  it("is defined by JHV state, not by S3 membership (overlay, not nested)", () => {
    // T1 solo with a verification record: outside profile, still checked.
    const c = ctx({
      verificationByLocationId: new Map([["L1", verification()]]),
    })
    const m = deriveFunnelMembership(row({ ownership_tier: "true_independent" }), c)
    expect(m.profile).toBe(false)
    expect(m.websiteChecked).toBe(true)
  })
})

// ── S5 outreach-ready ───────────────────────────────────────────────────────

describe("outreach-ready stage (S5)", () => {
  it("fresh roster_verified + reviewed dentist-owned tier is ready", () => {
    const c = ctx({ verificationByLocationId: new Map([["L1", verification()]]) })
    for (const tier of OUTREACH_ELIGIBLE_TIERS) {
      expect(
        deriveFunnelMembership(row({ ownership_tier: tier }), c).outreachReady
      ).toBe(true)
    }
  })

  it("census-first rule: no reviewed tier can NEVER be outreach-ready (43-vs-47)", () => {
    const c = ctx({
      intelByNpi: new Map([["1111111111", HOT_INTEL]]),
      verificationByLocationId: new Map([
        ["L1", verification({ verification_status: "hiring_page_found" })],
      ]),
    })
    const m = deriveFunnelMembership(row({ ownership_tier: null }), c)
    expect(m.websiteChecked).toBe(true)
    expect(m.outreachReady).toBe(false)
  })

  it("stale checks, conflicts, and call_required are not outreach-grade", () => {
    for (const v of [
      verification({ last_checked_at: STALE }),
      verification({ verification_status: "stale_recheck" }),
      verification({ verification_status: "ownership_conflict" }),
      verification({ verification_status: "call_required" }),
      verification({ verification_status: "no_usable_website" }),
    ]) {
      const c = ctx({ verificationByLocationId: new Map([["L1", v]]) })
      expect(deriveFunnelMembership(row(), c).outreachReady).toBe(false)
    }
  })

  it("T4/T5 join outreach only via the explicit DSO toggle", () => {
    const verifications = new Map([["L1", verification()]])
    const off = deriveFunnelMembership(
      row({ ownership_tier: "branded_dso" }),
      ctx({ verificationByLocationId: verifications })
    )
    expect(off.outreachReady).toBe(false)
    const on = deriveFunnelMembership(
      row({ ownership_tier: "branded_dso" }),
      ctx({ verificationByLocationId: verifications, includeDsoTiersInOutreach: true })
    )
    expect(on.outreachReady).toBe(true)
    expect(on.dsoLane).toBe(true)
  })
})

// ── computeFunnel structural invariants ─────────────────────────────────────

describe("computeFunnel", () => {
  const rows: FunnelRowInput[] = [
    row({ location_id: "L1" }), // T2, pool, hot (intel below), verified fresh → outreach
    row({ location_id: "L2", ownership_tier: "dentist_multi", primary_npi: "2" }), // T3, pool
    row({ location_id: "L3", website: null, primary_npi: "3" }), // T2, no site
    row({ location_id: "L4", ownership_tier: "true_independent", primary_npi: "4" }), // T1
    row({ location_id: "L5", ownership_tier: "branded_dso", primary_npi: "5" }), // DSO lane
    row({ location_id: "L6", ownership_tier: "institutional", primary_npi: "6" }), // T6
    row({ location_id: "L7", ownership_tier: null, primary_npi: "7" }), // untiered + dossier
    row({ location_id: "L8", ownership_tier: null, primary_npi: null }), // untiered, nothing
  ]
  const funnelCtx = ctx({
    intelByNpi: new Map([
      ["1111111111", HOT_INTEL],
      ["7", COLD_INTEL],
    ]),
    verificationByLocationId: new Map([
      ["L1", verification()],
      ["L4", verification({ verification_status: "call_required" })],
    ]),
  })
  const snapshot = computeFunnel(rows, funnelCtx)

  it("derives counts from the rows — universe is the input length", () => {
    expect(snapshot.total).toBe(rows.length)
    expect(snapshot.stages[0]).toMatchObject({ id: "universe", count: rows.length })
  })

  it("base stages nest monotonically (S0 ≥ S1 ≥ S2 ≥ S3) and S4 ≥ S5", () => {
    const byId = Object.fromEntries(snapshot.stages.map((s) => [s.id, s.count]))
    expect(byId.universe).toBeGreaterThanOrEqual(byId.profile)
    expect(byId.profile).toBeGreaterThanOrEqual(byId.signal_pool)
    expect(byId.signal_pool).toBeGreaterThanOrEqual(byId.hot_lead)
    expect(byId.website_checked).toBeGreaterThanOrEqual(byId.outreach_ready)
  })

  it("the exclusive partition sums to the universe", () => {
    const sum = FUNNEL_PARTITION_KEYS.reduce(
      (acc, key) => acc + snapshot.partition[key],
      0
    )
    expect(sum).toBe(rows.length)
  })

  it("assigns the expected fixture counts", () => {
    const byId = Object.fromEntries(snapshot.stages.map((s) => [s.id, s.count]))
    expect(byId.profile).toBe(4) // L1, L2, L3, L7
    expect(byId.signal_pool).toBe(3) // L1, L2, L7 (L3 has no website)
    expect(byId.hot_lead).toBe(1) // L1
    expect(byId.website_checked).toBe(2) // L1, L4
    expect(byId.outreach_ready).toBe(1) // L1
    expect(snapshot.dsoLane).toBe(1) // L5
    expect(snapshot.hotSignalTotal).toBe(1) // L1 (hot intel keyed to its npi)
    expect(snapshot.partition.universe_rest).toBe(2) // L6 (institutional), L8 (nothing known)
    expect(snapshot.partition.website_checked).toBe(1) // L4 — checked but call_required
  })

  it("filterRowsForStage returns exactly the stage members", () => {
    expect(filterRowsForStage(rows, "universe", funnelCtx)).toHaveLength(rows.length)
    expect(
      filterRowsForStage(rows, "outreach_ready", funnelCtx).map((r) => r.location_id)
    ).toEqual(["L1"])
    expect(
      filterRowsForStage(rows, "signal_pool", funnelCtx).map((r) => r.location_id)
    ).toEqual(["L1", "L2", "L7"])
  })
})

// ── Truth-charter guards (F27-style) ────────────────────────────────────────

describe("truth-charter guards", () => {
  const SRC_ROOT = path.resolve(__dirname, "..")
  const FUNNEL_PATH = path.join(SRC_ROOT, "lib/census/funnel.ts")

  it("funnel.ts contains no hardcoded census tallies (no numeric literal > 90)", () => {
    const source = fs
      .readFileSync(FUNNEL_PATH, "utf8")
      // strip block + line comments so prose (dates, snapshot integers) is exempt
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
    const literals = [...source.matchAll(/\b\d+(?:\.\d+)?\b/g)]
      .map((m) => Number(m[0]))
      .filter((n) => n > 90)
    expect(literals).toEqual([])
  })

  // Files that may legitimately compare intel/provider thresholds outside the
  // funnel module. Empty today — add entries ONLY with a justification.
  const ALLOWLIST: Record<string, string> = {}

  it("no file outside funnel.ts derives funnel-stage predicates", () => {
    const banned = [
      /(google_review_count|google_rating)\s*(>=|>)/,
      /provider_count\s*(>=|>)\s*\d/,
    ]
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
        if (entry.name === "__tests__") continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue
        const rel = path.relative(SRC_ROOT, full)
        if (rel === "lib/census/funnel.ts" || rel in ALLOWLIST) continue
        const text = fs.readFileSync(full, "utf8")
        if (banned.some((re) => re.test(text))) offenders.push(rel)
      }
    }
    walk(SRC_ROOT)
    expect(offenders).toEqual([])
  })
})
