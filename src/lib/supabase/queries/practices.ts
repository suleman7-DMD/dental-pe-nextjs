import { SupabaseClient } from "@supabase/supabase-js";
import type { Practice, PracticeStats } from "../types";
import {
  INDEPENDENT_CLASSIFICATIONS,
  DSO_NATIONAL_TAXONOMY_LEAKS,
  DSO_REGIONAL_STRONG_SIGNAL_FILTER,
} from "../../constants/entity-classifications";

export async function getPracticesByZips(
  supabase: SupabaseClient,
  zips: string[],
  page = 1,
  pageSize = 100
): Promise<{ data: Practice[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from("practices")
    .select("*", { count: "exact" })
    .in("zip", zips)
    .order("practice_name", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return { data: (data as Practice[]) ?? [], count: count ?? 0 };
}

export async function searchPractices(
  supabase: SupabaseClient,
  query: string,
  zips?: string[],
  limit = 100
): Promise<Practice[]> {
  let q = supabase.from("practices").select("*");

  if (zips && zips.length > 0) {
    q = q.in("zip", zips);
  }

  q = q.or(
    `practice_name.ilike.%${query}%,doing_business_as.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%,affiliated_dso.ilike.%${query}%`
  );

  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return (data as Practice[]) ?? [];
}

export async function getPracticeDetail(
  supabase: SupabaseClient,
  npi: string
): Promise<Practice | null> {
  const { data, error } = await supabase
    .from("practices")
    .select("*")
    .eq("npi", npi)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as Practice;
}

export async function getPracticeCountsByStatus(
  supabase: SupabaseClient,
  zips?: string[]
): Promise<Record<string, number>> {
  // Use entity_classification as PRIMARY field for ownership counts,
  // with ownership_status as fallback only when entity_classification is null.

  // Build all queries first, then run in parallel
  let indepQ = supabase.from("practices").select("npi", { count: "exact", head: true })
    .in("entity_classification", [...INDEPENDENT_CLASSIFICATIONS]);
  let indepFallbackQ = supabase.from("practices").select("npi", { count: "exact", head: true })
    .is("entity_classification", null).in("ownership_status", ["independent", "likely_independent"]);
  let corpQ = supabase.from("practices").select("npi", { count: "exact", head: true })
    .in("entity_classification", ["dso_regional", "dso_national"]);
  let corpFallbackQ = supabase.from("practices").select("npi", { count: "exact", head: true })
    .is("entity_classification", null).in("ownership_status", ["dso_affiliated", "pe_backed"]);
  let specQ = supabase.from("practices").select("npi", { count: "exact", head: true })
    .eq("entity_classification", "specialist");
  let ncQ = supabase.from("practices").select("npi", { count: "exact", head: true })
    .eq("entity_classification", "non_clinical");
  let totalQ = supabase.from("practices").select("npi", { count: "exact", head: true });

  // Apply ZIP filter if provided
  if (zips && zips.length > 0) {
    indepQ = indepQ.in("zip", zips);
    indepFallbackQ = indepFallbackQ.in("zip", zips);
    corpQ = corpQ.in("zip", zips);
    corpFallbackQ = corpFallbackQ.in("zip", zips);
    specQ = specQ.in("zip", zips);
    ncQ = ncQ.in("zip", zips);
    totalQ = totalQ.in("zip", zips);
  }

  // Run ALL count queries in parallel
  const [
    { count: indepByEC },
    { count: indepByOS },
    { count: corpByEC },
    { count: corpByOS },
    { count: specCount },
    { count: ncCount },
    { count: total },
  ] = await Promise.all([indepQ, indepFallbackQ, corpQ, corpFallbackQ, specQ, ncQ, totalQ]);

  const counts: Record<string, number> = {};
  counts["independent"] = (indepByEC ?? 0) + (indepByOS ?? 0);
  counts["dso_affiliated"] = (corpByEC ?? 0) + (corpByOS ?? 0);
  if (specCount && specCount > 0) counts["specialist"] = specCount;
  if (ncCount && ncCount > 0) counts["non_clinical"] = ncCount;

  const known = (counts["independent"] ?? 0) + (counts["dso_affiliated"] ?? 0)
    + (counts["specialist"] ?? 0) + (counts["non_clinical"] ?? 0);
  counts["unknown"] = Math.max(0, (total ?? 0) - known);

  return counts;
}

export async function getPracticesWithCoords(
  supabase: SupabaseClient,
  zips: string[]
): Promise<Practice[]> {
  // Paginate to handle large ZIP sets (could exceed 1000 row default limit)
  const allPractices: Practice[] = [];
  const pageSize = 1000;
  const chunkSize = 100;

  for (let i = 0; i < zips.length; i += chunkSize) {
    const zipChunk = zips.slice(i, i + chunkSize);
    let page = 0;

    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("practices")
        .select("npi, practice_name, doing_business_as, city, state, zip, phone, website, entity_classification, ownership_status, affiliated_dso, buyability_score, classification_confidence, year_established, employee_count, estimated_revenue, latitude, longitude, num_providers, taxonomy_code, data_axle_import_date")
        .in("zip", zipChunk)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .range(from, to);

      if (error) throw error;
      const batch = (data as Practice[]) ?? [];
      allPractices.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }
  }

  return allPractices;
}

/**
 * Safe count query helper: awaits a Supabase count query and returns the count,
 * logging any errors. Returns null on failure instead of silently swallowing errors.
 */
async function safeCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: PromiseLike<{ count: number | null; error: any }>,
  label: string
): Promise<number | null> {
  const result = await query;
  if (result.error) {
    console.error(`[getPracticeStats] ${label} error:`, result.error.message ?? result.error, `(code: ${result.error.code ?? 'unknown'})`);
    return null;
  }
  return result.count;
}

