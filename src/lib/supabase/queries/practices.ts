import { SupabaseClient } from "@supabase/supabase-js";
import type { Practice } from "../types";

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
  // Use count queries per status to avoid fetching all rows
  // (practices table has 400k+ rows, exceeds Supabase default 1000 limit)
  const statuses = ["independent", "likely_independent", "dso_affiliated", "pe_backed", "unknown"];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    let q = supabase
      .from("practices")
      .select("*", { count: "exact", head: true })
      .eq("ownership_status", status);

    if (zips && zips.length > 0) {
      q = q.in("zip", zips);
    }

    const { count } = await q;
    if (count && count > 0) counts[status] = count;
  }

  // Count null ownership_status as unknown
  let nullQ = supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .is("ownership_status", null);

  if (zips && zips.length > 0) {
    nullQ = nullQ.in("zip", zips);
  }

  const { count: nullCount } = await nullQ;
  if (nullCount && nullCount > 0) {
    counts["unknown"] = (counts["unknown"] ?? 0) + nullCount;
  }

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
        .select("*")
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
 * Aggregate practice statistics for watched ZIPs: total, consolidated %, independent %.
 * Scoped to watched ZIPs where classification data is meaningful.
 * Also returns global total for the "Practices Tracked" KPI.
 */
export async function getPracticeStats(
  supabase: SupabaseClient
): Promise<{
  totalPractices: number;
  consolidatedPct: string;
  independentPct: string;
}> {
  // Global total (for "Practices Tracked" headline)
  const { count: globalTotal } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true });

  // Get watched ZIP codes for scoped stats
  const { data: watchedZipRows } = await supabase
    .from("watched_zips")
    .select("zip_code");
  const watchedZips = (watchedZipRows ?? []).map((z: { zip_code: string }) => z.zip_code);

  if (watchedZips.length === 0) {
    return {
      totalPractices: globalTotal ?? 0,
      consolidatedPct: "--",
      independentPct: "--",
    };
  }

  // Total practices in watched ZIPs
  const { count: total } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips);

  // High-confidence corporate: dso_national with real brands (exclude taxonomy leaks)
  const taxonomyLeaks = ["General Dentistry", "Oral Surgery", "Orthodontics", "Periodontics", "Endodontics", "Pediatric Dentistry", "Prosthodontics", "Dental Hygiene"];
  const { count: dsoNationalReal } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .eq("entity_classification", "dso_national")
    .not("affiliated_dso", "in", `(${taxonomyLeaks.join(",")})`);

  // High-confidence corporate: dso_regional with strong signals (EIN, brand, parent, franchise)
  const { count: dsoRegionalStrong } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .eq("entity_classification", "dso_regional")
    .or("classification_reasoning.ilike.%EIN=%,classification_reasoning.ilike.%generic brand%,classification_reasoning.ilike.%parent_company%,classification_reasoning.ilike.%franchise%,classification_reasoning.ilike.%branch%");

  // DSO-owned specialists
  const { count: dsoSpecialists } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .eq("entity_classification", "specialist")
    .in("ownership_status", ["dso_affiliated", "pe_backed"]);

  // Independent by entity_classification
  const { count: independentByEC } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .in("entity_classification", [
      "solo_established", "solo_new", "solo_inactive", "solo_high_volume",
      "family_practice", "small_group", "large_group"
    ]);

  const t = total ?? 0;
  const highConfCorporate = (dsoNationalReal ?? 0) + (dsoRegionalStrong ?? 0) + (dsoSpecialists ?? 0);
  const independent = independentByEC ?? 0;

  return {
    totalPractices: globalTotal ?? 0,
    consolidatedPct: t > 0 ? ((highConfCorporate / t) * 100).toFixed(1) + "%" : "0.0%",
    independentPct: t > 0 ? ((independent / t) * 100).toFixed(1) + "%" : "0.0%",
  };
}

/**
 * Count practices at retirement risk (independent, established 30+ years ago).
 * Scoped to watched ZIPs. Uses entity_classification with ownership_status fallback.
 */
export async function getRetirementRiskCount(
  supabase: SupabaseClient
): Promise<number> {
  // Independent practices established 30+ years ago.
  // year_established only exists on Data Axle enriched practices,
  // which all have entity_classification set — no fallback needed.
  const { count, error } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("entity_classification", [
      "solo_established", "solo_new", "solo_inactive", "solo_high_volume",
      "family_practice", "small_group", "large_group"
    ])
    .lt("year_established", new Date().getFullYear() - 30);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Count practices that are high-value acquisition targets
 * (high buyability score, independent ownership).
 */
export async function getAcquisitionTargetCount(
  supabase: SupabaseClient
): Promise<number> {
  // Independent practices with buyability_score >= 50.
  // buyability_score only exists on Data Axle enriched practices,
  // which all have entity_classification set — no fallback needed.
  const { count, error } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .gte("buyability_score", 50)
    .in("entity_classification", [
      "solo_established", "solo_new", "solo_inactive", "solo_high_volume",
      "family_practice", "small_group", "large_group"
    ]);

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
  const { data, error } = await supabase
    .from("practices")
    .select("*")
    .not("buyability_score", "is", null)
    .order("buyability_score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Practice[]) ?? [];
}
