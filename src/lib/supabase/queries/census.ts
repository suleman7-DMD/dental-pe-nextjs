import type { SupabaseClient } from "@supabase/supabase-js"

import {
  summarizeBuckets,
  type BucketSummary,
} from "@/lib/census/ownership-truth"
import { fetchAllRowsStable } from "@/lib/supabase/queries/stable-pagination"

const PAGE_SIZE = 1000
const PRIMARY_MARKET_STATE = "IL"

export interface CensusSummary {
  universe: number
  /** Rows with any non-null ownership_tier (classified + undetermined). */
  reviewed: number
  /** Rows carrying one of the six census tiers — the only census truth rows. */
  classifiedReviewed: number
  /** Researched, but evidence too thin to classify. Stays visible, never rolled up. */
  undeterminedReviewed: number
  unreviewed: number
  coveragePct: number
  tierCounts: Record<string, number>
  peBacked: number
  /**
   * The ratified five-bucket law, computed by ownership-truth.ts —
   * the ONLY legal source for headline ownership shares.
   */
  buckets: BucketSummary
  /** T3–T5 structural slice (multi-location operators). NOT an ownership bucket. */
  multiLocationReviewed: number
  dsoPeReviewed: number
  dsoPeWholeFloorPct: number
  legacyCorporateLocations: number
  legacyCorporatePct: number
  liveDataAvailable: boolean
}

interface CensusLocationRow {
  location_id: string
  ownership_tier: string | null
  pe_backed: boolean | null
}

interface ZipScoreCensusRow {
  total_gp_locations: number | null
  corporate_location_count: number | null
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return (numerator / denominator) * 100
}

async function fetchTieredLocationRows(
  supabase: SupabaseClient
): Promise<CensusLocationRow[]> {
  // This query previously paginated with NO ORDER BY at all, so page
  // boundaries were arbitrary and tier counts could double- or under-count.
  // location_id (primary key) gives an exact total order + dedupe.
  return fetchAllRowsStable<CensusLocationRow>({
    label: "census tiered locations",
    pageSize: PAGE_SIZE,
    keyOf: (row) => row.location_id,
    fetchPage: (from, to) =>
      supabase
        .from("practice_locations")
        .select("location_id,ownership_tier,pe_backed")
        .eq("state", PRIMARY_MARKET_STATE)
        .not("ownership_tier", "is", null)
        .order("location_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: CensusLocationRow[] | null
        error: unknown
      }>,
  })
}

async function fetchIlZipScores(
  supabase: SupabaseClient
): Promise<ZipScoreCensusRow[]> {
  const { data, error } = await supabase
    .from("zip_scores")
    .select("total_gp_locations,corporate_location_count")
    .eq("state", PRIMARY_MARKET_STATE)

  if (error) throw error
  return (data as unknown as ZipScoreCensusRow[]) ?? []
}

export async function getCensusSummary(
  supabase: SupabaseClient
): Promise<CensusSummary> {
  try {
    const [tieredRows, zipRows] = await Promise.all([
      fetchTieredLocationRows(supabase),
      fetchIlZipScores(supabase),
    ])

    const universe = zipRows.reduce(
      (sum, row) => sum + (row.total_gp_locations ?? 0),
      0
    )
    const tierCounts: Record<string, number> = {}

    for (const row of tieredRows) {
      const tier = row.ownership_tier ?? "unknown"
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1
    }

    const buckets = summarizeBuckets(tieredRows, universe)

    const reviewed = tieredRows.length
    const undeterminedReviewed = tierCounts.undetermined ?? 0
    // Only the six census tiers count as classified — a stray non-tier value
    // (e.g. a legacy detector label) must never inflate the truth count.
    const classifiedReviewed = buckets.reviewed
    const dsoPeReviewed = buckets.counts.dso_pe_corporate
    const multiLocationReviewed =
      (tierCounts.dentist_multi ?? 0) +
      (tierCounts.stealth_dso ?? 0) +
      (tierCounts.branded_dso ?? 0)
    const legacyCorporateLocations = zipRows.reduce(
      (sum, row) => sum + (row.corporate_location_count ?? 0),
      0
    )

    return {
      universe,
      reviewed,
      classifiedReviewed,
      undeterminedReviewed,
      unreviewed: Math.max(universe - reviewed, 0),
      coveragePct: pct(reviewed, universe),
      tierCounts,
      peBacked: buckets.peBacked,
      buckets,
      multiLocationReviewed,
      dsoPeReviewed,
      dsoPeWholeFloorPct: buckets.dsoPePctOfUniverse,
      legacyCorporateLocations,
      legacyCorporatePct: pct(legacyCorporateLocations, universe),
      liveDataAvailable: true,
    }
  } catch (error) {
    console.error("[getCensusSummary] failed", error)
    return {
      universe: 0,
      reviewed: 0,
      classifiedReviewed: 0,
      undeterminedReviewed: 0,
      unreviewed: 0,
      coveragePct: 0,
      tierCounts: {},
      peBacked: 0,
      buckets: summarizeBuckets([], 0),
      multiLocationReviewed: 0,
      dsoPeReviewed: 0,
      dsoPeWholeFloorPct: 0,
      legacyCorporateLocations: 0,
      legacyCorporatePct: 0,
      liveDataAvailable: false,
    }
  }
}