/**
 * Aggregate practice statistics for watched ZIPs with tiered consolidation.
 * Returns full PracticeStats including high-confidence corporate count,
 * all-signals corporate count, independent count, unknown count, and enriched count.
 * Also returns global total for the "Practices Tracked" KPI.
 *
 * Queries are batched sequentially to avoid overwhelming Supabase Postgres
 * with too many concurrent count queries (which causes statement_timeout 57014).
 */
export async function getPracticeStats(
  supabase: SupabaseClient
): Promise<PracticeStats> {
  // ── Phase 1: Get watched ZIPs first (lightweight query) ────────────────
  const { data: watchedZipRows, error: zipError } = await supabase
    .from("watched_zips")
    .select("zip_code");

  if (zipError) {
    console.error("[getPracticeStats] watched_zips error:", zipError.message);
  }

  const watchedZips = (watchedZipRows ?? []).map(
    (z: { zip_code: string }) => z.zip_code
  );

  if (watchedZips.length === 0) {
    // Still try to get global total for display
    const { count: globalTotal } = await supabase
      .from("practices")
      .select("npi", { count: "exact", head: true });
    return {
      totalPractices: globalTotal ?? 0,
      total: 0,
      corporate: 0,
      corporateHighConf: 0,
      independent: 0,
      unknown: 0,
      enriched: 0,
      consolidatedPct: "--",
      independentPct: "--",
    };
  }

  // ── Phase 2: Batch A — fast queries with narrow filters (3 concurrent) ─
  const [allDsoRegional, allDsoNational, dsoSpecialists] = await Promise.all([
    safeCount(
      supabase
        .from("practices")
        .select("npi", { count: "exact", head: true })
        .in("zip", watchedZips)
        .eq("entity_classification", "dso_regional"),
      "allDsoRegional"
    ),
    safeCount(
      supabase
        .from("practices")
        .select("npi", { count: "exact", head: true })
        .in("zip", watchedZips)
        .eq("entity_classification", "dso_national"),
      "allDsoNational"
    ),
    safeCount(
      supabase
        .from("practices")
        .select("npi", { count: "exact", head: true })
        .in("zip", watchedZips)
        .eq("entity_classification", "specialist")
        .in("ownership_status", ["dso_affiliated", "pe_backed"]),
      "dsoSpecialists"
    ),
  ]);

  // ── Phase 3: Batch B — more narrow filters (2 concurrent) ──────────────
  const [dsoNationalReal, dsoRegionalStrong] = await Promise.all([
    safeCount(
      supabase
        .from("practices")
        .select("npi", { count: "exact", head: true })
        .in("zip", watchedZips)
        .eq("entity_classification", "dso_national")
        .not(
          "affiliated_dso",
          "in",
          `(${DSO_NATIONAL_TAXONOMY_LEAKS.join(",")})`
        ),
      "dsoNationalReal"
    ),
    safeCount(
      supabase
        .from("practices")
        .select("npi", { count: "exact", head: true })
        .in("zip", watchedZips)
        .eq("entity_classification", "dso_regional")
        .or(DSO_REGIONAL_STRONG_SIGNAL_FILTER),
      "dsoRegionalStrong"
    ),
  ]);

  // ── Phase 4: Expensive broad scans — run sequentially to avoid ─────────
  // Supabase Postgres statement_timeout (error 57014). These queries scan
  // large portions of the 400k-row practices table and timeout when
  // competing for DB resources with concurrent queries.
  const watchedTotal = await safeCount(
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .in("zip", watchedZips),
    "watchedTotal"
  );

  const independentByEC = await safeCount(
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .in("zip", watchedZips)
      .in("entity_classification", [...INDEPENDENT_CLASSIFICATIONS]),
    "independentByEC"
  );

  const globalTotal = await safeCount(
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true }),
    "globalTotal"
  );

  // Enriched count (scans 400k rows on data_axle_import_date) — run last
  const enrichedCount = await safeCount(
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("data_axle_import_date", "is", null),
    "enrichedCount"
  );

  // Location-deduped GP clinic count: sum zip_scores.total_gp_locations
  // across watched ZIPs. This is the honest "how many clinics" denominator —
  // collapses NPI-1 + NPI-2 + suite-variant rows at the same physical
  // building down to one. Pre-computed by merge_and_score.compute_saturation_metrics().
  // Falls back to null if zip_scores hasn't been populated.
  let totalGpLocations: number | null = null;
  try {
    const { data: zipRows, error: zsErr } = await supabase
      .from("zip_scores")
      .select("total_gp_locations")
      .in("zip_code", watchedZips);
    if (zsErr) {
      console.warn("[getPracticeStats] zip_scores fetch failed:", zsErr.message);
    } else if (zipRows) {
      totalGpLocations = zipRows.reduce(
        (sum: number, r: { total_gp_locations: number | null }) =>
          sum + (r.total_gp_locations ?? 0),
        0
      );
    }
  } catch (e) {
    console.warn("[getPracticeStats] zip_scores fetch threw:", e);
  }

  // ── Compute derived stats ──────────────────────────────────────────────
  const t = watchedTotal ?? 0;
  const corporate = (allDsoRegional ?? 0) + (allDsoNational ?? 0);
  const highConfCorporate =
    (dsoNationalReal ?? 0) + (dsoRegionalStrong ?? 0) + (dsoSpecialists ?? 0);
  const independent = independentByEC ?? 0;
  // "Unknown" = total - corporate - independent.
  // This remainder includes specialist, non_clinical, and any truly unclassified.
  const unknownCount = Math.max(0, t - corporate - independent);

  // If globalTotal timed out, fall back to watchedTotal so KPI isn't 0
  const effectiveGlobalTotal = globalTotal ?? t;

  // Log if any critical counts failed
  if (watchedTotal === null || independentByEC === null || globalTotal === null) {
    console.warn(
      `[getPracticeStats] Some counts returned null (possible statement_timeout). ` +
      `globalTotal=${globalTotal}, watchedTotal=${watchedTotal}, independent=${independentByEC}`
    );
  }

  return {
    totalPractices: effectiveGlobalTotal,
    total: t,
    totalGpLocations: totalGpLocations ?? undefined,
    corporate,
    corporateHighConf: highConfCorporate,
    independent,
    unknown: unknownCount,
    enriched: enrichedCount ?? 0,
    consolidatedPct:
      t > 0 ? ((highConfCorporate / t) * 100).toFixed(1) + "%" : "0.0%",
    independentPct:
      t > 0 ? ((independent / t) * 100).toFixed(1) + "%" : "0.0%",
  };
}

