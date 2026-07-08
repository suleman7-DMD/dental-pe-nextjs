/**
 * ownership-truth.ts — THE ownership data contract.
 *
 * This module is the ONLY place in the frontend allowed to interpret
 * `ownership_tier`, assign headline buckets, or derive a source class.
 * Pages import from here; none reimplement the mapping. That makes it
 * structurally impossible to present detector/legacy/partial data as
 * census truth.
 *
 * Binding rules (SESSION_CHARTER_FABLE_TRUTH_APP_20260704.md §2, user-ratified
 * DECISION_TRUE_INDEPENDENT_HEADLINE_20260703.md):
 *
 *  - `ownership_tier` is the ONLY ownership truth layer. The legacy
 *    `entity_classification` detector may appear ONLY labeled as
 *    "legacy detector estimate (context)" — never as census truth.
 *  - Exactly five headline buckets, never collapsed into one "corporate %":
 *      True Solo Owner-Operated (T1) / Dentist-Owned, Not Solo (T2+T3) /
 *      DSO / PE / Corporate Controlled (T4+T5) / Institutional (T6) /
 *      Unresolved (undetermined + holds + unreviewed).
 *  - Labeling law: the broad top-line is "Not Solo Owner-Operated %" —
 *    NEVER "DSO-affiliated %". Only the conventional T4+T5 number may sit
 *    next to the ADA 14.6% per-dentist anchor (with the unit caveat).
 *  - Unresolved stays VISIBLE — never rolled into another bucket.
 *  - No hardcoded census tallies anywhere: counts compute from live rows.
 */

// ---------------------------------------------------------------------------
// Tiers (census truth layer — values as written by consolidate_census.py)
// ---------------------------------------------------------------------------

export const OWNERSHIP_TIERS = [
  "true_independent", // T1 — one dentist BOTH owns AND operates one location
  "single_loc_group", // T2 — dentist-owned, single location, not solo owner-operator
  "dentist_multi", // T3 — dentist-owned multi-location network (NOT a DSO)
  "stealth_dso", // T4 — DSO/MSO control documented behind a local-looking brand
  "branded_dso", // T5 — named DSO brand / platform
  "institutional", // T6 — hospital, university, public-health, corrections
] as const

export type OwnershipTier = (typeof OWNERSHIP_TIERS)[number]

/** Charter shorthand (T1–T6) for specs, tooltips, and audit surfaces. */
export const TIER_CODE: Record<OwnershipTier, string> = {
  true_independent: "T1",
  single_loc_group: "T2",
  dentist_multi: "T3",
  stealth_dso: "T4",
  branded_dso: "T5",
  institutional: "T6",
}

