import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchPracticeLocations,
  practiceLocationToLaunchpadRecord,
} from "@/lib/supabase/queries/practice-locations"
import {
  getLaunchpadScopeOption,
  resolveLaunchpadZipCodes,
  type LaunchpadScope,
} from "@/lib/launchpad/scope"
import { rankTargets, summarizeRankedTargets } from "@/lib/launchpad/ranking"
import type {
  LaunchpadBundle,
  LaunchpadDataHealth,
  LaunchpadIntelAudit,
  LaunchpadPracticeIntelRecord,
  LaunchpadPracticeRecord,
  LaunchpadRecentDealRecord,
  LaunchpadSummary,
  LaunchpadTrack,
  LaunchpadZipScoreRecord,
} from "@/lib/launchpad/signals"

export const DEFAULT_RANK_LIMIT = 60
const SOURCE_BACKED_QUALITIES = new Set(["verified", "high", "partial"])

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isAbortLike(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function timeoutSignal(ms: number): AbortSignal {
  if ("timeout" in AbortSignal && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

function parseStringArray(value: unknown): string[] | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const arr = value.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    return arr.length > 0 ? arr : null
  }
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      const arr = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      return arr.length > 0 ? arr : null
    }
  } catch {
    // Fall through to delimiter parsing.
  }
  const arr = trimmed
    .split(/[\n;|]/)
    .map((x) => x.trim())
    .filter(Boolean)
  return arr.length > 0 ? arr : null
}

function parseUrlArray(value: unknown): string[] {
  const arr = parseStringArray(value) ?? []
  return arr
    .map((url) => url.trim())
    .filter((url) => url.startsWith("http") && url !== "no_results_found")
}

function parseRawJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== "string") return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function toBooleanNumber(value: unknown): number | boolean | null {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value
  return null
}

function normalizeIntelRow(row: Record<string, unknown>): LaunchpadPracticeIntelRecord {
  return {
    npi: String(row.npi ?? ""),
    research_date: toStringOrNull(row.research_date),
    website_url: toStringOrNull(row.website_url),
    website_era: toStringOrNull(row.website_era),
    website_analysis: toStringOrNull(row.website_analysis),
    services_listed: parseStringArray(row.services_listed),
    services_high_rev: parseStringArray(row.services_high_rev),
    services_note: toStringOrNull(row.services_note),
    technology_listed: parseStringArray(row.technology_listed),
    hiring_active: toBooleanNumber(row.hiring_active),
    hiring_positions: parseStringArray(row.hiring_positions),
    hiring_source: toStringOrNull(row.hiring_source),
    succession_intent_detected: toStringOrNull(row.succession_intent_detected),
    owner_career_stage: toStringOrNull(row.owner_career_stage),
    provider_count_web: toNumber(row.provider_count_web),
    provider_notes: toStringOrNull(row.provider_notes),
    accepts_medicaid: toBooleanNumber(row.accepts_medicaid),
    ppo_heavy: toBooleanNumber(row.ppo_heavy),
    insurance_note: toStringOrNull(row.insurance_note),
    technology_level: toStringOrNull(row.technology_level),
    google_review_count: toNumber(row.google_review_count),
    google_rating: toNumber(row.google_rating),
    google_velocity: toStringOrNull(row.google_velocity),
    google_sentiment: toStringOrNull(row.google_sentiment),
    healthgrades_rating: toNumber(row.healthgrades_rating),
    healthgrades_reviews: toNumber(row.healthgrades_reviews),
    acquisition_found: toBooleanNumber(row.acquisition_found),
    acquisition_details: toStringOrNull(row.acquisition_details),
    red_flags: parseStringArray(row.red_flags),
    green_flags: parseStringArray(row.green_flags),
    acquisition_readiness: toStringOrNull(row.acquisition_readiness),
    confidence: toStringOrNull(row.confidence),
    overall_assessment: toStringOrNull(row.overall_assessment),
    sources: parseStringArray(row.sources),
    verification_searches: toNumber(row.verification_searches),
    verification_quality: toStringOrNull(row.verification_quality),
    verification_urls: parseUrlArray(row.verification_urls),
    raw_json: parseRawJson(row.raw_json),
  }
}