/**
 * Count practices at retirement risk: independent, established before 1995.
 * Scoped to watched ZIPs only. Uses entity_classification (7 independent types).
 * Ground truth: 226.
 */
export async function getRetirementRiskCount(
  supabase: SupabaseClient
): Promise<number> {
  // First get watched ZIP codes
  const { data: watchedZipRows } = await supabase
    .from("watched_zips")
    .select("zip_code");
  const watchedZips = (watchedZipRows ?? []).map(
    (z: { zip_code: string }) => z.zip_code
  );

  if (watchedZips.length === 0) return 0;

  const { count, error } = await supabase
    .from("practices")
    .select("npi", { count: "exact", head: true })
    .in("zip", watchedZips)
    .in("entity_classification", [...INDEPENDENT_CLASSIFICATIONS])
    .not("year_established", "is", null)
    .lt("year_established", 1995);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Count practices that are high-value acquisition targets in watched ZIPs.
 * Criteria: buyability_score >= 50.
 * Ground truth: 34.
 */
export async function getAcquisitionTargetCount(
  supabase: SupabaseClient
): Promise<number> {
  // First get watched ZIP codes
  const { data: watchedZipRows } = await supabase
    .from("watched_zips")
    .select("zip_code");
  const watchedZips = (watchedZipRows ?? []).map(
    (z: { zip_code: string }) => z.zip_code
  );

  if (watchedZips.length === 0) return 0;

  const { count, error } = await supabase
    .from("practices")
    .select("npi", { count: "exact", head: true })
    .in("zip", watchedZips)
    .not("buyability_score", "is", null)
    .gte("buyability_score", 50);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch practices that have a buyability score, ordered by score descending.
 */
export async function getBuyabilityPractices(
  supabase: SupabaseClient,
  limit = 500
): Promise<Practice[]> {
  const buyabilityFields = [
    'npi', 'practice_name', 'doing_business_as', 'city', 'state', 'zip',
    'phone', 'website', 'entity_classification', 'ownership_status',
    'affiliated_dso', 'buyability_score', 'classification_confidence',
    'classification_reasoning', 'year_established', 'employee_count',
    'estimated_revenue', 'num_providers', 'taxonomy_code',
  ].join(',')

  const { data, error } = await supabase
    .from("practices")
    .select(buyabilityFields)
    .not("buyability_score", "is", null)
    .order("buyability_score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as Practice[]) ?? [];
}
