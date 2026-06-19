/**
 * CORPORATE CONSOLIDATION — HONEST PRESENTATION MODEL
 * ===================================================
 *
 * Single source of truth for how the app frames corporate / DSO ownership.
 * Created 2026-05-30 during the data-integrity audit. Read this before
 * touching ANY "corporate %", "consolidation %", or "DSO penetration" copy.
 *
 * ── The two units problem (the root of every wrong number) ──────────────
 *
 * 1. CONFIRMED corporate share (what WE measure): a GP clinic LOCATION is
 *    counted corporate only when it carries documented evidence —
 *      • a known DSO brand in its name / DBA, OR
 *      • a corporate parent_company, OR
 *      • an EIN shared across 3+ watched ZIPs (a billing-entity chain).
 *    This is computed at the location level in `reclassify_locations.py` and
 *    surfaced as `zip_scores.corporate_location_count / total_gp_locations`.
 *    As of 2026-06-19 it is 5.58% of watched GP locations (268 / 4,802) and
 *    5.61% in Chicagoland (249 / 4,440). That is the corrected 2026-06-12
 *    floor after false-corporate demotions + Data-Axle junk purge, plus the
 *    2026-06-19 exact-address DSO locator/friendly-PC promotions, net of 5
 *    duplicate-location rows excluded from the denominator. Audits:
 *    data/dso_research/il_false_corporate_demotions_20260612.json,
 *    data/dso_research/il_false_corporate_demotions_round2_20260612.json,
 *    data/dso_research/da_junk_cleanup_20260612.json,
 *    data/dso_research/duplicate_location_cleanup_20260619.json, and
 *    data/dso_research/il_verified_locator_promotions_20260619.json.
 *    (Live value is read at runtime from `zip_scores`, not this number.)
 *
 *    >>> THIS IS A FLOOR, NOT THE TRUTH. <<<
 *    DSOs routinely keep the acquired practice's original local name. A
 *    name/EIN/parent match cannot see those. So the confirmed share
 *    UNDER-counts true corporate ownership, by design. We never present it
 *    as "the consolidation rate" — only as "confirmed corporate".
 *
 * 1b. CONFIRMED per-DENTIST corporate share (the unit bridge): the SAME
 *    CATEGORY of confirmed corporate evidence as (1) — DSO brand, corporate
 *    parent, or shared-EIN chain — but evaluated by individual dentist
 *    (NPPES entity_type='individual', the NPI-level `practices` classifier)
 *    instead of by location (the `practice_locations` classifier). The two
 *    classifiers run independently; most of the per-dentist set
 *    are dentists working at our confirmed corporate locations. Because a
 *    corporate office employs ~2x the dentists of an independent one (≈3.3 vs
 *    ≈1.4 dentists/location in IL), the share rises from 5.61% (CHI locations)
 *    to 10.47% (IL dentists, 816 / 7,792) — the lift is primarily this density
 *    effect, not new claims. It is ALSO a documented floor (every counted NPI
 *    carries corporate evidence) and is in the same UNIT as the ADA anchor (2).
 *
 * 2. ADA HPI DSO-affiliation rate (the external benchmark): the share of
 *    DENTISTS — not locations — affiliated with a DSO, published by the
 *    American Dental Association's Health Policy Institute. Same UNIT as (1b).
 *    We use it only as the upper anchor of the estimated range — never as our
 *    own measured value.
 *
 * The band therefore has THREE honest anchors, and the gap decomposes:
 *    5.58% (our floor, watched locations; 5.61% CHI)
 *      └─ density effect (our confirmed corporate, by dentist) ─┐
 *   10.47% (our floor, IL dentists)                             │ density-driven
 *      └─ genuinely UNMEASURED hidden-DSO share ────────────────┘
 *   14.6% (ADA HPI 2024, IL dentists)        ← the remaining, truly-unknown gap
 *
 * The first segment is OUR confirmed corporate counted per-dentist (the lift is
 * primarily office density, not new claims); the second is the honest "we can't
 * see local-name DSOs" gap. We NEVER fabricate a precise "real" number inside
 * that second segment.
 */

/**
 * ADA HPI "Dentist Practice Modalities" — share of dentists affiliated with a
 * DSO, by state, all career stages. Mirrors the live `ada_hpi_benchmarks`
 * table (state, career_stage='all', pct_dso_affiliated). These are the values
 * verified against SQLite on 2026-05-30 (2024 release, the latest available).
 *
 * NOTE: per-DENTIST, not per-location. See the unit discussion above.
 */
