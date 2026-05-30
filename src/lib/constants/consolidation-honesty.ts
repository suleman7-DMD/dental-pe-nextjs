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
 *    As of 2026-05-30 it is ~4.0% of watched GP locations (200 / 4,970).
 *
 *    >>> THIS IS A FLOOR, NOT THE TRUTH. <<<
 *    DSOs routinely keep the acquired practice's original local name. A
 *    name/EIN/parent match cannot see those. So the confirmed share
 *    UNDER-counts true corporate ownership, by design. We never present it
 *    as "the consolidation rate" — only as "confirmed corporate".
 *
 * 2. ADA HPI DSO-affiliation rate (the external benchmark): the share of
 *    DENTISTS — not locations — affiliated with a DSO, published by the
 *    American Dental Association's Health Policy Institute. This is a
 *    DIFFERENT UNIT: it counts people, and corporate offices employ more
 *    dentists per location, so the per-dentist rate runs HIGHER than a
 *    per-location rate. We use it only as the upper anchor of the estimated
 *    range — never as our own measured value.
 *
 * The honest statement on every corporate KPI is therefore:
 *    "X.X% confirmed corporate-owned locations (documented floor).
 *     True share is higher — DSOs hide behind local names. ADA HPI reports
 *     YY% of <state> dentists are DSO-affiliated (per-dentist, <year>)."
 *
 * We NEVER fabricate a precise "real" number in either direction. The
 * confirmed floor has SQL provenance; the upper anchor is a cited external
 * benchmark; the gap between them is labeled honestly as unmeasured.
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
  /** Evidence-based location-share floor (what we actually measured). */
  confirmedPct: number
  /** ADA HPI per-dentist DSO-affiliation rate used as the upper anchor. */
  anchorPct: number
  anchorYear: number
  /** e.g. "ADA HPI 2024 · IL dentists". */
  anchorLabel: string
}

/**
 * Build the confirmed-floor + ADA-anchored band for a given measured
 * confirmed location share.
 *
 * @param confirmedPct  Our measured corporate-owned location share (e.g. 4.0).
 * @param state         'IL' | 'MA' | 'mixed'. The watched set is IL-dominant
 *                      (269 IL ZIPs + 21 MA ZIPs), so 'mixed' anchors to IL.
 */
export function getCorporateBand(
  confirmedPct: number,
  state: ConsolidationState | "mixed" = "mixed"
): CorporateBand {
  const a =
    state === "mixed" ? ADA_HPI_DSO_AFFILIATION.IL : ADA_HPI_DSO_AFFILIATION[state]
  const stateLabel = state === "mixed" ? "IL" : state
  return {
    confirmedPct,
    anchorPct: a.pctDentists,
    anchorYear: a.year,
    anchorLabel: `ADA HPI ${a.year} · ${stateLabel} dentists`,
  }
}

/**
 * Full honest tooltip for a corporate KPI. Explains the floor, why it's a
 * floor, and the external anchor — in the unit-aware language above.
 */
export function corporateBandTooltip(band: CorporateBand): string {
  return [
    `${band.confirmedPct.toFixed(1)}% CONFIRMED corporate-owned GP locations.`,
    `Every one carries documented evidence: a known DSO brand, a corporate parent company, or an EIN shared across 3+ ZIPs.`,
    `This is a FLOOR — DSOs routinely keep the acquired practice's local name, so name-matching can't see them.`,
    `External benchmark: ${band.anchorLabel} = ${band.anchorPct}% of dentists DSO-affiliated (a per-dentist measure; corporate offices employ more dentists, so true per-location share sits between our confirmed floor and this figure).`,
  ].join(" ")
}

/**
 * Compact "confirmed → estimate" string for subtitles, e.g.
 * "Confirmed floor · true share likely higher (ADA HPI: 14.6% of IL dentists)".
 */
export function corporateBandSubtitle(band: CorporateBand): string {
  return `Confirmed floor — true share is higher (${band.anchorLabel}: ${band.anchorPct}% of dentists DSO-affiliated)`
}
