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
 * Aggregate practice statistics: total, consolidated %, independent %.
 */
export async function getPracticeStats(
  supabase: SupabaseClient
): Promise<{
  totalPractices: number;
  consolidatedPct: string;
  independentPct: string;
}> {
  const { count: total } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true });

  const { count: independent } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("ownership_status", ["independent", "likely_independent"]);

  const { count: dso } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .eq("ownership_status", "dso_affiliated");

  const { count: pe } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .eq("ownership_status", "pe_backed");

  const t = total ?? 0;
  const consolidated = (dso ?? 0) + (pe ?? 0);
  const ind = independent ?? 0;

  return {
    totalPractices: t,
    consolidatedPct: t > 0 ? ((consolidated / t) * 100).toFixed(1) : "0.0",
    independentPct: t > 0 ? ((ind / t) * 100).toFixed(1) : "0.0",
  };
}

/**
 * Count practices at retirement risk (solo, established 20+ years ago).
 */
export async function getRetirementRiskCount(
  supabase: SupabaseClient
): Promise<number> {
  const cutoffYear = new Date().getFullYear() - 20;

  const { count, error } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .in("entity_classification", ["solo_established", "solo_inactive"])
    .lte("year_established", cutoffYear);

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
  const { count, error } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .gte("buyability_score", 60)
    .in("ownership_status", ["independent", "likely_independent", "unknown"]);

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