export const ADA_HPI_DSO_AFFILIATION = {
  IL: {
    year: 2024,
    pctDentists: 14.6,
    // Year-over-year trend shows steady DSO growth (not a flat estimate).
    trend: [
      { y: 2022, p: 12.7 },
      { y: 2023, p: 13.0 },
      { y: 2024, p: 14.6 },
    ],
    // Early-career dentists affiliate at ~2-3x the all-stages rate — the
    // leading edge of consolidation. (IL early_career_lt10 2024 = 23.5%.)
    earlyCareerPct: 23.5,
  },
  MA: {
    year: 2024,
    pctDentists: 14.9,
    trend: [
      { y: 2022, p: 13.0 },
      { y: 2023, p: 12.9 },
      { y: 2024, p: 14.9 },
    ],
    earlyCareerPct: null,
  },
} as const

export type ConsolidationState = keyof typeof ADA_HPI_DSO_AFFILIATION

/**
 * CONFIRMED per-DENTIST corporate share — OUR measured floor, counted by
 * individual dentist (NPPES `entity_type='individual'`) instead of by location.
 * Same UNIT as `ADA_HPI_DSO_AFFILIATION`, so it bridges the per-location floor
 * and the ADA anchor on the band.
 *
 * Provenance (SQLite `practices` ⋈ `watched_zips`, 2026-06-19 post
 * false-corporate demotions, duplicate-location cleanup, and exact-match
 * DSO locator/friendly-PC promotions):
 *   individual-dentist NPIs classified dso_regional/dso_national ÷ ALL
 *   individual-dentist NPIs in scope.
 *     IL   816 / 7,792 = 10.47%
 *     MA    73 / 1,752 = 4.17%    (legacy comparison only; UI is Chicago-first)
 *     all  889 / 9,544 = 9.31%    (legacy combined watched set)
 *
 * This is ALSO a FLOOR — every counted NPI is classified corporate on
 * documented evidence (DSO brand, corporate parent, or shared-EIN chain). It is
 * the same CATEGORY of evidence as the per-location floor, evaluated by the
 * NPI-level `practices` classifier rather than the location-level one. The
 * lift from 5.58% (locations) to 10.47% (IL dentists) is
 * primarily the density effect — corporate offices employ ~2x the dentists of
 * an independent location (≈3.3 vs ≈1.4 in IL).
 *
 * NOTE: a documented pipeline constant (parallels ADA), NOT live-recomputed.
 * Computed from canonical SQLite state and synced to Supabase on 2026-06-19.
 * The per-LOCATION floor (`confirmedPct`) remains a live runtime parameter;
 * this per-dentist anchor and the ADA anchor are both cited measures with
 * provenance, by design.
 */
export const CONFIRMED_PER_DENTIST_CORPORATE = {
  IL: { pct: 10.47, corp: 816, total: 7792 },
  MA: { pct: 4.17, corp: 73, total: 1752 },
} as const

/**
 * Real US dental-practice (establishment / clinic) count, for national context.
 *
 * Source: BCG dental-consolidation reporting (2026) + US Census County
 * Business Patterns, NAICS 621210 "Offices of Dentists" (~130k establishments).
 * BCG's widely-cited figure is ≈137,000 practices.
 *
 * This is the ESTABLISHMENT count. It is NOT the federal NPPES NPI-row count
 * (~382k), which emits one row per individual dentist (NPI-1) AND one per
 * organization (NPI-2) at the same address — roughly 2.6x inflation. Any UI
 * that calls the NPI-row count "practices" is making a category error.
 */
export const US_DENTAL_PRACTICE_ESTIMATE = 137_000

/**
 * National federal NPPES NPI-row count for dental providers (individuals +
 * organizations, all 50 states). This is what `COUNT(*) FROM practices`
 * returns. Keep it labeled "NPI records", never "practices".
 */
export const US_NPPES_DENTAL_NPI_ROWS = 381_598

export interface CorporateBand {
  /** Evidence-based per-LOCATION corporate floor (what we measured; live value). */
  confirmedPct: number
  /** Our confirmed corporate counted per-DENTIST (NPI-level classifier) — the unit bridge (also a floor). */
  perDentistPct: number
  /** e.g. "our confirmed · IL dentists". */
  perDentistLabel: string
  /** ADA HPI per-dentist DSO-affiliation rate used as the upper anchor. */
  anchorPct: number
  anchorYear: number
  /** e.g. "ADA HPI 2024 · IL dentists". */
  anchorLabel: string
  /** 'IL' | 'MA' resolved state used for both per-dentist + anchor. */
  stateLabel: string
}