function hasSourceBackedIntel(intel: LaunchpadPracticeIntelRecord): boolean {
  const quality = intel.verification_quality?.toLowerCase() ?? ""
  return (
    SOURCE_BACKED_QUALITIES.has(quality) &&
    (intel.verification_searches ?? 0) >= 2 &&
    (intel.verification_urls?.length ?? 0) > 0
  )
}

function auditForIntel(intel: LaunchpadPracticeIntelRecord): LaunchpadIntelAudit {
  const quality = intel.verification_quality?.toLowerCase() ?? null
  const searches = intel.verification_searches ?? 0
  const urlCount = intel.verification_urls?.length ?? 0
  const sourceBacked = hasSourceBackedIntel(intel)
  let reason = "Accepted: source-backed practice_intel row."
  if (!sourceBacked) {
    if (!quality) reason = "Rejected: missing verification_quality."
    else if (!SOURCE_BACKED_QUALITIES.has(quality)) {
      reason = `Rejected: verification_quality=${quality}.`
    } else if (searches < 2) {
      reason = `Rejected: only ${searches} web search${searches === 1 ? "" : "es"} reported.`
    } else if (urlCount === 0) {
      reason = "Rejected: no verification URLs stored."
    }
  }
  return {
    npi: intel.npi,
    status: sourceBacked ? "source_backed" : "rejected",
    research_date: intel.research_date,
    verification_quality: intel.verification_quality,
    verification_searches: intel.verification_searches,
    verification_urls: intel.verification_urls ?? [],
    reason,
  }
}

function qualityScore(intel: LaunchpadPracticeIntelRecord): number {
  const quality = intel.verification_quality?.toLowerCase()
  if (quality === "verified" || quality === "high") return 3
  if (quality === "partial") return 2
  if (quality === "insufficient") return 1
  return 0
}

function chooseBestIntel(
  rows: LaunchpadPracticeIntelRecord[]
): LaunchpadPracticeIntelRecord | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const sourceBackedDelta = Number(hasSourceBackedIntel(b)) - Number(hasSourceBackedIntel(a))
    if (sourceBackedDelta !== 0) return sourceBackedDelta
    const qualityDelta = qualityScore(b) - qualityScore(a)
    if (qualityDelta !== 0) return qualityDelta
    return (b.research_date ?? "").localeCompare(a.research_date ?? "")
  })[0]
}

function npisForPractice(practice: LaunchpadPracticeRecord): string[] {
  return Array.from(
    new Set([practice.npi, ...(practice.provider_npis ?? [])].filter((npi) => npi && npi.length > 0))
  )
}

