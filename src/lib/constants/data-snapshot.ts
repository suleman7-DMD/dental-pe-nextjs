/**
 * Global pipeline-wide constants used as fast fallbacks when a live Supabase
 * query is unavailable or too slow for first paint.
 *
 * Source: post-F32 reconciliation verified 2026-04-26 in AGENTS/CLAUDE docs.
 * The canonical live clinic denominator comes from `zip_scores` and
 * `practice_locations`; these constants avoid blocking pages on global NPI
 * count scans.
 *
 * ## Freshness bar policy (do not regress)
 *
 * Pages that already fetch `practice_locations` rows for the selected scope
 * MUST prefer scoped live counts over these global fallbacks:
 *
 *   - `totalPractices` → use `locations.length` (location-deduped, scoped)
 *   - `daEnriched`     → use `locations.filter(p => p.data_axle_enriched).length`
 *
 * This makes the freshness bar scope-aware (e.g. "21.7% enriched in Chicagoland"
 * vs the misleading "0.8% enriched globally" when denominator was 381k).
 *
 * Pages that have migrated to scoped live counts: job-market (2026-04-27).
 * Pages still using these fallbacks: market-intel, system, data-breakdown.
 */
export const GLOBAL_PRACTICE_NPI_COUNT = 381_598
/**
 * @deprecated getPracticeStats() now queries this live from Supabase.
 * Job Market page now computes enriched count from scoped `practice_locations`
 * rows (data_axle_enriched=true) rather than using this global constant.
 * Remaining users: market-intel, system, data-breakdown.
 * SQLite truth as of 2026-04-26: 2,983.
 */
export const GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT = 2_992
