/**
 * funnel.ts — the canonical D4 job-hunt funnel spine.
 *
 * This module is the ONLY place in the frontend allowed to define the funnel
 * stages or their predicates. Every page that shows a funnel count derives it
 * by calling `computeFunnel` / `deriveFunnelMembership` on live rows — no page
 * re-implements a stage, and no stage count is ever a constant. That is what
 * makes it structurally impossible for the same number to appear on two pages
 * with two values.
 *
 * Stage semantics (PLAN_PRODUCT_RESET_D4_JOBHUNT_20260709.md §5/§7, ratified):
 *
 *   S0 universe        — every GP row in the caller's scope. Scope (metro /
 *                        living-location / GP filter) belongs to the fetch
 *                        layer, exactly as with `summarizeBuckets`.
 *   S1 profile         — the D4 associate profile pool: dentist-owned but not
 *                        solo (T2 single_loc_group / T3 dentist_multi), plus
 *                        unresolved offices that already have a banked research
 *                        dossier. T1 is excluded here on purpose: a confirmed
 *                        solo owner-operator has no associate structure today —
 *                        if one is hiring, the verification overlay (S4/S5)
 *                        catches it.
 *   S2 signal_pool     — S1 with 2+ providers at the address AND a website on
 *                        file: offices you can research without a phone call.
 *   S3 hot_lead        — S2 with a hiring flag or strong public reviews in the
 *                        banked research dossier. These signals are AI-collected
 *                        and NOT website-verified — the stage label must never
 *                        claim verification (see labeling rule below).
 *   S4 website_checked — the verification overlay: a job_hunt_verification
 *                        record with a recognized status exists. This layer is
 *                        defined by JHV state, NOT by S3 membership — a checked
 *                        office outside the hot pool still counts (hiding it
 *                        would under-report verification work). Monotone
 *                        nesting is therefore guaranteed for S0≥S1≥S2≥S3 and
 *                        S4≥S5 only.
 *   S5 outreach_ready  — fresh (non-stale) roster_verified / hiring_page_found
 *                        AND a reviewed dentist-owned tier (T1–T3). Census-first
 *                        rule (the ratified 43-vs-47 decision): an office with
 *                        no reviewed ownership tier can NEVER be outreach-ready,
 *                        however good its website check. T4/T5 join only via the
 *                        explicit DSO toggle.
 *
 *   Parallel DSO lane  — T4+T5 rows, counted beside the funnel, never inside S1.
 *
 * Provenance note: the plan's §7 illustration (4,439 → ~1,773 → 694 → 149 →
 * 48 → 31) was measured by the funnel-quantification fleet agent whose exact
 * predicates were never persisted; those integers are a dated snapshot, not
 * contract values. This module encodes the ratified stage SEMANTICS; live
 * counts are the truth, and CI audits structure (nesting, partition sums,
 * S0 = GP total, S4 = JHV GP count) rather than the snapshot integers.
 *
 * Binding rules inherited from the truth charter:
 *  - No hardcoded census tallies — the only numeric literals here are rule
 *    thresholds (provider/review floors), never counts.
 *  - `ownership_tier` interpretation goes through ownership-truth.ts.
 *  - Verification recognition + staleness go through job-lane.ts.
 *  - Base-layer stage labels never claim verification or readiness.
 */

import { isOwnershipTier, type OwnershipTier } from "./ownership-truth"
import {
  VERIFICATION_STATUSES,
  isVerificationStale,
  type JobLaneVerificationInput,
} from "./job-lane"

// ---------------------------------------------------------------------------
// Stage ids + rule thresholds (the single definition — source-walk enforced)
// ---------------------------------------------------------------------------

export const FUNNEL_STAGE_IDS = [
  "universe",
  "profile",
  "signal_pool",
  "hot_lead",
  "website_checked",
  "outreach_ready",
] as const

export type FunnelStageId = (typeof FUNNEL_STAGE_IDS)[number]

/** S2: minimum providers at the address for the signal pool. */
export const MIN_SIGNAL_PROVIDERS = 2
/** S3: review-based hot signal needs at least this many Google reviews… */
export const MIN_HOT_REVIEW_COUNT = 50
/** …at at least this rating. */
export const MIN_HOT_REVIEW_RATING = 4.0

/** S1 tier gate: dentist-owned, not solo (T2/T3). */
export const PROFILE_TIERS: readonly OwnershipTier[] = [
  "single_loc_group",
  "dentist_multi",
]

/** S5 tier gate: reviewed dentist-owned tiers (census-first rule). */
export const OUTREACH_ELIGIBLE_TIERS: readonly OwnershipTier[] = [
  "true_independent",
  "single_loc_group",
  "dentist_multi",
]

