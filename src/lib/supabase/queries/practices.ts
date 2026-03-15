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
  let q = supabase.from("practices").select("ownership_status");

  if (zips && zips.length > 0) {
    q = q.in("zip", zips);
  }

  const { data, error } = await q;
  if (error) throw error;

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { ownership_status: string | null }) => {
    const status = row.ownership_status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  });

  return counts;
}

export async function getPracticesWithCoords(
  supabase: SupabaseClient,
  zips: string[]
): Promise<Practice[]> {
  const { data, error } = await supabase
    .from("practices")
    .select("*")
    .in("zip", zips)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) throw error;
  return (data as Practice[]) ?? [];
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

  // Corporate by entity_classification (primary) — in watched ZIPs
  const { count: corporateByEC } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .in("entity_classification", ["dso_regional", "dso_national"]);

  // Corporate by ownership_status where entity_classification is missing (fallback)
  const { count: dsoByStatus } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .in("ownership_status", ["dso_affiliated", "pe_backed"])
    .is("entity_classification", null);

  // Independent by entity_classification (primary)
  const { count: independentByEC } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .in("entity_classification", [
      "solo_established", "solo_new", "solo_inactive", "solo_high_volume",
      "family_practice", "small_group", "large_group", "specialist", "non_clinical"
    ]);

  // Independent by ownership_status where entity_classification is missing (fallback)
  const { count: independentByStatus } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("zip", watchedZips)
    .in("ownership_status", ["independent", "likely_independent"])
    .is("entity_classification", null);

  const t = total ?? 0;
  const consolidated = (corporateByEC ?? 0) + (dsoByStatus ?? 0);
  const independent = (independentByEC ?? 0) + (independentByStatus ?? 0);

  return {
    totalPractices: globalTotal ?? 0,
    consolidatedPct: t > 0 ? ((consolidated / t) * 100).toFixed(1) + "%" : "0.0%",
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
  const cutoffYear = new Date().getFullYear() - 30;

  // Count globally (year_established only exists for Data Axle enriched practices,
  // which are mostly in watched ZIPs anyway)
  // Use all independent classifications
  const { count: byEC } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("entity_classification", [
      "solo_established", "solo_new", "solo_inactive", "solo_high_volume",
      "family_practice", "small_group", "large_group"
    ])
    .not("year_established", "is", null)
    .lte("year_established", cutoffYear);

  // Fallback: by ownership_status where entity_classification is missing
  const { count: byStatus } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("ownership_status", ["independent", "likely_independent"])
    .is("entity_classification", null)
    .not("year_established", "is", null)
    .lte("year_established", cutoffYear);

  return (byEC ?? 0) + (byStatus ?? 0);
}

/**
 * Count practices that are high-value acquisition targets
 * (high buyability score, independent ownership).
 */
export async function getAcquisitionTargetCount(
  supabase: SupabaseClient
): Promise<number> {
  // Count by entity_classification (primary) — independent solo/group practices with high buyability
  const { count: byEC } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .gte("buyability_score", 60)
    .in("entity_classification", [
      "solo_established", "solo_new", "solo_inactive", "solo_high_volume",
      "family_practice", "small_group", "large_group"
    ]);

  // Fallback: by ownership_status where entity_classification is missing
  const { count: byStatus } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .gte("buyability_score", 60)
    .is("entity_classification", null)
    .in("ownership_status", ["independent", "likely_independent", "unknown"]);

  return (byEC ?? 0) + (byStatus ?? 0);
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
