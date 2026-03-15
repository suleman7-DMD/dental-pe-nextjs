import { SupabaseClient } from "@supabase/supabase-js";
import type { ZipScore } from "../types";

export type { ZipScore };

export async function getZipScores(
  supabase: SupabaseClient,
  metroArea?: string
): Promise<ZipScore[]> {
  let query = supabase.from("zip_scores").select("*");

  if (metroArea) {
    query = query.eq("metro_area", metroArea);
  }

  query = query.order("zip_code", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  // Deduplicate by zip_code (keep last / most recent)
  const byZip = new Map<string, ZipScore>();
  ((data as ZipScore[]) ?? []).forEach((row) => {
    byZip.set(row.zip_code, row);
  });

  return Array.from(byZip.values());
}

export async function getSaturationMetrics(
  supabase: SupabaseClient,
  zipCodes: string[]
): Promise<ZipScore[]> {
  const { data, error } = await supabase
    .from("zip_scores")
    .select(
      "zip_code, city, total_gp_locations, total_specialist_locations, dld_gp_per_10k, people_per_gp_door, buyable_practice_ratio, corporate_share_pct, market_type, market_type_confidence, metrics_confidence"
    )
    .in("zip_code", zipCodes);

  if (error) throw error;

  // Deduplicate
  const byZip = new Map<string, ZipScore>();
  ((data as ZipScore[]) ?? []).forEach((row) => {
    byZip.set(row.zip_code, row);
  });

  return Array.from(byZip.values());
}