async function withTimeout<T>(
  label: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T | null> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort()
          resolve(null)
        }, ms)
      }),
    ])
  } catch (error) {
    if (!isAbortLike(error)) {
      console.warn(`[launchpad] ${label} unavailable:`, error)
    }
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Paginate through address-deduped practice locations in the given ZIP codes. */
async function fetchAllPracticesByZips(
  supabase: SupabaseClient,
  zipCodes: string[]
): Promise<LaunchpadPracticeRecord[]> {
  const rows = await fetchPracticeLocations(supabase, {
    zips: zipCodes,
    orderBy: "buyability_score",
    ascending: false,
  })
  return rows.map(practiceLocationToLaunchpadRecord)
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
  const uniqueNpis = Array.from(new Set(npis.filter(Boolean)))

  const batches: string[][] = []
  for (let i = 0; i < uniqueNpis.length; i += BATCH_SIZE) {
    batches.push(uniqueNpis.slice(i, i + BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase
        .from("practice_intel")
        .select(
          [
            "npi",
            "research_date",
            "website_url",
            "website_era",
            "website_analysis",
            "services_listed",
            "services_high_rev",
            "services_note",
            "technology_listed",
            "technology_level",
            "provider_count_web",
            "provider_notes",
            "owner_career_stage",
            "google_review_count",
            "google_rating",
            "google_velocity",
            "google_sentiment",
            "hiring_active",
            "hiring_positions",
            "hiring_source",
            "succession_intent_detected",
            "acquisition_found",
            "acquisition_details",
            "healthgrades_rating",
            "healthgrades_reviews",
            "accepts_medicaid",
            "ppo_heavy",
            "insurance_note",
            "red_flags",
            "green_flags",
            "overall_assessment",
            "acquisition_readiness",
            "confidence",
            "sources",
            "verification_searches",
            "verification_quality",
            "verification_urls",
            "raw_json",
          ].join(",")
        )
        .in("npi", batch)
        .abortSignal(timeoutSignal(6000))

      if (error) throw error
      return ((data as unknown as Record<string, unknown>[]) ?? []).map(normalizeIntelRow)
    })
  )

  return results.flat()
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
        .abortSignal(timeoutSignal(1500))

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
  const practiceNpis = Array.from(new Set(practices.flatMap(npisForPractice)))

  // 3. Dependent fetches — practice_intel + recent acquisition NPIs (parallel)
  const [intelRowsResult, acquisitionResult] = await Promise.all([
    withTimeout("practice_intel", 8000, () => fetchPracticeIntel(supabase, practiceNpis)),
    fetchRecentAcquisitionNpis(supabase, practiceNpis, cutoffIso),
  ])
  const intelRows = intelRowsResult ?? []
  if (intelRowsResult == null) warnings.push("Practice intel timed out; ranking used structural signals only.")

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
  const rawIntelByNpi = new Map<string, LaunchpadPracticeIntelRecord>()
  for (const intel of intelRows) {
    rawIntelByNpi.set(intel.npi, intel)
  }

  const intelByNpi = new Map<string, LaunchpadPracticeIntelRecord>()
  const intelAuditByNpi = new Map<string, LaunchpadIntelAudit>()
  for (const practice of practices) {
    const candidateRows = npisForPractice(practice)
      .map((npi) => rawIntelByNpi.get(npi) ?? null)
      .filter((row): row is LaunchpadPracticeIntelRecord => row !== null)
    const best = chooseBestIntel(candidateRows)
    if (!best) continue
    const audit = auditForIntel(best)
    intelAuditByNpi.set(practice.npi, audit)
    if (audit.status === "source_backed") {
      intelByNpi.set(practice.npi, best)
    }
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
    intelAuditByNpi,
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
  const rejectedIntelCount = Array.from(intelAuditByNpi.values()).filter(
    (audit) => audit.status === "rejected"
  ).length

  // Location-deduped GP count — sums total_gp_locations across scope ZIPs.
  // Matches the Home + Job Market Phase A denominator (commit `732894f`).
  // Pre-2026-04-26 the Launchpad headline KPI was the raw NPI count
  // (~11,894 in All Chicagoland), inflating ~2.7× over the actual GP-clinic
  // total (5,265) and disagreeing with every other surface.
  const gpLocationSum = zipScores.reduce(
    (sum, zs) => sum + (zs.total_gp_locations ?? 0),
    0
  )
  const totalGpLocations = gpLocationSum > 0 ? gpLocationSum : null

  if (intelPct < 10 && totalPractices > 0) {
    warnings.push(`Source-backed intel coverage is thin (${intelPct}%)`)
  }

  if (rejectedIntelCount > 0) {
    warnings.push(
      `${rejectedIntelCount} raw practice_intel row${rejectedIntelCount === 1 ? "" : "s"} rejected by verification gate`
    )
  }

  const corporateSharePct = median(zipScores.map((z) => z.corporate_share_pct))

  const summary: LaunchpadSummary = {
    scopeId: scope,
    scopeLabel: scopeOption.label,
    scopeZipCount: zipCodes.length,
    generatedAt,
    totalPracticesInScope: totalPractices,
    totalGpLocations,
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
    intelFetched: withIntel,
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
