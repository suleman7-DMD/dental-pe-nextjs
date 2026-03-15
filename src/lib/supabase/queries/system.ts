import { SupabaseClient } from "@supabase/supabase-js";
import type { DataFreshness } from "../types";

/* ─── Types expected by system page components ───────────────────────── */

export interface SourceCoverage {
  source: string;
  records: number;
  dateRange: string;
  lastUpdated: string;
  daysSinceUpdate: number;
}

export interface CompletenessMetric {
  label: string;
  count: number;
  total: number;
  pct: number;
}

export async function getDataFreshness(
  supabase: SupabaseClient
): Promise<DataFreshness> {
  // Total practices
  const { count: totalPractices } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true });

  // Enriched (Data Axle) count
  const { count: enrichedCount } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .not("data_axle_import_date", "is", null);

  // Total deals
  const { count: totalDeals } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true });

  // Total watched ZIPs
  const { count: totalWatchedZips } = await supabase
    .from("watched_zips")
    .select("*", { count: "exact", head: true });

  // Most recent deal date
  const { data: recentDeal } = await supabase
    .from("deals")
    .select("deal_date")
    .order("deal_date", { ascending: false })
    .limit(1)
    .single();

  // Most recent practice update
  const { data: recentPractice } = await supabase
    .from("practices")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return {
    total_practices: totalPractices ?? 0,
    enriched_count: enrichedCount ?? 0,
    total_deals: totalDeals ?? 0,
    total_watched_zips: totalWatchedZips ?? 0,
    last_deal_date: recentDeal?.deal_date ?? null,
    last_practice_update: recentPractice?.updated_at ?? null,
  };
}

export async function getSourceCoverage(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  // Count practices per data_source using separate count queries
  // (avoids fetching 400k+ rows which exceeds Supabase's default 1000 row limit)
  const knownSources = ["nppes", "data_axle", "manual", "unknown"];
  const counts: Record<string, number> = {};

  // Get total count first
  const { count: total } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true });

  // Count each known source
  for (const src of knownSources) {
    if (src === "unknown") continue; // handle below
    const { count } = await supabase
      .from("practices")
      .select("*", { count: "exact", head: true })
      .eq("data_source", src);
    if (count && count > 0) counts[src] = count;
  }

  // Count nulls as unknown
  const { count: nullCount } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .is("data_source", null);

  // Calculate any remaining sources not in knownSources
  const knownTotal = Object.values(counts).reduce((a, b) => a + b, 0) + (nullCount ?? 0);
  const remaining = (total ?? 0) - knownTotal;
  if (remaining > 0) counts["other"] = remaining;
  if ((nullCount ?? 0) > 0) counts["unknown"] = nullCount ?? 0;

  return counts;
}

/**
 * Compute data completeness metrics for the system health page.
 * Returns an array of field-level fill rates.
 */
export async function getCompletenessMetrics(
  supabase: SupabaseClient
): Promise<CompletenessMetric[]> {
  // Total practices count
  const { count: total } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true });
  const t = total ?? 0;
  if (t === 0) return [];

  // Ownership classified — count practices with entity_classification set (primary)
  // OR ownership_status not 'unknown' (legacy fallback for practices without entity_classification)
  const { count: classifiedByEC } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .not("entity_classification", "is", null);

  const { count: classifiedByOS } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .is("entity_classification", null)
    .neq("ownership_status", "unknown");

  const classified = (classifiedByEC ?? 0) + (classifiedByOS ?? 0);

  // Have coordinates
  const { count: withCoords } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  // Have phone
  const { count: withPhone } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .not("phone", "is", null);

  // Entity classification
  const { count: withEntity } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .not("entity_classification", "is", null);

  // Data Axle enriched
  const { count: enriched } = await supabase
    .from("practices")
    .select("*", { count: "exact", head: true })
    .not("data_axle_import_date", "is", null);

  const make = (label: string, count: number): CompletenessMetric => ({
    label,
    count,
    total: t,
    pct: t > 0 ? (count / t) * 100 : 0,
  });

  return [
    make("Ownership Classified", classified),
    make("Geocoded (lat/lon)", withCoords ?? 0),
    make("Phone Number", withPhone ?? 0),
    make("Entity Classification", withEntity ?? 0),
    make("Data Axle Enriched", enriched ?? 0),
  ];
}
