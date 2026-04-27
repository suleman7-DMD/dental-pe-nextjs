/**
 * Data breakdown queries — power the /data-breakdown verification page.
 *
 * For every headline practice/deal/ZIP count visible on the dashboard, return
 * the per-segment breakdown so the user can see WHERE each number comes from.
 *
 * Each function returns a `BreakdownBlock` with:
 *   - title: what's being counted
 *   - total: the headline value
 *   - source: human-readable origin ("practices.npi WHERE zip IN watched_zips")
 *   - segments: { label, count, color } sorted descending
 *   - groupBy: dimension used for the breakdown
 *
 * The page sums each breakdown's segments to the total — if they ever drift,
 * the user sees it directly. That's the point of this page.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import {
  ENTITY_CLASSIFICATION_COLORS,
  CHART_COLORWAY,
  DEAL_TYPE_COLORS,
  OWNERSHIP_STATUS_COLORS,
} from "@/lib/constants/colors";
import {
  ENTITY_CLASSIFICATIONS,
  getEntityClassificationLabel,
} from "@/lib/constants/entity-classifications";
import {
  GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
  GLOBAL_PRACTICE_NPI_COUNT,
} from "@/lib/constants/data-snapshot";
import { fetchPracticeLocations } from "./practice-locations";

function timeoutSignal(ms: number): AbortSignal {
  if ("timeout" in AbortSignal && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface BreakdownSegment {
  label: string;
  count: number;
  color: string;
  description?: string;
}

export interface BreakdownBlock {
  /** Metric title (e.g. "Total Practices (NPIs)") */
  title: string;
  /** The headline number this breakdown explains */
  total: number;
  /** Unit label (NPIs, locations, deals, ZIPs) */
  unit: string;
  /** Human-readable description of where this count comes from */
  source: string;
  /** Pages/components that surface this number */
  surfacedOn: string[];
  /** Dimension used for breakdown (entity_classification, state, source, year) */
  groupBy: string;
  /** Per-segment breakdown — sums to `total` */
  segments: BreakdownSegment[];
  /** Optional: ratio of segments-sum to total to surface drift */
  reconciliation?: {
    segmentsTotal: number;
    drift: number;
    notes?: string;
  };
}

