import { SupabaseClient } from "@supabase/supabase-js";
import type { Practice, PracticeStats } from "../types";
import {
  INDEPENDENT_CLASSIFICATIONS,
  DSO_NATIONAL_TAXONOMY_LEAKS,
} from "../../constants/entity-classifications";
import {
  GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
  GLOBAL_PRACTICE_NPI_COUNT,
} from "../../constants/data-snapshot";
import {
  fetchPracticeLocations,
  practiceLocationToLaunchpadRecord,
} from "./practice-locations";

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
  // Sourced from practice_locations (address-deduped, non-residential).

  // Build all queries first, then run in parallel
  let indepQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false)
    .in("entity_classification", [...INDEPENDENT_CLASSIFICATIONS]);
  let indepFallbackQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false)
    .is("entity_classification", null).in("ownership_status", ["independent", "likely_independent"]);
  let corpQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false)
    .in("entity_classification", ["dso_regional", "dso_national"]);
  let corpFallbackQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false)
    .is("entity_classification", null).in("ownership_status", ["dso_affiliated", "pe_backed"]);
  let specQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false)
    .eq("entity_classification", "specialist");
  let ncQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false)
    .eq("entity_classification", "non_clinical");
  let totalQ = supabase.from("practice_locations").select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false);

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
  const locations = await fetchPracticeLocations(supabase)
  const watchedTotal = locations.length
  const allDsoRegional = locations.filter(
    (row) => row.entity_classification === "dso_regional"
  ).length
  const allDsoNational = locations.filter(
    (row) => row.entity_classification === "dso_national"
  ).length
  const dsoSpecialists = locations.filter(
    (row) =>
      row.entity_classification === "specialist" &&
      (row.ownership_status === "dso_affiliated" ||
        row.ownership_status === "pe_backed")
  ).length
  const dsoNationalReal = locations.filter(
    (row) =>
      row.entity_classification === "dso_national" &&
      !(DSO_NATIONAL_TAXONOMY_LEAKS as readonly string[]).includes(row.affiliated_dso ?? "")
  ).length
  const dsoRegionalStrong = locations.filter(
    (row) =>
      row.entity_classification === "dso_regional" &&
      (row.classification_reasoning?.includes("EIN=") ||
        row.classification_reasoning?.toLowerCase().includes("generic brand") ||
        row.classification_reasoning?.includes("parent_company") ||
        row.classification_reasoning?.toLowerCase().includes("franchise") ||
        row.classification_reasoning?.toLowerCase().includes("branch"))
  ).length
  const independentByEC = locations.filter((row) =>
    INDEPENDENT_CLASSIFICATIONS.includes(
      row.entity_classification as (typeof INDEPENDENT_CLASSIFICATIONS)[number]
    )
  ).length
  // Live enrichedCount: count of practices with a Data Axle import date.
  // This replaces the stale hardcoded constant (was 2,992; SQLite truth is 2,983).
  // Use a head-only count query — no rows fetched, just the count header.
  // Falls back to the snapshot constant if the query fails (e.g. timeout).
  let enrichedCount: number = GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT
  try {
    const { count: dataAxleCount, error: enrichErr } = await supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("data_axle_import_date", "is", null)
    if (!enrichErr && dataAxleCount !== null) {
      enrichedCount = dataAxleCount
    } else if (enrichErr) {
      console.warn("[getPracticeStats] enrichedCount query failed:", enrichErr.message)
    }
  } catch (e) {
    console.warn("[getPracticeStats] enrichedCount query threw:", e)
  }

  // Location-deduped GP clinic count: sum zip_scores.total_gp_locations
  // across watched ZIPs. This is the honest "how many clinics" denominator —
  // collapses NPI-1 + NPI-2 + suite-variant rows at the same physical
  // building down to one. Pre-computed by merge_and_score.compute_saturation_metrics().
  // Falls back to null if zip_scores hasn't been populated.
  let totalGpLocations: number | null = null;
  try {
    const { data: zipRows, error: zsErr } = await supabase
      .from("zip_scores")
      .select("total_gp_locations");
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
  const effectiveGlobalTotal = GLOBAL_PRACTICE_NPI_COUNT;

  return {
    totalPractices: effectiveGlobalTotal,
    total: t,
    totalGpLocations: totalGpLocations ?? undefined,
    corporate,
    corporateHighConf: highConfCorporate,
    independent,
    unknown: unknownCount,
    enriched: enrichedCount,
    consolidatedPct:
      (totalGpLocations ?? t) > 0
        ? ((corporate / (totalGpLocations ?? t)) * 100).toFixed(1) + "%"
        : "0.0%",
    independentPct:
      t > 0 ? ((independent / t) * 100).toFixed(1) + "%" : "0.0%",
  };
}

/**
 * Count locations at retirement risk: independent, established before 1995.
 * Scoped to watched ZIPs only. Uses entity_classification (7 independent types).
 * Sourced from practice_locations (address-deduped) so a single physical
 * clinic with NPI-1 + NPI-2 rows at the same address counts ONCE.
 */
export async function getRetirementRiskCount(
  supabase: SupabaseClient
): Promise<number> {
  const locations = await fetchPracticeLocations(supabase)
  return locations.filter(
    (row) =>
      INDEPENDENT_CLASSIFICATIONS.includes(
        row.entity_classification as (typeof INDEPENDENT_CLASSIFICATIONS)[number]
      ) &&
      row.year_established != null &&
      row.year_established < 1995
  ).length
}

/**
 * Count locations that are high-value acquisition targets in watched ZIPs.
 * Criteria: buyability_score >= 50.
 * Sourced from practice_locations (address-deduped) so multi-NPI clinics
 * count once instead of inflating the target list.
 */
export async function getAcquisitionTargetCount(
  supabase: SupabaseClient
): Promise<number> {
  const locations = await fetchPracticeLocations(supabase)
  return locations.filter((row) => (row.buyability_score ?? 0) >= 50).length
}

/**
 * Fetch practices that have a buyability score, ordered by score descending.
 *
 * If `zips` is provided, restricts to that ZIP set (use this for Chicagoland-
 * scoped views). Without a ZIP filter, this pulls global rows — only the
 * highest-scored 500 by default — which produces an unscoped table that
 * doesn't agree with any other page on the platform.
 */
export async function getBuyabilityPractices(
  supabase: SupabaseClient,
  options: { zips?: string[]; limit?: number } = {}
): Promise<Practice[]> {
  const { zips, limit = 1000 } = options;
  const locations = await fetchPracticeLocations(supabase, {
    zips,
    orderBy: "buyability_score",
    ascending: false,
    maxRows: limit,
  })

  return locations
    .filter((row) => row.buyability_score != null)
    .map((row) => {
      const practice = practiceLocationToLaunchpadRecord(row)
      return {
        ...practice,
        address: practice.address,
        buyability_confidence: null,
        entity_type: null,
        import_batch_id: null,
        notes: null,
        created_at: null,
        data_axle_raw_name: null,
        enumeration_date: null,
        last_updated: null,
        parent_iusa: null,
        raw_record_count: null,
        taxonomy_description: null,
      } as unknown as Practice
    });
}