/** Parallel lane: DSO/PE-controlled tiers, shown beside the funnel. */
export const DSO_LANE_TIERS: readonly OwnershipTier[] = [
  "stealth_dso",
  "branded_dso",
]

/** S5 verification gate: only these JHV outcomes are outreach-grade. */
export const OUTREACH_VERIFICATION_STATUSES: readonly string[] = [
  "roster_verified",
  "hiring_page_found",
]

// ---------------------------------------------------------------------------
// Stage display meta — base labels must never claim verification/readiness
// ---------------------------------------------------------------------------

export interface FunnelStageMeta {
  label: string
  /** base = census/registry facts only; verified = JHV-backed overlay. */
  layer: "base" | "verified"
  description: string
}

export const FUNNEL_STAGE_META: Record<FunnelStageId, FunnelStageMeta> = {
  universe: {
    label: "GP offices in scope",
    layer: "base",
    description:
      "Every GP clinic location in the current scope. The count always comes from the live fetch — never a constant.",
  },
  profile: {
    label: "D4 profile pool",
    layer: "base",
    description:
      "Dentist-owned group practices (T2/T3) plus unresolved offices that already have a banked research dossier. Solo owner-operators (T1) sit outside this pool until hiring evidence surfaces.",
  },
  signal_pool: {
    label: "Multi-provider with website",
    layer: "base",
    description:
      "Profile-pool offices with 2+ providers at the address and a website on file — researchable without a phone call.",
  },
  hot_lead: {
    label: "Hiring or strong-review signals",
    layer: "base",
    description:
      "Signal-pool offices whose banked research dossier flags active hiring or strong public reviews. AI-collected signals — not website-checked yet.",
  },
  website_checked: {
    label: "Website-checked",
    layer: "verified",
    description:
      "A job_hunt_verification record exists: the practice's own website was checked for doctors, hiring pages, and ownership statements, with evidence URLs on file.",
  },
  outreach_ready: {
    label: "Outreach-ready",
    layer: "verified",
    description:
      "Fresh website check found a verified roster or a hiring page, AND the census answered ownership as dentist-owned (T1–T3). No reviewed ownership answer means no outreach — however good the website check.",
  },
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface FunnelRowInput {
  location_id: string
  ownership_tier: string | null
  census_review_status?: string | null
  provider_count?: number | null
  website?: string | null
  primary_npi?: string | null
}

/** Subset of a practice_intel row the hot-signal rule needs. Presence of a
 *  dossier at all is what "banked research" means for the profile gate. */
export interface FunnelIntelInput {
  hiring_active?: boolean | number | null
  google_review_count?: number | null
  google_rating?: number | null
}

export interface FunnelContext {
  /** practice_intel dossiers keyed by NPI (row.primary_npi joins here). */
  intelByNpi?: ReadonlyMap<string, FunnelIntelInput>
  /** job_hunt_verification rows keyed by location_id. */
  verificationByLocationId?: ReadonlyMap<string, JobLaneVerificationInput>
  /** §5 DSO toggle: when true, fresh-verified T4/T5 offices may be outreach-ready. */
  includeDsoTiersInOutreach?: boolean
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function hasHotSignal(intel: FunnelIntelInput | null | undefined): boolean {
  if (!intel) return false
  const hiring = intel.hiring_active === true || intel.hiring_active === 1
  const strongReviews =
    (intel.google_review_count ?? 0) >= MIN_HOT_REVIEW_COUNT &&
    (intel.google_rating ?? 0) >= MIN_HOT_REVIEW_RATING
  return hiring || strongReviews
}

export interface FunnelMembership {
  profile: boolean
  signalPool: boolean
  hotLead: boolean
  /** Transparency counter: profile ∧ hot signal even when the row lacks the
   *  S2 gates (no website / <2 providers). Never hidden by the nesting rule. */
  hotSignal: boolean
  websiteChecked: boolean
  outreachReady: boolean
  dsoLane: boolean
}

/** Per-row stage membership — the primitive behind clickable funnel stages. */
export function deriveFunnelMembership(
  row: FunnelRowInput,
  ctx: FunnelContext = {}
): FunnelMembership {
  const tier = isOwnershipTier(row.ownership_tier) ? row.ownership_tier : null
  const intel = row.primary_npi ? ctx.intelByNpi?.get(row.primary_npi) : undefined
  const hasBankedResearch = intel != null

  const profile = tier != null ? PROFILE_TIERS.includes(tier) : hasBankedResearch
  const hasWebsite = (row.website ?? "").trim() !== ""
  const signalPool =
    profile && (row.provider_count ?? 0) >= MIN_SIGNAL_PROVIDERS && hasWebsite
  const hot = hasHotSignal(intel)
  const hotSignal = profile && hot
  const hotLead = signalPool && hot

  const rawVerification = ctx.verificationByLocationId?.get(row.location_id)
  const verification =
    rawVerification && VERIFICATION_STATUSES.has(rawVerification.verification_status ?? "")
      ? rawVerification
      : null
  const websiteChecked = verification != null

  const outreachTierOk =
    tier != null &&
    (OUTREACH_ELIGIBLE_TIERS.includes(tier) ||
      (ctx.includeDsoTiersInOutreach === true && DSO_LANE_TIERS.includes(tier)))
  const outreachReady =
    verification != null &&
    OUTREACH_VERIFICATION_STATUSES.includes(verification.verification_status ?? "") &&
    !isVerificationStale(verification) &&
    outreachTierOk

  const dsoLane = tier != null && DSO_LANE_TIERS.includes(tier)

  return { profile, signalPool, hotLead, hotSignal, websiteChecked, outreachReady, dsoLane }
}

// ---------------------------------------------------------------------------
// Aggregation — the snapshot every funnel surface renders from
// ---------------------------------------------------------------------------

/** Exclusive deepest-stage assignment — the partition CI audits (sums to total). */
export const FUNNEL_PARTITION_KEYS = [
  "outreach_ready",
  "website_checked",
  "hot_lead",
  "signal_pool",
  "profile",
  "dso_pe_lane",
  "universe_rest",
] as const

export type FunnelPartitionKey = (typeof FUNNEL_PARTITION_KEYS)[number]

export interface FunnelStageCount {
  id: FunnelStageId
  label: string
  layer: "base" | "verified"
  count: number
}

export interface FunnelSnapshot {
  total: number
  /** S0..S5 in order, counts derived from the rows passed in. */
  stages: FunnelStageCount[]
  /** Parallel lane: T4+T5 rows in scope (never inside S1–S3). */
  dsoLane: number
  /** profile ∧ hot signal, ignoring the S2 gates — so nesting hides nothing. */
  hotSignalTotal: number
  /** Exclusive deepest-stage counts; values sum to `total`. */
  partition: Record<FunnelPartitionKey, number>
}

export function computeFunnel(
  rows: readonly FunnelRowInput[],
  ctx: FunnelContext = {}
): FunnelSnapshot {
  const stageCounts: Record<FunnelStageId, number> = {
    universe: rows.length,
    profile: 0,
    signal_pool: 0,
    hot_lead: 0,
    website_checked: 0,
    outreach_ready: 0,
  }
  const partition: Record<FunnelPartitionKey, number> = {
    outreach_ready: 0,
    website_checked: 0,
    hot_lead: 0,
    signal_pool: 0,
    profile: 0,
    dso_pe_lane: 0,
    universe_rest: 0,
  }
  let dsoLane = 0
  let hotSignalTotal = 0

  for (const row of rows) {
    const m = deriveFunnelMembership(row, ctx)
    if (m.profile) stageCounts.profile += 1
    if (m.signalPool) stageCounts.signal_pool += 1
    if (m.hotLead) stageCounts.hot_lead += 1
    if (m.websiteChecked) stageCounts.website_checked += 1
    if (m.outreachReady) stageCounts.outreach_ready += 1
    if (m.dsoLane) dsoLane += 1
    if (m.hotSignal) hotSignalTotal += 1

    // Deepest exclusive assignment — verification overlay outranks base stages.
    if (m.outreachReady) partition.outreach_ready += 1
    else if (m.websiteChecked) partition.website_checked += 1
    else if (m.hotLead) partition.hot_lead += 1
    else if (m.signalPool) partition.signal_pool += 1
    else if (m.profile) partition.profile += 1
    else if (m.dsoLane) partition.dso_pe_lane += 1
    else partition.universe_rest += 1
  }

  return {
    total: rows.length,
    stages: FUNNEL_STAGE_IDS.map((id) => ({
      id,
      label: FUNNEL_STAGE_META[id].label,
      layer: FUNNEL_STAGE_META[id].layer,
      count: stageCounts[id],
    })),
    dsoLane,
    hotSignalTotal,
    partition,
  }
}

/** Rows belonging to one stage — powers "every stage clickable". */
export function filterRowsForStage<T extends FunnelRowInput>(
  rows: readonly T[],
  stage: FunnelStageId,
  ctx: FunnelContext = {}
): T[] {
  if (stage === "universe") return [...rows]
  return rows.filter((row) => {
    const m = deriveFunnelMembership(row, ctx)
    switch (stage) {
      case "profile":
        return m.profile
      case "signal_pool":
        return m.signalPool
      case "hot_lead":
        return m.hotLead
      case "website_checked":
        return m.websiteChecked
      case "outreach_ready":
        return m.outreachReady
    }
  })
}