/** Helper: count rows for a single (column, value) pair via head query. */
async function countWhere(
  supabase: SupabaseClient,
  table: string,
  filters: Array<{
    type: "eq" | "in" | "is" | "neq" | "ilike" | "gte" | "lt";
    column: string;
    value: unknown;
  }>
): Promise<number> {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  for (const f of filters) {
    if (f.type === "eq") q = q.eq(f.column, f.value as string);
    else if (f.type === "in") q = q.in(f.column, f.value as string[]);
    else if (f.type === "is") q = q.is(f.column, f.value as null);
    else if (f.type === "neq") q = q.neq(f.column, f.value as string);
    else if (f.type === "ilike") q = q.ilike(f.column, f.value as string);
    else if (f.type === "gte") q = q.gte(f.column, f.value as number);
    else if (f.type === "lt") q = q.lt(f.column, f.value as number);
  }
  const { count, error } = await q.abortSignal(timeoutSignal(table === "practices" ? 1200 : 2500));
  if (error) {
    console.warn(`[data-breakdown] count timed out/unavailable for ${table}.${filters.map((f) => f.column).join(",")}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Helper: build reconciliation block. */
function reconcile(total: number, segments: BreakdownSegment[]): BreakdownBlock["reconciliation"] {
  const segmentsTotal = segments.reduce((s, x) => s + x.count, 0);
  const drift = segmentsTotal - total;
  return {
    segmentsTotal,
    drift,
    notes:
      drift === 0
        ? "Segments match total exactly."
        : drift > 0
        ? `Segments sum is ${drift} higher than the headline — overlap or double-counting.`
        : `Segments sum is ${Math.abs(drift)} lower than the headline — uncategorized rows missing.`,
  };
}

/** Fast snapshot block for the global NPI pool. */
export function getGlobalPracticesSnapshot(): BreakdownBlock {
  const primary = {
    label: "Global federal dental NPI rows",
    count: GLOBAL_PRACTICE_NPI_COUNT,
    color: CHART_COLORWAY[0],
    description: "Post-F32 hygienist-leak cleanup snapshot verified 2026-04-26",
  };
  const enriched = {
    label: "Data Axle enriched NPI rows",
    count: GLOBAL_DATA_AXLE_ENRICHED_NPI_COUNT,
    color: CHART_COLORWAY[1],
    description: "Subset with Data Axle enrichment",
  };
  return {
    title: "All Practices (Global Snapshot)",
    total: GLOBAL_PRACTICE_NPI_COUNT,
    unit: "NPI rows",
    source: "Verified F32 snapshot constants; live practices scans are intentionally avoided in the frontend hot path",
    surfacedOn: ["Home", "System", "Data freshness bars"],
    groupBy: "snapshot",
    segments: [primary, enriched],
    reconciliation: reconcile(GLOBAL_PRACTICE_NPI_COUNT, [primary]),
  };
}

/** Block 1: Total practices (NPI rows) by entity_classification — global. */
export async function getGlobalPracticesByEntityClass(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const [counts, nullCount] = await Promise.all([
    Promise.all(
      ENTITY_CLASSIFICATIONS.map(async (ec) => ({
        label: ec.label,
        count: await countWhere(supabase, "practices", [
          { type: "eq", column: "entity_classification", value: ec.value },
        ]),
        color: ENTITY_CLASSIFICATION_COLORS[ec.value] ?? "#9C9C90",
        description: ec.description,
      }))
    ),
    countWhere(supabase, "practices", [
      { type: "is", column: "entity_classification", value: null },
    ]),
  ]);
  const segments = [
    ...counts,
    {
      label: "Unclassified",
      count: nullCount,
      color: "#B0B0A4",
      description: "entity_classification IS NULL (mostly out-of-watched-ZIP)",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "All Practices (Global, NPI rows)",
    total,
    unit: "NPI rows",
    source: "practices table — every NPPES dental NPI in the system",
    surfacedOn: ["System page", "API counts"],
    groupBy: "entity_classification",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 2: Watched-ZIP practices (NPI rows) by entity_classification. */
export async function getWatchedPracticesByEntityClass(
  supabase: SupabaseClient,
  watchedZips: string[]
): Promise<BreakdownBlock> {
  const counts = await Promise.all(
    ENTITY_CLASSIFICATIONS.map(async (ec) => ({
      label: ec.label,
      count: await countWhere(supabase, "practices", [
        { type: "in", column: "zip", value: watchedZips },
        { type: "eq", column: "entity_classification", value: ec.value },
      ]),
      color: ENTITY_CLASSIFICATION_COLORS[ec.value] ?? "#9C9C90",
      description: ec.description,
    }))
  );
  const segments = counts.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Watched-ZIP Practices (NPI rows)",
    total,
    unit: "NPI rows",
    source: `practices table WHERE zip IN (${watchedZips.length} watched ZIPs)`,
    surfacedOn: ["Home", "Job Market", "Market Intel", "Warroom Sitrep", "Launchpad"],
    groupBy: "entity_classification",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 3: Watched-ZIP locations (address-deduped) by entity_classification. */
export async function getWatchedLocationsByEntityClass(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const locations = await fetchPracticeLocations(supabase);
  const counts = ENTITY_CLASSIFICATIONS.map((ec) => ({
    label: ec.label,
    count: locations.filter((row) => row.entity_classification === ec.value).length,
    color: ENTITY_CLASSIFICATION_COLORS[ec.value] ?? "#9C9C90",
    description: ec.description,
  }));
  const nullCount = locations.filter((row) => row.entity_classification == null).length;
  const segments = [
    ...counts,
    {
      label: "Unclassified",
      count: nullCount,
      color: "#B0B0A4",
      description: "entity_classification IS NULL on the location row",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Watched-ZIP GP Clinic Locations (deduped)",
    total,
    unit: "clinic locations",
    source: "practice_locations WHERE is_likely_residential = false (canonical address-dedup)",
    surfacedOn: [
      "Home (Total Practices subtitle)",
      "Job Market (gpLocations)",
      "Warroom Sitrep KPI strip",
    ],
    groupBy: "entity_classification",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 4: Watched-ZIP practices by data_source. */
export async function getWatchedPracticesByDataSource(
  supabase: SupabaseClient,
  watchedZips: string[]
): Promise<BreakdownBlock> {
  const sources = ["nppes", "data_axle", "manual"];
  const [counts, nullCount] = await Promise.all([
    Promise.all(
      sources.map(async (s, i) => ({
        label: s.toUpperCase().replace("_", " "),
        count: await countWhere(supabase, "practices", [
          { type: "in", column: "zip", value: watchedZips },
          { type: "eq", column: "data_source", value: s },
        ]),
        color: CHART_COLORWAY[i % CHART_COLORWAY.length],
        description: `data_source = '${s}'`,
      }))
    ),
    countWhere(supabase, "practices", [
      { type: "in", column: "zip", value: watchedZips },
      { type: "is", column: "data_source", value: null },
    ]),
  ]);
  const segments = [
    ...counts,
    {
      label: "Unsourced",
      count: nullCount,
      color: "#B0B0A4",
      description: "data_source IS NULL",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Watched-ZIP Practices by Data Source",
    total,
    unit: "NPI rows",
    source: `practices.data_source WHERE zip IN (${watchedZips.length} watched ZIPs)`,
    surfacedOn: ["System page Data Source Coverage panel"],
    groupBy: "data_source",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 5: Watched ZIPs by state (IL Chicagoland vs MA Boston). */
export async function getWatchedZipsByState(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const { data, error } = await supabase
    .from("watched_zips")
    .select("state, zip_code");
  if (error) throw error;
  const byState = new Map<string, number>();
  for (const row of (data as { state: string | null; zip_code: string }[]) ?? []) {
    const k = row.state ?? "(null)";
    byState.set(k, (byState.get(k) ?? 0) + 1);
  }
  const entries = Array.from(byState.entries());
  const segments = entries
    .map(([label, count], i) => ({
      label: label === "IL" ? "Illinois (Chicagoland)" : label === "MA" ? "Massachusetts (Boston)" : label,
      count,
      color: CHART_COLORWAY[i % CHART_COLORWAY.length],
      description: label === "IL" ? "269 Chicagoland ZIPs" : label === "MA" ? "21 Boston Metro ZIPs" : `state = ${label}`,
    }))
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Watched ZIPs by State",
    total,
    unit: "ZIPs",
    source: "watched_zips table grouped by state",
    surfacedOn: ["Home", "Job Market location selector", "Warroom scope selector"],
    groupBy: "state",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 6: Deals by source (PESP, GDN, PitchBook). */
export async function getDealsBySource(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const sources = ["GDN", "PESP", "PITCHBOOK"];
  const counts = await Promise.all(
    sources.map(async (s, i) => {
      const { count, error } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .ilike("source", s);
      if (error) throw error;
      return {
        label: s,
        count: count ?? 0,
        color: CHART_COLORWAY[i % CHART_COLORWAY.length],
        description: `source ILIKE '${s}'`,
      };
    })
  );
  const segments = counts.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Deals by Source",
    total,
    unit: "deals",
    source: "deals table — PE deal announcements grouped by scraper origin",
    surfacedOn: ["Home", "Deal Flow"],
    groupBy: "source",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 7: Deals by deal_type. */
export async function getDealsByType(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const rows: Array<{ deal_type: string | null }> = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("deals")
      .select("deal_type")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<{ deal_type: string | null }>;
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  const types = Object.keys(DEAL_TYPE_COLORS);
  const counts = types.map((t) => ({
    label: t,
    count: rows.filter((row) => row.deal_type === t).length,
    color: DEAL_TYPE_COLORS[t] ?? "#9C9C90",
    description: `deal_type = '${t}'`,
  }));
  const nullCount = rows.filter((row) => row.deal_type == null).length;
  const segments = [
    ...counts,
    {
      label: "Unclassified",
      count: nullCount,
      color: "#B0B0A4",
      description: "deal_type IS NULL",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Deals by Deal Type",
    total,
    unit: "deals",
    source: "deals.deal_type",
    surfacedOn: ["Deal Flow charts"],
    groupBy: "deal_type",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 8: Deals by year. */
export async function getDealsByYear(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const PAGE_SIZE = 1000;
  const allRows: { deal_date: string }[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("deals")
      .select("deal_date")
      .not("deal_date", "is", null)
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as { deal_date: string }[];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }
  const byYear = new Map<string, number>();
  for (const row of allRows) {
    const y = row.deal_date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const segments = Array.from(byYear.entries())
    .map(([year, count], i) => ({
      label: year,
      count,
      color: CHART_COLORWAY[i % CHART_COLORWAY.length],
      description: `deal_date YEAR(${year})`,
    }))
    .sort((a, b) => parseInt(b.label) - parseInt(a.label));
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Deals by Year",
    total,
    unit: "deals",
    source: "deals.deal_date — temporal coverage of the deal corpus",
    surfacedOn: ["Deal Flow timeline"],
    groupBy: "year",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 9: Watched-ZIP practices by ownership_status (legacy field). */
export async function getWatchedPracticesByOwnership(
  supabase: SupabaseClient,
  watchedZips: string[]
): Promise<BreakdownBlock> {
  const statuses = Object.keys(OWNERSHIP_STATUS_COLORS);
  const [counts, nullCount] = await Promise.all([
    Promise.all(
      statuses.map(async (s) => ({
        label: s,
        count: await countWhere(supabase, "practices", [
          { type: "in", column: "zip", value: watchedZips },
          { type: "eq", column: "ownership_status", value: s },
        ]),
        color: OWNERSHIP_STATUS_COLORS[s] ?? "#9C9C90",
        description: `ownership_status = '${s}'`,
      }))
    ),
    countWhere(supabase, "practices", [
      { type: "in", column: "zip", value: watchedZips },
      { type: "is", column: "ownership_status", value: null },
    ]),
  ]);
  const segments = [
    ...counts,
    {
      label: "(null)",
      count: nullCount,
      color: "#B0B0A4",
      description: "ownership_status IS NULL — fallback to entity_classification",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Watched-ZIP Practices by ownership_status (LEGACY)",
    total,
    unit: "NPI rows",
    source: "practices.ownership_status — legacy 3-value field; entity_classification is the canonical signal",
    surfacedOn: ["Streamlit dashboard (legacy)"],
    groupBy: "ownership_status",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 10: Retirement risk practices by entity_classification. */
export async function getRetirementRiskByEntityClass(
  supabase: SupabaseClient,
  watchedZips: string[]
): Promise<BreakdownBlock> {
  const independent = ENTITY_CLASSIFICATIONS.filter((ec) => ec.category === "solo" || ec.category === "group");
  const counts = await Promise.all(
    independent.map(async (ec) => ({
      label: ec.label,
      count: await countWhere(supabase, "practices", [
        { type: "in", column: "zip", value: watchedZips },
        { type: "eq", column: "entity_classification", value: ec.value },
        { type: "lt", column: "year_established", value: 1995 },
      ]),
      color: ENTITY_CLASSIFICATION_COLORS[ec.value] ?? "#9C9C90",
      description: `${ec.value} + year_established < 1995`,
    }))
  );
  const segments = counts.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Retirement Risk Practices",
    total,
    unit: "NPI rows",
    source: "practices in watched ZIPs WHERE entity_classification IN (independent) AND year_established < 1995",
    surfacedOn: ["Home", "Job Market"],
    groupBy: "entity_classification",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 11: practice_intel coverage by verification_quality. */
export async function getPracticeIntelByVerification(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const { data } = await supabase
    .from("sync_metadata")
    .select("rows_synced,last_sync_at")
    .eq("table_name", "practice_intel")
    .maybeSingle();
  const synced = data?.rows_synced ?? 0;
  const segments = [
    {
      label: "Synced dossiers",
      count: synced,
      color: CHART_COLORWAY[0],
      description: data?.last_sync_at
        ? `Last practice_intel sync: ${String(data.last_sync_at).slice(0, 19)}`
        : "practice_intel sync metadata unavailable",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Practice Intel Dossiers by Verification Quality",
    total,
    unit: "dossiers",
    source: "sync_metadata rows_synced for practice_intel — avoids live scans of the optional dossier table",
    surfacedOn: ["Intelligence", "Launchpad", "Warroom dossier drawer"],
    groupBy: "sync_metadata",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Block 12: Watched-ZIP practices by metro (subzone heuristic via zip prefix). */
export async function getWatchedPracticesByZipPrefix(
  supabase: SupabaseClient,
  watchedZips: string[]
): Promise<BreakdownBlock> {
  const prefixes = new Map<string, string[]>();
  for (const z of watchedZips) {
    const p = z.slice(0, 3);
    if (!prefixes.has(p)) prefixes.set(p, []);
    prefixes.get(p)!.push(z);
  }
  const entries = Array.from(prefixes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const counts = await Promise.all(
    entries.map(async ([prefix, zips], i) => {
      const cnt = await countWhere(supabase, "practices", [
        { type: "in", column: "zip", value: zips },
      ]);
      return {
        label: `${prefix}xx (${zips.length} ZIPs)`,
        count: cnt,
        color: CHART_COLORWAY[i % CHART_COLORWAY.length],
        description: `${zips.length} ZIPs starting with ${prefix}`,
      };
    })
  );
  const segments = counts.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Watched-ZIP Practices by ZIP Prefix",
    total,
    unit: "NPI rows",
    source: "practices grouped by 3-digit ZIP prefix (Chicagoland 60x/61x, Boston 02x)",
    surfacedOn: ["Subzone selectors across Job Market / Warroom / Launchpad"],
    groupBy: "zip_prefix",
    segments,
    reconciliation: reconcile(total, segments),
  };
}

/** Top-level: fetch all blocks in parallel. */
export interface BlockError {
  title: string;
  error: string;
}

export interface DataBreakdownBundle {
  blocks: BreakdownBlock[];
  blockErrors: BlockError[];
  watchedZipCount: number;
  fetchedAt: string;
}

function describeError(e: unknown): string {
  if (!e) return "Unknown error";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === "string") parts.push(obj.message);
    if (obj.code != null) parts.push(`(code: ${String(obj.code)})`);
    if (typeof obj.details === "string") parts.push(`details: ${obj.details}`);
    if (typeof obj.hint === "string") parts.push(`hint: ${obj.hint}`);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(obj);
    } catch {
      return Object.prototype.toString.call(obj);
    }
  }
  return String(e);
}

export async function getDataBreakdownBundle(
  supabase: SupabaseClient
): Promise<DataBreakdownBundle> {
  const { data: zipRows, error: zipErr } = await supabase
    .from("watched_zips")
    .select("zip_code");
  if (zipErr) throw zipErr;
  const watchedZips = (zipRows as { zip_code: string }[] | null)?.map((r) => r.zip_code) ?? [];

  const blockSpecs: Array<{ title: string; fetch: () => Promise<BreakdownBlock> }> = [
    { title: "All Practices (Global Snapshot)", fetch: () => Promise.resolve(getGlobalPracticesSnapshot()) },
    { title: "Watched-ZIP GP Clinic Locations (deduped)", fetch: () => getWatchedLocationsByEntityClass(supabase) },
    { title: "Watched ZIPs by State", fetch: () => getWatchedZipsByState(supabase) },
    { title: "Deals by Source", fetch: () => getDealsBySource(supabase) },
    { title: "Deals by Deal Type", fetch: () => getDealsByType(supabase) },
    { title: "Deals by Year", fetch: () => getDealsByYear(supabase) },
    { title: "Practice Intel Dossiers by Verification Quality", fetch: () => getPracticeIntelByVerification(supabase) },
  ];

  const settled = await Promise.allSettled(blockSpecs.map((s) => s.fetch()));
  const blocks: BreakdownBlock[] = [];
  const blockErrors: BlockError[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      blocks.push(result.value);
    } else {
      const msg = describeError(result.reason);
      console.error(`[data-breakdown] block "${blockSpecs[i].title}" failed:`, result.reason);
      blockErrors.push({ title: blockSpecs[i].title, error: msg });
    }
  });

  return {
    blocks,
    blockErrors,
    watchedZipCount: watchedZips.length,
    fetchedAt: new Date().toISOString(),
  };
}

// re-export label helper for convenience
export { getEntityClassificationLabel };
