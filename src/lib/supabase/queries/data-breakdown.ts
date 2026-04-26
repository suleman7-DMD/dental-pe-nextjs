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
  const { count, error } = await q;
  if (error) throw error;
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

/** Block 1: Total practices (NPI rows) by entity_classification — global. */
export async function getGlobalPracticesByEntityClass(
  supabase: SupabaseClient
): Promise<BreakdownBlock> {
  const counts = await Promise.all(
    ENTITY_CLASSIFICATIONS.map(async (ec) => ({
      label: ec.label,
      count: await countWhere(supabase, "practices", [
        { type: "eq", column: "entity_classification", value: ec.value },
      ]),
      color: ENTITY_CLASSIFICATION_COLORS[ec.value] ?? "#9C9C90",
      description: ec.description,
    }))
  );
  const nullCount = await countWhere(supabase, "practices", [
    { type: "is", column: "entity_classification", value: null },
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
  const counts = await Promise.all(
    ENTITY_CLASSIFICATIONS.map(async (ec) => ({
      label: ec.label,
      count: await countWhere(supabase, "practice_locations", [
        { type: "eq", column: "is_likely_residential", value: false },
        { type: "eq", column: "entity_classification", value: ec.value },
      ]),
      color: ENTITY_CLASSIFICATION_COLORS[ec.value] ?? "#9C9C90",
      description: ec.description,
    }))
  );
  const nullCount = await countWhere(supabase, "practice_locations", [
    { type: "eq", column: "is_likely_residential", value: false },
    { type: "is", column: "entity_classification", value: null },
  ]);
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
  const counts = await Promise.all(
    sources.map(async (s, i) => ({
      label: s.toUpperCase().replace("_", " "),
      count: await countWhere(supabase, "practices", [
        { type: "in", column: "zip", value: watchedZips },
        { type: "eq", column: "data_source", value: s },
      ]),
      color: CHART_COLORWAY[i % CHART_COLORWAY.length],
      description: `data_source = '${s}'`,
    }))
  );
  const nullCount = await countWhere(supabase, "practices", [
    { type: "in", column: "zip", value: watchedZips },
    { type: "is", column: "data_source", value: null },
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
  const types = Object.keys(DEAL_TYPE_COLORS);
  const counts = await Promise.all(
    types.map(async (t) => ({
      label: t,
      count: await countWhere(supabase, "deals", [
        { type: "eq", column: "deal_type", value: t },
      ]),
      color: DEAL_TYPE_COLORS[t] ?? "#9C9C90",
      description: `deal_type = '${t}'`,
    }))
  );
  const nullCount = await countWhere(supabase, "deals", [
    { type: "is", column: "deal_type", value: null },
  ]);
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
  const { data, error } = await supabase
    .from("deals")
    .select("deal_date")
    .not("deal_date", "is", null);
  if (error) throw error;
  const byYear = new Map<string, number>();
  for (const row of (data as { deal_date: string }[]) ?? []) {
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
  const counts = await Promise.all(
    statuses.map(async (s) => ({
      label: s,
      count: await countWhere(supabase, "practices", [
        { type: "in", column: "zip", value: watchedZips },
        { type: "eq", column: "ownership_status", value: s },
      ]),
      color: OWNERSHIP_STATUS_COLORS[s] ?? "#9C9C90",
      description: `ownership_status = '${s}'`,
    }))
  );
  const nullCount = await countWhere(supabase, "practices", [
    { type: "in", column: "zip", value: watchedZips },
    { type: "is", column: "ownership_status", value: null },
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
  const qualities = ["verified", "partial", "insufficient", "high"];
  const counts = await Promise.all(
    qualities.map(async (q, i) => ({
      label: q,
      count: await countWhere(supabase, "practice_intel", [
        { type: "eq", column: "verification_quality", value: q },
      ]),
      color: CHART_COLORWAY[i % CHART_COLORWAY.length],
      description: `verification_quality = '${q}'`,
    }))
  );
  const nullCount = await countWhere(supabase, "practice_intel", [
    { type: "is", column: "verification_quality", value: null },
  ]);
  const segments = [
    ...counts,
    {
      label: "(null)",
      count: nullCount,
      color: "#B0B0A4",
      description: "verification_quality IS NULL (pre-bulletproofing rows)",
    },
  ]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = segments.reduce((s, x) => s + x.count, 0);
  return {
    title: "Practice Intel Dossiers by Verification Quality",
    total,
    unit: "dossiers",
    source: "practice_intel.verification_quality — anti-hallucination evidence quality (post 2026-04-25)",
    surfacedOn: ["Intelligence", "Launchpad", "Warroom dossier drawer"],
    groupBy: "verification_quality",
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
export interface DataBreakdownBundle {
  blocks: BreakdownBlock[];
  watchedZipCount: number;
  fetchedAt: string;
}

export async function getDataBreakdownBundle(
  supabase: SupabaseClient
): Promise<DataBreakdownBundle> {
  const { data: zipRows, error: zipErr } = await supabase
    .from("watched_zips")
    .select("zip_code");
  if (zipErr) throw zipErr;
  const watchedZips = (zipRows as { zip_code: string }[] | null)?.map((r) => r.zip_code) ?? [];

  const blocks = await Promise.all([
    getGlobalPracticesByEntityClass(supabase),
    getWatchedPracticesByEntityClass(supabase, watchedZips),
    getWatchedLocationsByEntityClass(supabase),
    getWatchedPracticesByDataSource(supabase, watchedZips),
    getWatchedPracticesByOwnership(supabase, watchedZips),
    getWatchedZipsByState(supabase),
    getWatchedPracticesByZipPrefix(supabase, watchedZips),
    getRetirementRiskByEntityClass(supabase, watchedZips),
    getDealsBySource(supabase),
    getDealsByType(supabase),
    getDealsByYear(supabase),
    getPracticeIntelByVerification(supabase),
  ]);

  return {
    blocks,
    watchedZipCount: watchedZips.length,
    fetchedAt: new Date().toISOString(),
  };
}

// re-export label helper for convenience
export { getEntityClassificationLabel };