export function isOwnershipTier(value: string | null | undefined): value is OwnershipTier {
  return typeof value === "string" && (OWNERSHIP_TIERS as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// The five headline buckets (user-ratified — exactly these, never collapsed)
// ---------------------------------------------------------------------------

export const HEADLINE_BUCKETS = [
  "true_solo_owner_operated",
  "dentist_owned_not_solo",
  "dso_pe_corporate",
  "institutional",
  "unresolved",
] as const

export type HeadlineBucket = (typeof HEADLINE_BUCKETS)[number]

export interface BucketMeta {
  label: string
  shortLabel: string
  tiers: OwnershipTier[]
  description: string
  /** Design-token-aligned hex for bars/chips. */
  color: string
}

export const BUCKET_META: Record<HeadlineBucket, BucketMeta> = {
  true_solo_owner_operated: {
    label: "True Independent",
    shortLabel: "True Independent",
    tiers: ["true_independent"],
    description: "One dentist owns and runs one office.",
    color: "#2563EB",
  },
  dentist_owned_not_solo: {
    label: "Dentist-Owned Group",
    shortLabel: "Dentist-Owned",
    tiers: ["single_loc_group", "dentist_multi"],
    description:
      "Dentist-owned, but not a true solo office: either multiple dentists at one site or a dentist-owned multi-location group.",
    color: "#0D9488",
  },
  dso_pe_corporate: {
    label: "DSO / PE",
    shortLabel: "DSO / PE",
    tiers: ["stealth_dso", "branded_dso"],
    description:
      "Corporate dental groups, including branded DSOs and local-looking offices with documented DSO/MSO control.",
    color: "#C23B3B",
  },
  institutional: {
    label: "Institutional",
    shortLabel: "Institutional",
    tiers: ["institutional"],
    description: "Hospital, university, public-health, or similar institutional settings (T6).",
    color: "#6B7280",
  },
  unresolved: {
    label: "Unresolved",
    shortLabel: "Unresolved",
    tiers: [],
    description:
      "Not yet a census conclusion: undetermined after research, held for adjudication, or not yet reviewed. Always shown — never rolled into another bucket.",
    color: "#B8860B",
  },
}

export function tierToBucket(tier: string | null | undefined): HeadlineBucket {
  if (!isOwnershipTier(tier)) return "unresolved"
  switch (tier) {
    case "true_independent":
      return "true_solo_owner_operated"
    case "single_loc_group":
    case "dentist_multi":
      return "dentist_owned_not_solo"
    case "stealth_dso":
    case "branded_dso":
      return "dso_pe_corporate"
    case "institutional":
      return "institutional"
  }
}

// ---------------------------------------------------------------------------
// Source classes — every displayed number states one of these
// ---------------------------------------------------------------------------

export const SOURCE_CLASSES = [
  "census_reviewed", // hand-reviewed census conclusion with evidence
  "held", // reviewed but held for adjudication (dso_verify / unresolved / dup-suspect)
  "undetermined", // researched, evidence too thin to classify
  "unreviewed", // not yet researched by the census
  "legacy_detector", // entity_classification detector output — CONTEXT ONLY
  "pe_deal_context", // deal-announcement data — context, not a location-level census fact
] as const

export type SourceClass = (typeof SOURCE_CLASSES)[number]

export const SOURCE_CLASS_META: Record<SourceClass, { label: string; description: string }> = {
  census_reviewed: {
    label: "Reviewed",
    description: "A human-reviewed ownership answer backed by evidence.",
  },
  held: {
    label: "Needs decision",
    description: "Reviewed, but a conflict, duplicate question, or verification blocker still needs a decision.",
  },
  undetermined: {
    label: "Researched, still unclear",
    description: "Researched, but the evidence was too thin to classify.",
  },
  unreviewed: {
    label: "Not reviewed yet",
    description: "This location has not been reviewed yet.",
  },
  legacy_detector: {
    label: "Old automated estimate",
    description:
      "Older automated signal from before the hand review. Audit context only, not the ownership answer.",
  },
  pe_deal_context: {
    label: "PE deal context",
    description: "Deal-announcement data. Market context — not a location-level ownership conclusion.",
  },
}

/**
 * Derive the source class for a location's OWNERSHIP answer.
 *
 * DATA GAP (documented in the contract doc): Supabase today carries no
 * review-status column, so held (91) and undetermined-researched (~477)
 * locations are indistinguishable from never-researched — all have
 * ownership_tier NULL. Until a `census_review_status` column syncs, NULL
 * maps to `unreviewed` and the Review Desk sources holds/triage counts
 * from the main-repo artifacts, labeled as such. Pass `reviewStatus` when
 * that feed lands; the UI upgrades automatically.
 */
export function deriveSourceClass(
  ownershipTier: string | null | undefined,
  reviewStatus?: "held" | "undetermined" | null
): SourceClass {
  if (isOwnershipTier(ownershipTier)) return "census_reviewed"
  if (reviewStatus === "held") return "held"
  if (reviewStatus === "undetermined") return "undetermined"
  return "unreviewed"
}

// ---------------------------------------------------------------------------
// Labeling law + external anchors
// ---------------------------------------------------------------------------

/** The ONLY legal name for the broad top-line share. Never "DSO-affiliated %". */
export const NOT_SOLO_HEADLINE_LABEL = "Not Solo Owner-Operated %"

/** The only bucket whose share may sit next to the ADA anchor. */
export const ADA_COMPARABLE_BUCKET: HeadlineBucket = "dso_pe_corporate"

/**
 * External anchor, NOT our census output. ADA HPI 2024 DSO-affiliation rate
 * for Illinois — a PER-DENTIST rate; our census buckets are PER-LOCATION.
 * Always state the unit caveat when shown together.
 */
export const ADA_IL_PER_DENTIST_DSO_PCT = 14.6
export const ADA_ANCHOR_UNIT_CAVEAT =
  "ADA 14.6% counts dentists; the census counts locations. Different units — compare direction, not magnitude."

/** Standing label for any legacy-detector surface. */
export const LEGACY_DETECTOR_CONTEXT_LABEL = SOURCE_CLASS_META.legacy_detector.label

/**
 * Census network_id slugs ("heartland_dental") → display labels
 * ("Heartland Dental"). The ONLY network formatter — every surface imports
 * this one. Free-text ids (spaces, slashes, parens, commas — reviewer notes
 * rather than slugs) pass through verbatim after the ao:/brand: prefix.
 */
export function formatNetworkId(id: string): string {
  const prefix = /^ao:/i.test(id) ? "Owner: " : /^brand:/i.test(id) ? "Group: " : ""
  const body = id.replace(/^ao:/i, "").replace(/^brand:/i, "")
  if (/[^a-z0-9_\-.]/i.test(body)) return `${prefix}${body.trim()}`
  const cleaned = body
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => (/\d/.test(w) || (w.length <= 3 && w === w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
  return `${prefix}${cleaned}`
}

// ---------------------------------------------------------------------------
// Per-location record — the canonical helper API
// ---------------------------------------------------------------------------

export type OwnershipConfidence = "high" | "medium" | "low"

export interface OwnershipRecord {
  tier: OwnershipTier | null
  tierCode: string | null
  bucket: HeadlineBucket
  statusClass: SourceClass
  peBacked: boolean
  confidence: OwnershipConfidence | null
  evidenceBasis: string | null
  evidenceUrls: string[]
  networkId: string | null
  /** True only when the answer is a hand-reviewed census conclusion. */
  isCensusTruth: boolean
}

export interface OwnershipSourceFields {
  ownership_tier: string | null
  pe_backed: boolean | null
  ownership_evidence_basis: string | null
  ownership_evidence_urls: string | null
  ownership_confidence: string | null
  network_id: string | null
}

function parseEvidenceUrls(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && /^https?:\/\//.test(item)
      )
    }
  } catch {
    // fall through
  }
  return []
}

function parseConfidence(value: string | null | undefined): OwnershipConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null
}