/**
 * Build the three-anchor honest band (per-location floor → per-dentist floor →
 * ADA per-dentist anchor) for a given measured confirmed LOCATION share.
 *
 * @param confirmedPct      Our measured corporate-owned LOCATION share (live, e.g. 5.27).
 * @param state             'IL' | 'MA' | 'mixed'. The primary app scope is now
 *                          Chicagoland-only, so 'mixed' anchors to IL.
 * @param perDentistOverride Optional live per-dentist share. Pass this once the NPI
 *                          flips re-sync to Supabase to make the bridge live too;
 *                          omit to use the documented `CONFIRMED_PER_DENTIST_CORPORATE`.
 */
export function getCorporateBand(
  confirmedPct: number,
  state: ConsolidationState | "mixed" = "mixed",
  perDentistOverride?: number
): CorporateBand {
  const key: ConsolidationState = state === "mixed" ? "IL" : state
  const a = ADA_HPI_DSO_AFFILIATION[key]
  const pd = CONFIRMED_PER_DENTIST_CORPORATE[key]
  return {
    confirmedPct,
    perDentistPct: perDentistOverride ?? pd.pct,
    perDentistLabel: `our confirmed · ${key} dentists`,
    anchorPct: a.pctDentists,
    anchorYear: a.year,
    anchorLabel: `ADA HPI ${a.year} · ${key} dentists`,
    stateLabel: key,
  }
}

/** One marker on the visual band. */
export interface CorporateBandPoint {
  key: "floor" | "perDentist" | "anchor"
  /** Short label under the marker. */
  label: string
  pct: number
  /** 'confirmed' = our measured floor (red); 'anchor' = external ADA (goldenrod). */
  kind: "confirmed" | "anchor"
  /** Long-form explanation for tooltip/legend. */
  note: string
}

/**
 * Ordered markers for the visual band bar (always low→high). The first two are
 * OUR confirmed floors (locations, then dentists); the third is the ADA anchor.
 */
export function getCorporateBandPoints(band: CorporateBand): CorporateBandPoint[] {
  return [
    {
      key: "floor",
      label: "Confirmed (locations)",
      pct: band.confirmedPct,
      kind: "confirmed",
      note: "Corporate-owned GP locations with documented evidence (DSO brand, corporate parent, or EIN shared across 3+ ZIPs). The live, synced floor.",
    },
    {
      key: "perDentist",
      label: "Confirmed (dentists)",
      pct: band.perDentistPct,
      kind: "confirmed",
      note: `Our confirmed corporate, counted per dentist instead of per location (the NPI-level classifier; ~80% set overlap with the location floor, ≈690 shared). The lift from the location floor is primarily office density — corporate offices employ ~2x the dentists of an independent one. Same UNIT as the ADA anchor.`,
    },
    {
      key: "anchor",
      label: band.anchorLabel,
      pct: band.anchorPct,
      kind: "anchor",
      note: `${band.anchorLabel} = ${band.anchorPct}% of dentists DSO-affiliated (American Dental Association Health Policy Institute, ${band.anchorYear}). Upper anchor — the per-dentist gap above our confirmed per-dentist floor is the genuinely unmeasured hidden-DSO share (DSOs operating under local names that name/EIN matching can't see).`,
    },
  ]
}

/**
 * Full honest tooltip for a corporate KPI. Explains the floor, the per-dentist
 * unit bridge, and the external anchor — in the unit-aware language above.
 */
export function corporateBandTooltip(band: CorporateBand): string {
  return [
    `${band.confirmedPct.toFixed(1)}% CONFIRMED corporate-owned GP locations.`,
    `Every one carries documented evidence: a known DSO brand, a corporate parent company, or an EIN shared across 3+ ZIPs.`,
    `This is a FLOOR — DSOs routinely keep the acquired practice's local name, so name-matching can't see them.`,
    `Counting our confirmed corporate by dentist instead of by location (corporate offices employ ~2x the dentists each) lifts it to ${band.perDentistPct.toFixed(1)}% of ${band.stateLabel} dentists — primarily a density effect, still a floor.`,
    `External anchor: ${band.anchorLabel} = ${band.anchorPct}% of dentists DSO-affiliated. The gap from ${band.perDentistPct.toFixed(1)}% to ${band.anchorPct}% (same per-dentist unit) is the genuinely unmeasured local-name DSO share.`,
  ].join(" ")
}

/**
 * Compact three-anchor string for subtitles, e.g.
 * "Floor (locations) · 9.7% per dentist · ADA HPI 14.6% of IL dentists".
 */
export function corporateBandSubtitle(band: CorporateBand): string {
  return `Floor · ${band.perDentistPct.toFixed(1)}% per ${band.stateLabel} dentist · anchor ${band.anchorPct}% (${band.anchorLabel})`
}
