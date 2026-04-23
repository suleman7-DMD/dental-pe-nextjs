import { SupabaseClient } from "@supabase/supabase-js";
import type { DataFreshness } from "../types";

/* ─── Types expected by system page components ───────────────────────── */

export interface SourceCoverage {
  source: string;
  records: number;
  dateRange: string;
  lastUpdated: string;
  daysSinceUpdate: number | null;
}

/* Per-source deal freshness — read by Deal Source Freshness panel.
 * `null` for any timestamp means the source has never been ingested. The UI
 * must distinguish null ("No data") from 0 ("updated today"); coercing null
 * to 0 causes StatusDot to render green "Current" which is wrong. */
export interface DealSourceFreshness {
  count: number;
  firstDealDate: string | null;
  lastDealDate: string | null;
  lastIngestDate: string | null;
  daysSinceLastDeal: number | null;
  daysSinceLastIngest: number | null;
}

export type DealSource = "GDN" | "PESP" | "PitchBook" | "Manual";

export interface CompletenessMetric {
  label: string;
  count: number;
  total: number;
  pct: number;
}

export async function getDataFreshness(
  supabase: SupabaseClient
): Promise<DataFreshness> {
  const [
    { count: totalPractices },
    { count: enrichedCount },
    { count: totalDeals },
    { count: totalWatchedZips },
    { data: recentDeal },
    { data: recentPractice },
  ] = await Promise.all([
    // Total practices
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true }),

    // Enriched (Data Axle) count
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("data_axle_import_date", "is", null),

    // Total deals
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true }),

    // Total watched ZIPs
    supabase
      .from("watched_zips")
      .select("zip_code", { count: "exact", head: true }),

    // Most recent deal date
    supabase
      .from("deals")
      .select("deal_date")
      .order("deal_date", { ascending: false })
      .limit(1)
      .single(),

    // Most recent practice update
    supabase
      .from("practices")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    total_practices: totalPractices ?? 0,
    enriched_count: enrichedCount ?? 0,
    total_deals: totalDeals ?? 0,
    total_watched_zips: totalWatchedZips ?? 0,
    last_deal_date: recentDeal?.deal_date ?? null,
    last_practice_update: recentPractice?.updated_at ?? null,
  };
}

export interface SourceCoverageDetail {
  count: number;
  lastUpdated: string;
}

export async function getSourceCoverage(
  supabase: SupabaseClient
): Promise<Record<string, SourceCoverageDetail>> {
  // Count practices per data_source + get freshness timestamps.
  // Also query dso_locations (ADSO) and ada_hpi_benchmarks for their own freshness.
  const [
    { count: total },
    { count: nppesCount },
    { count: dataAxleCount },
    { count: manualCount },
    { count: nullCount },
    { count: adsoCount },
    { count: adaCount },
    { data: nppesLatest },
    { data: dataAxleLatest },
    { data: manualLatest },
    { data: adsoLatest },
    { data: adaLatest },
  ] = await Promise.all([
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true }),
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .eq("data_source", "nppes"),
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .eq("data_source", "data_axle"),
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .eq("data_source", "manual"),
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .is("data_source", null),
    supabase
      .from("dso_locations")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("ada_hpi_benchmarks")
      .select("*", { count: "exact", head: true }),
    // Get most recent updated_at per source for freshness
    supabase
      .from("practices")
      .select("updated_at")
      .eq("data_source", "nppes")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("practices")
      .select("updated_at")
      .eq("data_source", "data_axle")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("practices")
      .select("updated_at")
      .eq("data_source", "manual")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
    // DSO Locations freshness: most recent scraped_at from dso_locations table
    supabase
      .from("dso_locations")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single(),
    // ADA Benchmarks freshness: most recent created_at from ada_hpi_benchmarks table
    // (updated_at is NULL for all 918 rows — only created_at is populated by ada_hpi_importer)
    supabase
      .from("ada_hpi_benchmarks")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const result: Record<string, SourceCoverageDetail> = {};
  if ((nppesCount ?? 0) > 0)
    result["nppes"] = { count: nppesCount ?? 0, lastUpdated: nppesLatest?.updated_at ?? "" };
  if ((dataAxleCount ?? 0) > 0)
    result["data_axle"] = { count: dataAxleCount ?? 0, lastUpdated: dataAxleLatest?.updated_at ?? "" };
  if ((manualCount ?? 0) > 0)
    result["manual"] = { count: manualCount ?? 0, lastUpdated: manualLatest?.updated_at ?? "" };

  // Expose ADSO Scraper and ADA HPI freshness under the keys the FreshnessIndicators component looks for
  result["ADSO Scraper"] = { count: adsoCount ?? 0, lastUpdated: adsoLatest?.scraped_at ?? "" };
  result["ADA HPI"] = { count: adaCount ?? 0, lastUpdated: adaLatest?.created_at ?? "" };

  const knownTotal = (nppesCount ?? 0) + (dataAxleCount ?? 0) + (manualCount ?? 0) + (nullCount ?? 0);
  const remaining = (total ?? 0) - knownTotal;
  if (remaining > 0) result["other"] = { count: remaining, lastUpdated: "" };
  if ((nullCount ?? 0) > 0) result["unknown"] = { count: nullCount ?? 0, lastUpdated: "" };

  return result;
}