/**
 * The single entry point for "what do we know about this location's ownership".
 * Every page renders from this record; none read ownership_tier directly.
 */
export function getOwnershipRecord(
  row: OwnershipSourceFields,
  reviewStatus?: "held" | "undetermined" | null
): OwnershipRecord {
  const tier = isOwnershipTier(row.ownership_tier) ? row.ownership_tier : null
  const statusClass = deriveSourceClass(row.ownership_tier, reviewStatus)
  return {
    tier,
    tierCode: tier ? TIER_CODE[tier] : null,
    bucket: tierToBucket(row.ownership_tier),
    statusClass,
    peBacked: row.pe_backed === true,
    confidence: tier ? parseConfidence(row.ownership_confidence) : null,
    evidenceBasis: tier ? row.ownership_evidence_basis : null,
    evidenceUrls: tier ? parseEvidenceUrls(row.ownership_evidence_urls) : [],
    networkId: row.network_id ?? null,
    isCensusTruth: statusClass === "census_reviewed",
  }
}

// ---------------------------------------------------------------------------
// Aggregation — the five-bucket summary every headline computes from
// ---------------------------------------------------------------------------

export interface BucketSummary {
  /** GP-location universe (SUM(zip_scores.total_gp_locations) for the scope). */
  universe: number
  reviewed: number
  coveragePct: number
  counts: Record<HeadlineBucket, number>
  /** Share of the FULL universe, per bucket (sums to 100 with unresolved). */
  pctOfUniverse: Record<HeadlineBucket, number>
  /** Share of REVIEWED locations only (unresolved excluded by definition). */
  pctOfReviewed: Record<HeadlineBucket, number>
  peBacked: number
  /** Labeling-law top-line: (reviewed − T1) / reviewed. */
  notSoloOwnerOperatedPctOfReviewed: number
  /** Conventional DSO/PE share (T4+T5) — the only ADA-comparable number. */
  dsoPePctOfReviewed: number
  dsoPePctOfUniverse: number
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

/**
 * Build the five-bucket summary from live tier rows + the scope's GP universe.
 * `universe` MUST come from a live query (zip_scores or a count), never a constant.
 */
export function summarizeBuckets(
  rows: Array<Pick<OwnershipSourceFields, "ownership_tier" | "pe_backed">>,
  universe: number
): BucketSummary {
  const counts: Record<HeadlineBucket, number> = {
    true_solo_owner_operated: 0,
    dentist_owned_not_solo: 0,
    dso_pe_corporate: 0,
    institutional: 0,
    unresolved: 0,
  }
  let reviewed = 0
  let peBacked = 0

  for (const row of rows) {
    if (!isOwnershipTier(row.ownership_tier)) continue
    reviewed += 1
    counts[tierToBucket(row.ownership_tier)] += 1
    if (row.pe_backed === true) peBacked += 1
  }

  counts.unresolved = Math.max(universe - reviewed, 0)

  const pctOfUniverse = {} as Record<HeadlineBucket, number>
  const pctOfReviewed = {} as Record<HeadlineBucket, number>
  for (const bucket of HEADLINE_BUCKETS) {
    pctOfUniverse[bucket] = pct(counts[bucket], universe)
    pctOfReviewed[bucket] = bucket === "unresolved" ? 0 : pct(counts[bucket], reviewed)
  }

  return {
    universe,
    reviewed,
    coveragePct: pct(reviewed, universe),
    counts,
    pctOfUniverse,
    pctOfReviewed,
    peBacked,
    notSoloOwnerOperatedPctOfReviewed: pct(reviewed - counts.true_solo_owner_operated, reviewed),
    dsoPePctOfReviewed: pct(counts.dso_pe_corporate, reviewed),
    dsoPePctOfUniverse: pct(counts.dso_pe_corporate, universe),
  }
}

// ---------------------------------------------------------------------------
// Tier display meta (labels align with ratified semantics)
// ---------------------------------------------------------------------------

export interface TierMeta {
  label: string
  shortLabel: string
  description: string
  color: string
}

export const TIER_META: Record<OwnershipTier, TierMeta> = {
  true_independent: {
    label: "True Independent",
    shortLabel: "True Independent",
    description: "One dentist owns and runs one office.",
    color: BUCKET_META.true_solo_owner_operated.color,
  },
  single_loc_group: {
    label: "Dentist-Owned Group",
    shortLabel: "Dentist Group",
    description: "One office with multiple dentists, dentist-owned.",
    color: BUCKET_META.dentist_owned_not_solo.color,
  },
  dentist_multi: {
    label: "Dentist Consolidated",
    shortLabel: "Dentist Consolidated",
    description: "A dentist-owned multi-location group. Not DSO/PE-controlled.",
    color: BUCKET_META.dentist_owned_not_solo.color,
  },
  stealth_dso: {
    label: "Stealth DSO",
    shortLabel: "Stealth DSO",
    description: "DSO/MSO control documented behind a local-looking brand (T4).",
    color: "#D4920B",
  },
  branded_dso: {
    label: "Branded DSO",
    shortLabel: "Branded DSO",
    description: "Named DSO brand or platform (T5).",
    color: BUCKET_META.dso_pe_corporate.color,
  },
  institutional: {
    label: "Institutional",
    shortLabel: "Institutional",
    description: "Hospital, university, public-health, or similar setting (T6).",
    color: BUCKET_META.institutional.color,
  },
}
