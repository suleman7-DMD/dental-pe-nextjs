import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getLaunchpadScopeOption,
  resolveLaunchpadZipCodes,
  type LaunchpadScope,
} from "@/lib/launchpad/scope"
import { rankTargets, summarizeRankedTargets } from "@/lib/launchpad/ranking"
import type {
  LaunchpadBundle,
  LaunchpadDataHealth,
  LaunchpadPracticeIntelRecord,
  LaunchpadPracticeRecord,
  LaunchpadRecentDealRecord,
  LaunchpadSummary,
  LaunchpadTrack,
  LaunchpadZipScoreRecord,
} from "@/lib/launchpad/signals"

export const DEFAULT_RANK_LIMIT = 60

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Paginate through all practices in the given ZIP codes, 1000 rows per page. */
async function fetchAllPracticesByZips(
  supabase: SupabaseClient,
  zipCodes: string[]
): Promise<LaunchpadPracticeRecord[]> {
  const all: LaunchpadPracticeRecord[] = []
  const PAGE_SIZE = 1000
  const CHUNK_SIZE = 100

  for (let i = 0; i < zipCodes.length; i += CHUNK_SIZE) {
    const chunk = zipCodes.slice(i, i + CHUNK_SIZE)
    let offset = 0

    while (true) {
      const { data, error } = await supabase
        .from("practices")
        .select(
          [
            "id",
            "npi",
            "practice_name",
            "doing_business_as",
            "address",
            "city",
            "state",
            "zip",
            "phone",
            "website",
            "entity_type",
            "entity_classification",
            "ownership_status",
            "affiliated_dso",
            "affiliated_pe_sponsor",
            "buyability_score",
            "classification_confidence",
            "classification_reasoning",
            "latitude",
            "longitude",
            "year_established",
            "employee_count",
            "estimated_revenue",
            "num_providers",
            "taxonomy_code",
            "parent_company",
            "ein",
            "franchise_name",
            "data_source",
            "data_axle_import_date",
            "updated_at",
          ].join(",")
        )
        .in("zip", chunk)
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error
      const batch = (data as unknown as LaunchpadPracticeRecord[]) ?? []
      all.push(...batch)
      if (batch.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  return all
}

type WatchedZipRow = {
  zip_code: string
  median_household_income: number | null
  population: number | null
  city: string | null
  state: string | null
  metro_area: string | null
}

/** Fetch watched_zip rows for scope ZIPs. */
async function fetchWatchedZips(
  supabase: SupabaseClient,
  zipCodes: string[]
): Promise<WatchedZipRow[]> {
  const PAGE_SIZE = 1000
  const all: WatchedZipRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("watched_zips")
      .select("zip_code,median_household_income,population,city,state,metro_area")
      .in("zip_code", zipCodes)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error
    const batch = (data as unknown as WatchedZipRow[]) ?? []
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

/** Fetch zip_scores rows for scope ZIPs, then dedupe by keeping the latest score_date per zip_code. */
async function fetchZipScores(
  supabase: SupabaseClient,
  zipCodes: string[]
): Promise<LaunchpadZipScoreRecord[]> {
  const PAGE_SIZE = 1000
  const raw: LaunchpadZipScoreRecord[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("zip_scores")
      .select(
        [
          "zip_code",
          "city",
          "state",
          "metro_area",
          "total_practices",
          "total_gp_locations",
          "total_specialist_locations",
          "dld_gp_per_10k",
          "people_per_gp_door",
          "buyable_practice_ratio",
          "corporate_share_pct",
          "corporate_highconf_count",
          "market_type",
          "metrics_confidence",
          "opportunity_score",
          "score_date",
        ].join(",")
      )
      .in("zip_code", zipCodes)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error
    const batch = (data as unknown as LaunchpadZipScoreRecord[]) ?? []
    raw.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  // Dedupe: keep the row with the latest score_date per zip_code
  const byZip = new Map<string, LaunchpadZipScoreRecord>()
  for (const row of raw) {
    const existing = byZip.get(row.zip_code)
    if (!existing) {
      byZip.set(row.zip_code, row)
    } else {
      const existingDate = existing.score_date ?? ""
      const rowDate = row.score_date ?? ""
      if (rowDate > existingDate) byZip.set(row.zip_code, row)
    }
  }

  return Array.from(byZip.values())
}

/** Fetch practice_intel rows for the given NPI set in batches of 500. */
async function fetchPracticeIntel(
  supabase: SupabaseClient,
  npis: string[]
): Promise<LaunchpadPracticeIntelRecord[]> {
  if (npis.length === 0) return []
  const BATCH_SIZE = 500
  const all: LaunchpadPracticeIntelRecord[] = []

  for (let i = 0; i < npis.length; i += BATCH_SIZE) {
    const batch = npis.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from("practice_intel")
      .select(
        [
          "npi",
          "research_date",
          "hiring_active",
          "owner_career_stage",
          "accepts_medicaid",
          "ppo_heavy",
          "technology_level",
          "google_rating",
          "google_velocity",
          "red_flags",
          "green_flags",
          "acquisition_readiness",
          "confidence",
          "overall_assessment",
          "raw_json",
        ].join(",")
      )
      .in("npi", batch)

    if (error) throw error
    all.push(...((data as unknown as LaunchpadPracticeIntelRecord[]) ?? []))
  }

  return all
}

/** Fetch recent deals where target_zip is in scope ZIPs and deal_date >= 18 months ago. */
async function fetchRecentDeals(
  supabase: SupabaseClient,
  zipCodes: string[],
  cutoffDate: string
): Promise<LaunchpadRecentDealRecord[]> {
  const PAGE_SIZE = 1000
  const all: LaunchpadRecentDealRecord[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("deals")
      .select("id,deal_date,platform_company,pe_sponsor,target_name,target_city,target_zip")
      .in("target_zip", zipCodes)
      .gte("deal_date", cutoffDate)
      .order("deal_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error
    const batch = (data as unknown as LaunchpadRecentDealRecord[]) ?? []
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

/** Fetch recent acquisition NPIs from practice_changes. Returns empty Set + warning on failure. */
async function fetchRecentAcquisitionNpis(
  supabase: SupabaseClient,
  npis: string[],
  cutoffDate: string
): Promise<{ result: Set<string>; warning: string | null }> {
  if (npis.length === 0) return { result: new Set(), warning: null }

  try {
    const BATCH_SIZE = 500
    const matched = new Set<string>()

    for (let i = 0; i < npis.length; i += BATCH_SIZE) {
      const batch = npis.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase
        .from("practice_changes")
        .select("npi")
        .ilike("change_type", "%acquisition%")
        .gte("change_date", cutoffDate)
        .in("npi", batch)

      if (error) throw error
      for (const row of (data as unknown as Array<{ npi: string | null }>) ?? []) {
        if (row.npi) matched.add(String(row.npi))
      }
    }

    return { result: matched, warning: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      result: new Set(),
      warning: `Practice changes query failed: ${msg}`,
    }
  }
}

/** Compute the median of a numeric array. Returns null for empty/all-null arrays. */
function median(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && isFinite(v))
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function getLaunchpadBundle(options: {
  scope: LaunchpadScope
  track: LaunchpadTrack
  supabase: SupabaseClient
  rankLimit?: number
}): Promise<LaunchpadBundle> {
  const { scope, track, supabase } = options
  const rankLimit = options.rankLimit ?? DEFAULT_RANK_LIMIT
  const generatedAt = new Date().toISOString()
  const warnings: string[] = []

  // 18-month lookback cutoff
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - 18)
  const cutoffIso = cutoffDate.toISOString().slice(0, 10)

  // 1. Resolve ZIPs
  const zipCodes = resolveLaunchpadZipCodes(scope)
  const scopeOption = getLaunchpadScopeOption(scope)

  // 2. Parallel fetches (practices, watched_zips, zip_scores, recent_deals)
  const [rawPractices, watchedZipRows, rawZipScores, recentDeals] = await Promise.all([
    fetchAllPracticesByZips(supabase, zipCodes),
    fetchWatchedZips(supabase, zipCodes),
    fetchZipScores(supabase, zipCodes),
    fetchRecentDeals(supabase, zipCodes, cutoffIso),
  ])

  const practices: LaunchpadPracticeRecord[] = rawPractices

  // Guard: no practices
  if (practices.length === 0) {
    warnings.push("No practices in scope")
  }

  // Collect NPIs for dependent queries
  const practiceNpis = practices.map((p) => p.npi)

  // 3. Dependent fetches — practice_intel + recent acquisition NPIs (parallel)
  const [intelRows, acquisitionResult] = await Promise.all([
    fetchPracticeIntel(supabase, practiceNpis),
    fetchRecentAcquisitionNpis(supabase, practiceNpis, cutoffIso),
  ])

  if (acquisitionResult.warning) {
    warnings.push(acquisitionResult.warning)
  }

  // 4. Merge watched_zips demographic data into zip_scores
  // population + median_household_income live on watched_zips, not zip_scores.
  const watchedZipByZip = new Map<string, WatchedZipRow>()
  for (const wz of watchedZipRows) {
    watchedZipByZip.set(wz.zip_code, wz)
  }
  const zipScores: LaunchpadZipScoreRecord[] = rawZipScores.map((zs) => {
    const wz = watchedZipByZip.get(zs.zip_code)
    return {
      ...zs,
      population: wz?.population ?? null,
      median_household_income: wz?.median_household_income ?? null,
    }
  })

  // 5. Build lookup maps
  const intelByNpi = new Map<string, LaunchpadPracticeIntelRecord>()
  for (const intel of intelRows) {
    intelByNpi.set(intel.npi, intel)
  }

  const zipScoreByZip = new Map<string, LaunchpadZipScoreRecord>()
  for (const zs of zipScores) {
    zipScoreByZip.set(zs.zip_code, zs)
  }

  // 6. Rank all targets
  const fullRanking = rankTargets({
    practices,
    intelByNpi,
    zipScoreByZip,
    recentAcquisitionNpis: acquisitionResult.result,
    recentDeals,
    scope,
    track,
  })

  // 7. Trim to rankLimit (fullRanking is already sorted + numbered 1..N)
  const rankedTargets = fullRanking.slice(0, rankLimit)

  // 8. Build summary — call summarizeRankedTargets on the FULL ranking per track
  const allSummary = summarizeRankedTargets(fullRanking, "all")
  const successionSummary = summarizeRankedTargets(fullRanking, "succession")
  const highVolumeSummary = summarizeRankedTargets(fullRanking, "high_volume")
  const dsoCandidateSummary = summarizeRankedTargets(fullRanking, "dso")

  const totalPractices = practices.length
  const withIntel = intelByNpi.size
  const intelPct = totalPractices > 0 ? Math.round((withIntel / totalPractices) * 100) : 0

  if (intelPct < 10 && totalPractices > 0) {
    warnings.push(`Intel coverage is thin (${intelPct}%)`)
  }

  const corporateSharePct = median(zipScores.map((z) => z.corporate_share_pct))

  const summary: LaunchpadSummary = {
    scopeId: scope,
    scopeLabel: scopeOption.label,
    scopeZipCount: zipCodes.length,
    generatedAt,
    totalPracticesInScope: totalPractices,
    mentorRichCount: allSummary.mentorRich,
    hiringNowCount: allSummary.hiringNow,
    avoidListCount: allSummary.avoidList,
    successionCandidates: {
      bestFit: successionSummary.bestFit,
      strong: successionSummary.strong,
    },
    highVolumeCandidates: {
      bestFit: highVolumeSummary.bestFit,
      strong: highVolumeSummary.strong,
    },
    dsoCandidates: {
      bestFit: dsoCandidateSummary.bestFit,
      strong: dsoCandidateSummary.strong,
      avoidCount: dsoCandidateSummary.avoidList,
    },
    medianCompRange: {
      low: 135000,
      high: 175000,
      source: "MGMA Early-Career Dentist 2024 (IL)",
    },
    intelCoverage: {
      total: totalPractices,
      withIntel,
      pct: intelPct,
    },
    corporateSharePct,
  }

  // 9. Build dataHealth
  const dataHealth: LaunchpadDataHealth = {
    practicesFetched: practices.length,
    zipScoresFetched: zipScores.length,
    intelFetched: intelRows.length,
    recentChangesFetched: acquisitionResult.result.size,
    recentDealsFetched: recentDeals.length,
    intelCoveragePct: intelPct,
    warnings,
  }

  // 10. Return bundle
  return {
    scope: {
      id: scope,
      label: scopeOption.label,
      centerZip: scopeOption.centerZip,
      zipCount: zipCodes.length,
      zipCodes,
    },
    track,
    generatedAt,
    summary,
    rankedTargets,
    zipScores,
    recentDeals,
    dataHealth,
  }
}