/**
 * Per-source deal freshness.
 *
 * Returns count, last deal_date, last ingest timestamp, and derived
 * `daysSince*` for each of GDN / PESP / PitchBook / Manual. `lastDealDate`
 * tells you whether the SOURCE is dry (no new deals flowing upstream).
 * `lastIngestDate` tells you whether the SCRAPER has run recently. A stale
 * ingest timestamp with a fresh `lastDealDate` would be unusual; both stale
 * means "nothing has happened here in a while" — the distinction is the
 * whole point of this panel.
 *
 * `daysSince*` stays `null` when the underlying timestamp is null. The UI
 * renders that as a gray "No data" dot, NOT green "Current" (status-dot.tsx
 * handles null directly — the old bug was coercing to 0 at the page layer).
 */
export async function getDealSourceFreshness(
  supabase: SupabaseClient
): Promise<Record<DealSource, DealSourceFreshness>> {
  const sourceKeys: Array<{ ui: DealSource; db: string }> = [
    { ui: "GDN", db: "gdn" },
    { ui: "PESP", db: "pesp" },
    { ui: "PitchBook", db: "pitchbook" },
    { ui: "Manual", db: "manual" },
  ];

  const now = Date.now();
  const daysBetween = (iso: string | null): number | null =>
    iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null;

  const perSource = await Promise.all(
    sourceKeys.map(async ({ ui, db }) => {
      const [
        { count },
        { data: earliestDeal },
        { data: latestDeal },
        { data: latestIngest },
      ] = await Promise.all([
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("source", db),
        supabase
          .from("deals")
          .select("deal_date")
          .eq("source", db)
          .order("deal_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("deals")
          .select("deal_date")
          .eq("source", db)
          .order("deal_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("deals")
          .select("updated_at")
          .eq("source", db)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const firstDealDate = earliestDeal?.deal_date ?? null;
      const lastDealDate = latestDeal?.deal_date ?? null;
      const lastIngestDate = latestIngest?.updated_at ?? null;

      return [
        ui,
        {
          count: count ?? 0,
          firstDealDate,
          lastDealDate,
          lastIngestDate,
          daysSinceLastDeal: daysBetween(lastDealDate),
          daysSinceLastIngest: daysBetween(lastIngestDate),
        } satisfies DealSourceFreshness,
      ] as const;
    })
  );

  return Object.fromEntries(perSource) as Record<DealSource, DealSourceFreshness>;
}

/**
 * Compute data completeness metrics for the system health page.
 * Returns an array of field-level fill rates.
 */
export async function getCompletenessMetrics(
  supabase: SupabaseClient
): Promise<CompletenessMetric[]> {
  // Run all count queries in parallel
  const [
    { count: total },
    { count: classifiedByEC },
    { count: classifiedByOS },
    { count: withCoords },
    { count: withPhone },
    { count: withEntity },
    { count: enriched },
  ] = await Promise.all([
    // Total practices count
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true }),

    // Ownership classified by entity_classification (primary)
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("entity_classification", "is", null),

    // Ownership classified by ownership_status fallback (entity_classification is null)
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .is("entity_classification", null)
      .neq("ownership_status", "unknown"),

    // Have coordinates
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("latitude", "is", null)
      .not("longitude", "is", null),

    // Have phone
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("phone", "is", null),

    // Entity classification set
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("entity_classification", "is", null),

    // Data Axle enriched
    supabase
      .from("practices")
      .select("npi", { count: "exact", head: true })
      .not("data_axle_import_date", "is", null),
  ]);

  const t = total ?? 0;
  if (t === 0) return [];

  const classified = (classifiedByEC ?? 0) + (classifiedByOS ?? 0);

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
