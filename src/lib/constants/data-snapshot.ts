/**
 * Last verified pipeline-wide constants used only as fast fallbacks when the
 * live Supabase `practices` table is unavailable or too slow for first paint.
 *
 * Source: post-F32 reconciliation verified 2026-04-26 in AGENTS/CLAUDE docs.
 * The canonical live clinic denominator still comes from `zip_scores` and
 * `practice_locations`; these constants avoid blocking pages on global NPI
 * count scans.
 */
export const GLOBAL_PRACTICE_NPI_COUNT = 381_598
/** @deprecated getPracticeStats() now queries this live from Supabase;
 * this constant is kept as a fallback for pages that have not yet migrated
 * (job-market, market-intel, system, data-breakdown). SQLite truth: 2,983. */
export const GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT = 2_992

