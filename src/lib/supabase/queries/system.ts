import { SupabaseClient } from "@supabase/supabase-js";
import type { DataFreshness } from "../types";
import {
  GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
  GLOBAL_PRACTICE_NPI_COUNT,
} from "../../constants/data-snapshot";
import { fetchPracticeLocations } from "./practice-locations";

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
  const locationsPromise = fetchPracticeLocations(supabase);
  const [
    locations,
    { count: totalDeals },
    { count: totalWatchedZips },
    { data: recentDeal },
  ] = await Promise.all([
    locationsPromise,

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
  ]);

  const recentPractice = locations
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null;

  return {
    total_practices: GLOBAL_PRACTICE_NPI_COUNT,
    enriched_count: GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
    total_deals: totalDeals ?? 0,
    total_watched_zips: totalWatchedZips ?? 0,
    last_deal_date: recentDeal?.deal_date ?? null,
    last_practice_update: recentPractice,
  };
}

export interface SourceCoverageDetail {
  count: number;
  lastUpdated: string;
}

export async function getSourceCoverage(
  supabase: SupabaseClient
): Promise<Record<string, SourceCoverageDetail>> {
  // Avoid first-paint scans of the `practices` table. It is the largest table
  // and can be locked/slow during sync. `practice_locations` is the frontend's
  // canonical, address-deduped surface and is fast enough to aggregate in JS.
  const locations = await fetchPracticeLocations(supabase);
  const sourceCounts = new Map<string, number>();
  const sourceLatest = new Map<string, string>();
  for (const row of locations) {
    const sources = (row.data_sources ?? "unknown").split(",").map((s) => s.trim()).filter(Boolean);
    for (const source of sources.length ? sources : ["unknown"]) {
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
      if (row.updated_at && row.updated_at > (sourceLatest.get(source) ?? "")) {
        sourceLatest.set(source, row.updated_at);
      }
    }
  }

  const [
    { count: adsoCount },
    { count: adaCount },
    { data: adsoLatest },
    { data: adaLatest },
  ] = await Promise.all([
    supabase
      .from("dso_locations")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("ada_hpi_benchmarks")
      .select("*", { count: "exact", head: true }),
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
  for (const [source, count] of sourceCounts.entries()) {
    result[source] = { count, lastUpdated: sourceLatest.get(source) ?? "" };
  }
  result["Global NPI pool"] = {
    count: GLOBAL_PRACTICE_NPI_COUNT,
    lastUpdated: sourceLatest.values().next().value ?? "",
  };
  result["Data Axle enriched NPIs"] = {
    count: GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
    lastUpdated: sourceLatest.get("data_axle") ?? "",
  };

  // Expose ADSO Scraper and ADA HPI freshness under the keys the FreshnessIndicators component looks for
  result["ADSO Scraper"] = { count: adsoCount ?? 0, lastUpdated: adsoLatest?.scraped_at ?? "" };
  result["ADA HPI"] = { count: adaCount ?? 0, lastUpdated: adaLatest?.created_at ?? "" };

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
  const locations = await fetchPracticeLocations(supabase);
  const t = locations.length;
  if (t === 0) return [];

  const classified = locations.filter(
    (row) =>
      row.entity_classification != null ||
      (row.ownership_status != null && row.ownership_status !== "unknown")
  ).length;
  const withCoords = locations.filter((row) => row.latitude != null && row.longitude != null).length;
  const withPhone = locations.filter((row) => row.phone != null).length;
  const withEntity = locations.filter((row) => row.entity_classification != null).length;
  const enriched = locations.filter((row) => row.data_axle_enriched).length;

  const make = (label: string, count: number): CompletenessMetric => ({
    label,
    count,
    total: t,
    pct: t > 0 ? (count / t) * 100 : 0,
  });

  return [
    make("Ownership Classified", classified),
    make("Geocoded (lat/lon)", withCoords),
    make("Phone Number", withPhone),
    make("Entity Classification", withEntity),
    make("Data Axle Enriched", enriched),
  ];
}
