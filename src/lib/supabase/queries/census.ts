import type { SupabaseClient } from "@supabase/supabase-js"

const PAGE_SIZE = 1000
const PRIMARY_MARKET_STATE = "IL"

export interface CensusSummary {
  universe: number
  reviewed: number
  classifiedReviewed: number
  undeterminedReviewed: number
  unreviewed: number
  coveragePct: number
  tierCounts: Record<string, number>
  peBacked: number
  independentReviewed: number
  multiLocationReviewed: number
  dsoPeReviewed: number
  independentReviewedPct: number
  multiLocationReviewedPct: number
  dsoPeReviewedPct: number
  independentWholeFloorPct: number
  multiLocationWholeFloorPct: number
  dsoPeWholeFloorPct: number
  legacyCorporateLocations: number
  legacyCorporatePct: number
  liveDataAvailable: boolean
}

interface CensusLocationRow {
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
  const rows: CensusLocationRow[] = []
  let page = 0

  while (true) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("practice_locations")
      .select("ownership_tier,pe_backed")
      .eq("state", PRIMARY_MARKET_STATE)
      .not("ownership_tier", "is", null)
      .range(from, to)

    if (error) throw error

    const batch = (data as unknown as CensusLocationRow[]) ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    page += 1
  }

  return rows
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

    const universeFromZipScores = zipRows.reduce(
      (sum, row) => sum + (row.total_gp_locations ?? 0),
      0
    )
    const universe = universeFromZipScores
    const tierCounts: Record<string, number> = {}

    for (const row of tieredRows) {
      const tier = row.ownership_tier ?? "unknown"
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1
    }

    const reviewed = tieredRows.length
    const undeterminedReviewed = tierCounts.undetermined ?? 0
    const classifiedReviewed = Math.max(reviewed - undeterminedReviewed, 0)
    const peBacked = tieredRows.filter((row) => row.pe_backed === true).length
    const independentReviewed =
      (tierCounts.true_independent ?? 0) + (tierCounts.single_loc_group ?? 0)
    const multiLocationReviewed =
      (tierCounts.dentist_multi ?? 0) +
      (tierCounts.stealth_dso ?? 0) +
      (tierCounts.branded_dso ?? 0)
    const dsoPeReviewed =
      (tierCounts.stealth_dso ?? 0) + (tierCounts.branded_dso ?? 0)
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
      peBacked,
      independentReviewed,
      multiLocationReviewed,
      dsoPeReviewed,
      independentReviewedPct: pct(independentReviewed, reviewed),
      multiLocationReviewedPct: pct(multiLocationReviewed, reviewed),
      dsoPeReviewedPct: pct(dsoPeReviewed, reviewed),
      independentWholeFloorPct: pct(independentReviewed, universe),
      multiLocationWholeFloorPct: pct(multiLocationReviewed, universe),
      dsoPeWholeFloorPct: pct(dsoPeReviewed, universe),
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
      independentReviewed: 0,
      multiLocationReviewed: 0,
      dsoPeReviewed: 0,
      independentReviewedPct: 0,
      multiLocationReviewedPct: 0,
      dsoPeReviewedPct: 0,
      independentWholeFloorPct: 0,
      multiLocationWholeFloorPct: 0,
      dsoPeWholeFloorPct: 0,
      legacyCorporateLocations: 0,
      legacyCorporatePct: 0,
      liveDataAvailable: false,
    }
  }
}
