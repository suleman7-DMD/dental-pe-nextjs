/**
 * headline-stats.ts — the single source for every census KPI headline.
 *
 * Home, Directory (/job-market), Ownership (/market-intel), and Acquisition
 * Scout (/buyability) render their KPI cards FROM these definitions. A page
 * never computes or relabels a headline number on its own: the same stat has
 * the same key, label, formula, and formatting everywhere it appears, and two
 * different formulas may never share a label.
 *
 * Scope still belongs to the page — metro / living-location filters decide
 * which rows feed `summarizeBuckets` — but how that summary is presented is
 * defined once here.
 */

import {
  ADA_ANCHOR_UNIT_CAVEAT,
  ADA_IL_PER_DENTIST_DSO_PCT,
  BUCKET_META,
  NOT_SOLO_HEADLINE_LABEL,
  type BucketSummary,
} from "./ownership-truth"

export type HeadlineStatKey =
  | "gp_locations"
  | "hand_reviewed"
  | "not_solo_share"
  | "dso_pe_share"
  | "multi_location_reviewed"
  | "acquisition_leads_strict"
  | "acquisition_leads_broad"

export interface HeadlineStat {
  key: HeadlineStatKey
  /** Card label — identical on every page that shows this stat. */
  label: string
  /** Formatted display value. */
  value: string
  /** One-line qualifier rendered under the value. */
  sublabel: string
  /** Full definition: numerator, denominator, and caveats. */
  tooltip: string
  accentColor?: string
}

// One formatting rule for all headline numbers. Locale is pinned so server
// and client render identical strings (no hydration drift).
function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function formatShare(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * GP clinic locations — the census denominator for the page's scope.
 *
 * Pass `gpRowCount` (raw GP rows in practice_locations for the same scope)
 * when the page has it: the card then shows the address-deduped clinic count
 * with the raw-row figure as context, and falls back to raw rows if the
 * scored denominator is unavailable.
 */
export function gpLocationsStat(
  summary: BucketSummary,
  opts?: { gpRowCount?: number | null }
): HeadlineStat {
  const gpRowCount = opts?.gpRowCount ?? null
  const hasUniverse = summary.universe > 0

  return {
    key: "gp_locations",
    label: "GP Clinic Locations",
    value: formatCount(hasUniverse ? summary.universe : gpRowCount ?? 0),
    sublabel: !hasUniverse
      ? "GP location records (deduped clinic count unavailable)"
      : gpRowCount != null && gpRowCount !== summary.universe
        ? `${formatCount(gpRowCount)} GP location records before dedupe`
        : "clinic denominator for this scope",
    tooltip:
      "Address-deduped general-practice clinic locations in the selected scope (zip_scores.total_gp_locations). Specialists, non-clinical records, unverified Data Axle rows, and duplicate shells are excluded. This is a clinic count, not the federal NPI-row count.",
  }
}

/** Hand-reviewed ownership conclusions — the census numerator. */
export function handReviewedStat(summary: BucketSummary): HeadlineStat {
  return {
    key: "hand_reviewed",
    label: "Hand-Reviewed So Far",
    value: formatCount(summary.reviewed),
    sublabel: `${formatShare(summary.coveragePct)} of ${formatCount(summary.universe)} GP locations`,
    tooltip:
      "Locations with a hand-reviewed ownership conclusion backed by cited evidence. Everything else stays Unresolved — shown honestly, never filled with estimates.",
    accentColor: "#2D8B4E",
  }
}

/** Share of reviewed clinics that are not one dentist owning one location. */
export function notSoloShareStat(summary: BucketSummary): HeadlineStat {
  return {
    key: "not_solo_share",
    label: NOT_SOLO_HEADLINE_LABEL,
    value: formatShare(summary.notSoloOwnerOperatedPctOfReviewed),
    sublabel: "of hand-reviewed clinics",
    tooltip:
      "Share of hand-reviewed clinics that are NOT one dentist owning and operating one location. Includes dentist-owned groups and networks — this is NOT a DSO share. The conventional DSO/PE number is its own card.",
  }
}

/**
 * The DSO/PE headline: share of reviewed clinics, with the whole-universe
 * floor as context. The floor holds unreviewed clinics out as unknown, so it
 * can only rise as review coverage grows.
 */
export function dsoPeShareStat(summary: BucketSummary): HeadlineStat {
  return {
    key: "dso_pe_share",
    label: `${BUCKET_META.dso_pe_corporate.label} Share`,
    value: formatShare(summary.dsoPePctOfReviewed),
    sublabel: `of reviewed · ${formatShare(summary.dsoPePctOfUniverse)} floor across all GP locations`,
    tooltip: `Hand-reviewed stealth-DSO + branded-DSO share of reviewed clinics: ${formatCount(summary.counts.dso_pe_corporate)} locations, ${formatCount(summary.peBacked)} with confirmed PE backing. The floor counts the same clinics against ALL GP locations, holding unreviewed ones out as unknown. External anchor: ADA HPI 2024 = ${ADA_IL_PER_DENTIST_DSO_PCT}% of IL dentists DSO-affiliated. ${ADA_ANCHOR_UNIT_CAVEAT}`,
    accentColor: "#C23B3B",
  }
}

/** The canonical census KPI strip, in canonical order. */
export function censusHeadlineStats(
  summary: BucketSummary,
  opts?: { gpRowCount?: number | null }
): HeadlineStat[] {
  return [
    gpLocationsStat(summary, opts),
    handReviewedStat(summary),
    notSoloShareStat(summary),
    dsoPeShareStat(summary),
  ]
}

/**
 * Reviewed clinics owned by multi-location operators (census T3–T5). The
 * count comes from tier data the page already holds — single-location groups
 * (T2) stay out.
 */
export function multiLocationReviewedStat(multiLocationReviewed: number): HeadlineStat {
  return {
    key: "multi_location_reviewed",
    label: "Multi-Location Owners",
    value: formatCount(multiLocationReviewed),
    sublabel: "reviewed clinics in 2+ location networks",
    tooltip:
      "Hand-reviewed clinics owned by a multi-location operator: dentist-owned multi-location groups, stealth DSOs, and branded DSOs (census T3–T5). Single-location groups count as independent.",
    accentColor: "#6366F1",
  }
}

/**
 * The strict acquisition-lead cut (Home). Strict and broad are intentionally
 * different numbers from the same pre-census importer queue — so they carry
 * different labels and each tooltip names the other by definition, never by a
 * hardcoded count.
 */
export function acquisitionLeadsStrictStat(strictCount: number): HeadlineStat {
  return {
    key: "acquisition_leads_strict",
    label: "High-Score Acquisition Leads",
    value: formatCount(strictCount),
    sublabel: "early signal — ownership not yet vetted",
    tooltip:
      "Independent-classified practices with a buyability score of 50 or more from the pre-census importer. An early lead list only: Acquisition Scout holds the broad queue this is cut from, and every lead still needs its hand-reviewed ownership record checked before action.",
    accentColor: "#2D8B4E",
  }
}

/** The broad acquisition-lead queue (Acquisition Scout). */
export function acquisitionLeadsBroadStat(broadCount: number): HeadlineStat {
  return {
    key: "acquisition_leads_broad",
    label: "Acquisition Leads (Broad)",
    value: formatCount(broadCount),
    sublabel: "every independent-classified practice",
    tooltip:
      "Every independent-classified practice regardless of buyability score. Home shows the strict cut of this same queue (score 50 or more), so the two cards intentionally differ: broad queue here, short list there. Both are early signals to screen against hand-reviewed ownership.",
    accentColor: "#2D8B4E",
  }
}
