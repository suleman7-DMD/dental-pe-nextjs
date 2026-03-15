import { SupabaseClient } from "@supabase/supabase-js";
import type { WatchedZip } from "../types";

export type { WatchedZip };

export async function getWatchedZips(
  supabase: SupabaseClient
): Promise<WatchedZip[]> {
  const { data, error } = await supabase
    .from("watched_zips")
    .select("*")
    .order("zip_code", { ascending: true });

  if (error) throw error;
  return (data as WatchedZip[]) ?? [];
}

export async function getMetroAreas(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("watched_zips")
    .select("metro_area")
    .not("metro_area", "is", null);

  if (error) throw error;

  const unique = new Set(
    (data ?? [])
      .map((r: { metro_area: string | null }) => r.metro_area)
      .filter(Boolean) as string[]
  );

  return Array.from(unique).sort();
}

export async function getZipsByMetro(
  supabase: SupabaseClient,
  metroArea: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("watched_zips")
    .select("zip_code")
    .eq("metro_area", metroArea);

  if (error) throw error;
  return (data ?? []).map((r: { zip_code: string }) => r.zip_code);
}

/**
 * Alias for getMetroAreas — returns distinct metro area names.
 */
export const getDistinctMetroAreas = getMetroAreas;

/**
 * Return total count of watched ZIPs.
 */
export async function getWatchedZipCount(
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("watched_zips")
    .select("zip_code", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}
