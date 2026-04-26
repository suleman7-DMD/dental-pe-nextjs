import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../client";
import { INDEPENDENT_CLASSIFICATIONS, classifyPractice } from "../../constants/entity-classifications";
import {
  DEFAULT_WARROOM_SCOPE,
  getGeoJsonBoundingBox,
  getScopeLabel,
  getScopePolygon,
  isLatLonInGeoJson,
  normalizeWarroomDataScope,
  resolveScopeZipCodes,
  type BoundingBox,
  type WarroomDataScope,
  type WarroomScopeInput,
} from "../../warroom/scope";
import type {
  OwnershipGroup,
  WarroomChangeRecord,
  WarroomDealRecord,
  WarroomOwnershipCounts,
  WarroomPracticeRecord,
  WarroomPracticeSignalRecord,
  WarroomSignalCounts,
  WarroomSummary,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "../../warroom/signals";

const PAGE_SIZE = 1000;
const ZIP_FILTER_CHUNK_SIZE = 200;
const NPI_FILTER_CHUNK_SIZE = 200;

const PRACTICE_SELECT = "id,npi,practice_name,doing_business_as,address,city,state,zip,phone,website,entity_classification,ownership_status,affiliated_dso,affiliated_pe_sponsor,buyability_score,classification_confidence,classification_reasoning,latitude,longitude,year_established,employee_count,estimated_revenue,num_providers,location_type,data_source,data_axle_import_date,parent_company,ein,franchise_name,iusa_number,taxonomy_code,taxonomy_description,updated_at";
const DEAL_SELECT = "id,deal_date,platform_company,pe_sponsor,target_name,target_city,target_state,target_zip,deal_type,deal_size_mm,ebitda_multiple,specialty,num_locations,source,source_url,notes,created_at,updated_at";
const ZIP_SCORE_SELECT = "id,zip_code,city,state,metro_area,total_practices,total_gp_locations,total_specialist_locations,independent_count,dso_affiliated_count,pe_backed_count,unknown_count,consolidated_count,consolidation_pct_of_total,independent_pct_of_total,pe_penetration_pct,pct_unknown,dld_gp_per_10k,dld_total_per_10k,people_per_gp_door,buyable_practice_count,buyable_practice_ratio,corporate_location_count,corporate_share_pct,corporate_highconf_count,family_practice_count,recent_changes_90d,state_deal_count_12m,opportunity_score,market_type,metrics_confidence,market_type_confidence,entity_classification_coverage_pct,data_axle_enrichment_pct,score_date";
const CHANGE_SELECT = "id,npi,change_date,field_changed,old_value,new_value,change_type,notes,created_at";

const PRACTICE_SIGNAL_SELECT = "npi,practice_id,zip_code,practice_name,city,state,entity_classification,ownership_status,buyability_score,stealth_dso_flag,stealth_dso_cluster_id,stealth_dso_cluster_size,stealth_dso_zip_count,stealth_dso_basis,stealth_dso_reasoning,phantom_inventory_flag,phantom_inventory_reasoning,revenue_default_flag,revenue_default_reasoning,family_dynasty_flag,family_dynasty_reasoning,micro_cluster_flag,micro_cluster_id,micro_cluster_size,micro_cluster_reasoning,retirement_combo_score,retirement_combo_flag,retirement_combo_reasoning,deal_catchment_24mo,deal_catchment_reasoning,last_change_90d_flag,last_change_date,last_change_type,last_change_reasoning,buyability_pctile_zip_class,buyability_pctile_class,retirement_pctile_zip_class,retirement_pctile_class,high_peer_retirement_flag,peer_percentile_reasoning,zip_ada_benchmark_gap_flag,data_limitations,created_at";

const ZIP_SIGNAL_SELECT = "zip_code,city,state,metro_area,population,total_practices,total_gp_locations,total_specialist_locations,dld_gp_per_10k,people_per_gp_door,corporate_share_pct,buyable_practice_ratio,stealth_dso_practice_count,stealth_dso_cluster_count,phantom_inventory_count,phantom_inventory_pct,revenue_default_count,family_dynasty_count,micro_cluster_count,micro_cluster_practice_count,retirement_combo_high_count,last_change_90d_count,deal_count_all_time,deal_count_24mo,deal_catchment_sum_24mo,deal_catchment_max_24mo,ada_benchmark_pct,ada_benchmark_gap_pp,ada_benchmark_gap_flag,ada_benchmark_reasoning,high_peer_retirement_count,data_limitations,created_at";

type PracticeSignalRow = WarroomPracticeSignalRecord;
type ZipSignalRow = WarroomZipSignalRecord;

interface SupabaseRowsResult<T> {
  data: T[] | null;
  error: unknown;
  count?: number | null;
}

interface SupabaseCountResult {
  count: number | null;
  error: unknown;
}

interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<SupabaseRowsResult<T>>;
}

type CountQuery = PromiseLike<SupabaseCountResult>;
interface CountFilterQuery extends CountQuery {
  in(column: string, values: readonly unknown[]): CountFilterQuery;
  eq(column: string, value: unknown): CountFilterQuery;
  is(column: string, value: null): CountFilterQuery;
  not(column: string, operator: string, value: unknown): CountFilterQuery;
  gte(column: string, value: unknown): CountFilterQuery;
  lt(column: string, value: unknown): CountFilterQuery;
  or(filterString: string): CountFilterQuery;
}

interface PaginationOptions {
  pageSize?: number;
  maxRows?: number;
  /**
   * Override `ZIP_FILTER_CHUNK_SIZE` for this call. Smaller chunks avoid
   * Supabase statement_timeout (8s on free tier) on heavy SELECT-many-cols
   * queries against `practice_signals` (~14k rows × 40 cols across 269 ZIPs).
   */
  chunkSize?: number;
}

export interface ScopedPracticesOptions extends PaginationOptions {
  requireCoordinates?: boolean;
  orderBy?: "practice_name" | "city" | "zip" | "buyability_score" | "updated_at";
  ascending?: boolean;
}

export interface ScopedDealsOptions extends PaginationOptions {
  sinceDate?: string;
}

export interface ScopedZipScoresOptions extends PaginationOptions {
  minConfidence?: "low" | "medium" | "high";
}

export interface ScopedChangesOptions extends PaginationOptions {
  sinceDate?: string;
}

type PracticeRow = Omit<WarroomPracticeRecord, "ownership_group">;
type DealRow = WarroomDealRecord;
type ZipScoreRow = WarroomZipScoreRecord;
type ChangeRow = Omit<
  WarroomChangeRecord,
  "practice_name" | "city" | "state" | "zip"
>;

interface PracticeIdentityRow {
  npi: string;
  practice_name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ScopeResolution {
  scope: WarroomDataScope;
  label: string;
  zipCodes: string[] | null;
  polygon: unknown | null;
  boundingBox: BoundingBox | null;
}

function getClient(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? getSupabaseBrowserClient();
}

function toSupabaseError(error: unknown): Error {
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error(JSON.stringify(error));
}

function chunkArray<T>(values: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function fetchAllWarroomPages<T>(
  buildQuery: () => RangeableQuery<T>,
  options: PaginationOptions = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const maxRows = options.maxRows;
  const rows: T[] = [];
  let page = 0;

  if (maxRows === 0) return [];

  while (maxRows == null || rows.length < maxRows) {
    const remaining = maxRows == null ? pageSize : maxRows - rows.length;
    const currentPageSize = Math.min(pageSize, remaining);
    const from = page * pageSize;
    const to = from + currentPageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw toSupabaseError(error);

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < currentPageSize) break;
    page += 1;
  }

  return rows;
}

async function fetchRowsByZipScope<T>(
  zipCodes: string[] | null,
  buildQuery: (zipChunk: string[] | null) => RangeableQuery<T>,
  options: PaginationOptions = {}
): Promise<T[]> {
  if (zipCodes && zipCodes.length === 0) return [];
  if (!zipCodes) return fetchAllWarroomPages(() => buildQuery(null), options);

  const rows: T[] = [];
  const effectiveChunkSize = options.chunkSize ?? ZIP_FILTER_CHUNK_SIZE;
  const chunks = chunkArray(zipCodes, effectiveChunkSize);

  for (const chunk of chunks) {
    const remainingMaxRows =
      options.maxRows == null ? undefined : Math.max(options.maxRows - rows.length, 0);
    const batch = await fetchAllWarroomPages(() => buildQuery(chunk), {
      ...options,
      maxRows: remainingMaxRows,
    });
    rows.push(...batch);
    if (options.maxRows != null && rows.length >= options.maxRows) break;
  }

  return rows;
}

async function executeCount(query: CountQuery): Promise<number> {
  const { count, error } = await query;
  if (error) throw toSupabaseError(error);
  return count ?? 0;
}

async function countRowsByZipScope(
  zipCodes: string[] | null,
  buildQuery: (zipChunk: string[] | null) => CountQuery
): Promise<number> {
  if (zipCodes && zipCodes.length === 0) return 0;
  if (!zipCodes) return executeCount(buildQuery(null));

  let count = 0;
  for (const chunk of chunkArray(zipCodes, ZIP_FILTER_CHUNK_SIZE)) {
    count += await executeCount(buildQuery(chunk));
  }
  return count;
}

function resolveScope(scope: WarroomScopeInput | undefined): ScopeResolution {
  const resolvedScope = normalizeWarroomDataScope(scope ?? DEFAULT_WARROOM_SCOPE);
  const polygon = getScopePolygon(resolvedScope);

  return {
    scope: resolvedScope,
    label: getScopeLabel(resolvedScope),
    zipCodes: resolveScopeZipCodes(resolvedScope),
    polygon,
    boundingBox: polygon ? getGeoJsonBoundingBox(polygon) : null,
  };
}

function applyPracticeBoundingBoxQuery(
  supabase: SupabaseClient,
  bounds: BoundingBox,
  options: ScopedPracticesOptions
): RangeableQuery<PracticeRow> {
  let query = supabase
    .from("practices")
    .select(PRACTICE_SELECT)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", bounds.minLat)
    .lte("latitude", bounds.maxLat)
    .gte("longitude", bounds.minLon)
    .lte("longitude", bounds.maxLon);

  query = query.order(options.orderBy ?? "practice_name", {
    ascending: options.ascending ?? true,
  });

  return query as unknown as RangeableQuery<PracticeRow>;
}

function filterPracticeRowsByPolygon<T extends { latitude: number | null; longitude: number | null }>(
  rows: T[],
  polygon: unknown | null
): T[] {
  if (!polygon) return rows;
  return rows.filter((row) => isLatLonInGeoJson(row.latitude, row.longitude, polygon));
}

function toPracticeRecord(row: PracticeRow): WarroomPracticeRecord {
  return {
    ...row,
    ownership_group: classifyPractice(
      row.entity_classification,
      row.ownership_status
    ) as OwnershipGroup,
  };
}

function compareNullableString(a: string | null, b: string | null): number {
  return (a ?? "").localeCompare(b ?? "");
}

// Collapse NPI-1 + NPI-2 + suite-variant rows at the same physical address into
// one target row, mirroring the dedup that `practice_locations` already does on
// the pipeline side. Without this, Warroom Hunt mode shows ~14k NPI rows for
// Chicagoland while the Sitrep KPIs (sourced from practice_locations) show
// ~5.5k locations — the same prospects appear 2-3× in the target list.
//
// Priority for which NPI row represents the location:
//   1. Has data_axle_import_date (enriched > unenriched)
//   2. Higher buyability_score
//   3. Higher classification_confidence
//   4. Lowest NPI as a deterministic tie-break
function locationDedupKey(row: PracticeRow): string {
  const address = (row.address ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const zip = (row.zip ?? "").trim();
  return address && zip ? `${address}|${zip}` : `npi:${row.npi}`;
}

function preferRow(a: PracticeRow, b: PracticeRow): PracticeRow {
  const aEnriched = a.data_axle_import_date != null ? 1 : 0;
  const bEnriched = b.data_axle_import_date != null ? 1 : 0;
  if (aEnriched !== bEnriched) return aEnriched > bEnriched ? a : b;

  const aScore = a.buyability_score ?? -1;
  const bScore = b.buyability_score ?? -1;
  if (aScore !== bScore) return aScore > bScore ? a : b;

  const aConf = a.classification_confidence ?? -1;
  const bConf = b.classification_confidence ?? -1;
  if (aConf !== bConf) return aConf > bConf ? a : b;

  return (a.npi ?? "") <= (b.npi ?? "") ? a : b;
}

function dedupPracticesByLocation(rows: PracticeRow[]): PracticeRow[] {
  const byKey = new Map<string, PracticeRow>();
  for (const row of rows) {
    const key = locationDedupKey(row);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferRow(existing, row) : row);
  }
  return Array.from(byKey.values());
}

function sortPracticeRows(
  rows: PracticeRow[],
  orderBy: ScopedPracticesOptions["orderBy"] = "practice_name",
  ascending = true
): PracticeRow[] {
  const sorted = [...rows].sort((a, b) => {
    const direction = ascending ? 1 : -1;
    if (orderBy === "buyability_score") {
      return ((a.buyability_score ?? -1) - (b.buyability_score ?? -1)) * direction;
    }
    return compareNullableString(
      String(a[orderBy ?? "practice_name"] ?? ""),
      String(b[orderBy ?? "practice_name"] ?? "")
    ) * direction;
  });
  return sorted;
}

export async function getScopedPractices(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: ScopedPracticesOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomPracticeRecord[]> {
  const supabase = getClient(supabaseClient);
  const { zipCodes, polygon, boundingBox } = resolveScope(scope);
  const useMaxRowsDuringFetch =
    !polygon && (!zipCodes || zipCodes.length <= ZIP_FILTER_CHUNK_SIZE);

  let rows: PracticeRow[];

  if (polygon && zipCodes?.length === 0 && boundingBox) {
    rows = await fetchAllWarroomPages(
      () => applyPracticeBoundingBoxQuery(supabase, boundingBox, options),
      { pageSize: options.pageSize, maxRows: undefined }
    );
  } else {
    rows = await fetchRowsByZipScope(
      zipCodes,
      (zipChunk) => {
        let query = supabase.from("practices").select(PRACTICE_SELECT);
        if (zipChunk) query = query.in("zip", zipChunk);
        if (options.requireCoordinates || polygon) {
          query = query.not("latitude", "is", null).not("longitude", "is", null);
        }
        query = query.order(options.orderBy ?? "practice_name", {
          ascending: options.ascending ?? true,
        });
        return query as unknown as RangeableQuery<PracticeRow>;
      },
      {
        pageSize: options.pageSize,
        maxRows: useMaxRowsDuringFetch ? options.maxRows : undefined,
      }
    );
  }

  rows = filterPracticeRowsByPolygon(rows, polygon);
  // Collapse NPI-1 + NPI-2 + suite-variant rows at the same physical address
  // BEFORE sorting and slicing — otherwise Hunt mode shows 14k NPI rows for
  // Chicagoland while the Sitrep KPIs (sourced from practice_locations) show
  // ~5.5k locations, and the same prospect appears 2-3× in the target list.
  rows = dedupPracticesByLocation(rows);
  rows = sortPracticeRows(rows, options.orderBy, options.ascending ?? true);

  if (options.maxRows != null) rows = rows.slice(0, options.maxRows);

  return rows.map(toPracticeRecord);
}

export async function getScopedDeals(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: ScopedDealsOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomDealRecord[]> {
  const supabase = getClient(supabaseClient);
  const { zipCodes } = resolveScope(scope);

  const rows = await fetchRowsByZipScope(
    zipCodes,
    (zipChunk) => {
      let query = supabase.from("deals").select(DEAL_SELECT);
      if (zipChunk) query = query.in("target_zip", zipChunk);
      if (options.sinceDate) query = query.gte("deal_date", options.sinceDate);
      query = query.order("deal_date", { ascending: false });
      return query as unknown as RangeableQuery<DealRow>;
    },
    { pageSize: options.pageSize, maxRows: zipCodes ? undefined : options.maxRows }
  );

  const sorted = [...rows].sort((a, b) =>
    (b.deal_date ?? "").localeCompare(a.deal_date ?? "")
  );

  return options.maxRows == null ? sorted : sorted.slice(0, options.maxRows);
}

export async function getScopedZipScores(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: ScopedZipScoresOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomZipScoreRecord[]> {
  const supabase = getClient(supabaseClient);
  const { zipCodes } = resolveScope(scope);

  const rows = await fetchRowsByZipScope(
    zipCodes,
    (zipChunk) => {
      let query = supabase.from("zip_scores").select(ZIP_SCORE_SELECT);
      if (zipChunk) query = query.in("zip_code", zipChunk);
      if (options.minConfidence) {
        const allowed = options.minConfidence === "high"
          ? ["high"]
          : options.minConfidence === "medium"
            ? ["medium", "high"]
            : ["low", "medium", "high"];
        query = query.in("metrics_confidence", allowed);
      }
      query = query.order("zip_code", { ascending: true });
      return query as unknown as RangeableQuery<ZipScoreRow>;
    },
    { pageSize: options.pageSize, maxRows: options.maxRows }
  );

  const byZip = new Map<string, ZipScoreRow>();
  rows.forEach((row) => byZip.set(row.zip_code, row));

  return Array.from(byZip.values()).sort((a, b) =>
    a.zip_code.localeCompare(b.zip_code)
  );
}

async function fetchPracticeIdentitiesForNpis(
  supabase: SupabaseClient,
  npis: string[]
): Promise<PracticeIdentityRow[]> {
  if (npis.length === 0) return [];

  const rows: PracticeIdentityRow[] = [];
  for (const chunk of chunkArray(npis, NPI_FILTER_CHUNK_SIZE)) {
    const batch = await fetchAllWarroomPages(
      () =>
        supabase
          .from("practices")
          .select("npi, practice_name, city, state, zip, latitude, longitude")
          .in("npi", chunk) as unknown as RangeableQuery<PracticeIdentityRow>
    );
    rows.push(...batch);
  }
  return rows;
}

function filterPracticeIdentityByScope(
  practice: PracticeIdentityRow | undefined,
  zipCodes: string[] | null,
  polygon: unknown | null
): PracticeIdentityRow | undefined {
  if (!practice) return undefined;
  if (zipCodes && !zipCodes.includes(practice.zip ?? "")) return undefined;
  if (polygon && !isLatLonInGeoJson(practice.latitude, practice.longitude, polygon)) {
    return undefined;
  }
  return practice;
}

export async function getScopedChanges(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: ScopedChangesOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomChangeRecord[]> {
  const supabase = getClient(supabaseClient);
  const { scope: resolvedScope, zipCodes, polygon } = resolveScope(scope);

  const changes = await fetchAllWarroomPages(
    () => {
      let query = supabase.from("practice_changes").select(CHANGE_SELECT);
      if (options.sinceDate) query = query.gte("change_date", options.sinceDate);
      query = query.order("change_date", { ascending: false });
      return query as unknown as RangeableQuery<ChangeRow>;
    },
    { pageSize: options.pageSize, maxRows: options.maxRows ?? 500 }
  );

  const npis = Array.from(new Set(changes.map((change) => change.npi).filter(Boolean)));
  const practices = await fetchPracticeIdentitiesForNpis(supabase, npis);
  const practiceMap = new Map(practices.map((practice) => [practice.npi, practice]));
  const includeMissingPractice = false;

  const scopedChanges = changes
    .map((change): WarroomChangeRecord | null => {
      const practice = filterPracticeIdentityByScope(
        practiceMap.get(change.npi),
        zipCodes,
        polygon
      );

      if (!practice && !includeMissingPractice) return null;

      return {
        ...change,
        practice_name: practice?.practice_name ?? null,
        city: practice?.city ?? null,
        state: practice?.state ?? null,
        zip: practice?.zip ?? null,
      };
    })
    .filter((change): change is WarroomChangeRecord => change !== null)
    .sort((a, b) => (b.change_date ?? "").localeCompare(a.change_date ?? ""));

  return options.maxRows == null ? scopedChanges : scopedChanges.slice(0, options.maxRows);
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export function computeOwnershipCountsFromPractices(
  practices: Pick<WarroomPracticeRecord, "entity_classification" | "ownership_status">[]
): WarroomOwnershipCounts {
  const counts: WarroomOwnershipCounts = {
    total: practices.length,
    independent: 0,
    corporate: 0,
    specialist: 0,
    nonClinical: 0,
    unknown: 0,
    known: 0,
    corporatePct: 0,
    independentPct: 0,
    unknownPct: 0,
  };

  practices.forEach((practice) => {
    const group = classifyPractice(
      practice.entity_classification,
      practice.ownership_status
    );
    if (group === "independent") counts.independent += 1;
    if (group === "corporate") counts.corporate += 1;
    if (group === "specialist") counts.specialist += 1;
    if (group === "non_clinical") counts.nonClinical += 1;
    if (group === "unknown") counts.unknown += 1;
  });

  counts.known =
    counts.independent + counts.corporate + counts.specialist + counts.nonClinical;
  counts.corporatePct = pct(counts.corporate, counts.total);
  counts.independentPct = pct(counts.independent, counts.total);
  counts.unknownPct = pct(counts.unknown, counts.total);
  return counts;
}

function basePracticeCountQuery(
  supabase: SupabaseClient,
  zipChunk: string[] | null
): CountFilterQuery {
  let query = supabase
    .from("practices")
    .select("npi", { count: "exact", head: true }) as unknown as CountFilterQuery;
  if (zipChunk) query = query.in("zip", zipChunk);
  return query;
}

async function countPracticeRows(
  supabase: SupabaseClient,
  zipCodes: string[] | null,
  applyFilters: (query: CountFilterQuery) => CountQuery = (query) => query
): Promise<number> {
  return countRowsByZipScope(zipCodes, (zipChunk) =>
    applyFilters(basePracticeCountQuery(supabase, zipChunk))
  );
}

// Counts location rows (practice_locations) — collapses NPI-1 + NPI-2 + suite
// variants at the same physical address. Filters out residential (home-office)
// rows by default. Use this for Sitrep KPIs that reflect "how many clinics."
function basePracticeLocationCountQuery(
  supabase: SupabaseClient,
  zipChunk: string[] | null
): CountFilterQuery {
  let query = supabase
    .from("practice_locations")
    .select("location_id", { count: "exact", head: true })
    .eq("is_likely_residential", false) as unknown as CountFilterQuery;
  if (zipChunk) query = query.in("zip", zipChunk);
  return query;
}

async function countPracticeLocationRows(
  supabase: SupabaseClient,
  zipCodes: string[] | null,
  applyFilters: (query: CountFilterQuery) => CountQuery = (query) => query
): Promise<number> {
  return countRowsByZipScope(zipCodes, (zipChunk) =>
    applyFilters(basePracticeLocationCountQuery(supabase, zipChunk))
  );
}

async function getOwnershipCountsByQuery(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<WarroomOwnershipCounts> {
  // Source counts from practice_locations (address-deduped, non-residential)
  // so KPIs reflect physical clinics, not raw NPI rows.
  const total = await countPracticeLocationRows(supabase, zipCodes);
  const independentByClassification = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.in("entity_classification", [...INDEPENDENT_CLASSIFICATIONS])
  );
  const independentByFallback = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.is("entity_classification", null).in("ownership_status", ["independent", "likely_independent"])
  );
  const corporateByClassification = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.in("entity_classification", ["dso_regional", "dso_national"])
  );
  const corporateByFallback = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.is("entity_classification", null).in("ownership_status", ["dso_affiliated", "pe_backed"])
  );
  const specialist = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.eq("entity_classification", "specialist")
  );
  const nonClinical = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.eq("entity_classification", "non_clinical")
  );

  const independent = independentByClassification + independentByFallback;
  const corporate = corporateByClassification + corporateByFallback;
  const known = independent + corporate + specialist + nonClinical;
  const unknown = Math.max(0, total - known);

  return {
    total,
    independent,
    corporate,
    specialist,
    nonClinical,
    unknown,
    known,
    corporatePct: pct(corporate, total),
    independentPct: pct(independent, total),
    unknownPct: pct(unknown, total),
  };
}

async function countEnrichedPractices(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<number> {
  // practice_locations exposes a `data_axle_enriched` boolean instead of a
  // timestamp — true if any underlying NPI was Data Axle-enriched.
  return countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.eq("data_axle_enriched", true)
  );
}

async function countAcquisitionTargets(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<number> {
  return countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.not("buyability_score", "is", null).gte("buyability_score", 50)
  );
}

async function countRetirementRisk(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<number> {
  const byClassification = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query
      .in("entity_classification", [...INDEPENDENT_CLASSIFICATIONS])
      .not("year_established", "is", null)
      .lt("year_established", 1995)
  );
  const byFallback = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query
      .is("entity_classification", null)
      .in("ownership_status", ["independent", "likely_independent"])
      .not("year_established", "is", null)
      .lt("year_established", 1995)
  );

  return byClassification + byFallback;
}

async function countScopedDeals(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<number> {
  return countRowsByZipScope(zipCodes, (zipChunk) => {
    let query = supabase.from("deals").select("id", { count: "exact", head: true });
    if (zipChunk) query = query.in("target_zip", zipChunk);
    return query;
  });
}

function averageCorporateShare(zipScores: WarroomZipScoreRecord[]): number | null {
  const values = zipScores
    .map((row) => row.corporate_share_pct)
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export interface ScopedPracticeSignalsOptions extends PaginationOptions {
  onlyFlagged?: boolean;
  requireFlags?: readonly (keyof WarroomPracticeSignalRecord)[];
  orderBy?: "retirement_combo_score" | "buyability_score" | "stealth_dso_cluster_size";
  ascending?: boolean;
}

export async function getScopedPracticeSignals(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: ScopedPracticeSignalsOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomPracticeSignalRecord[]> {
  const supabase = getClient(supabaseClient);
  const { zipCodes } = resolveScope(scope);

  const rows = await fetchRowsByZipScope(
    zipCodes,
    (zipChunk) => {
      let query = supabase.from("practice_signals").select(PRACTICE_SIGNAL_SELECT);
      if (zipChunk) query = query.in("zip_code", zipChunk);

      if (options.onlyFlagged || (options.requireFlags && options.requireFlags.length > 0)) {
        const flags = options.requireFlags ?? [
          "stealth_dso_flag",
          "phantom_inventory_flag",
          "family_dynasty_flag",
          "micro_cluster_flag",
          "retirement_combo_flag",
          "last_change_90d_flag",
          "high_peer_retirement_flag",
          "zip_ada_benchmark_gap_flag",
        ];
        const orClause = flags.map((flag) => `${String(flag)}.eq.true`).join(",");
        query = query.or(orClause);
      }

      if (options.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.ascending ?? false,
          nullsFirst: false,
        });
      } else {
        query = query.order("zip_code", { ascending: true });
      }

      return query as unknown as RangeableQuery<PracticeSignalRow>;
    },
    { pageSize: options.pageSize, maxRows: options.maxRows }
  );

  return rows;
}

export async function getScopedZipSignals(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: PaginationOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomZipSignalRecord[]> {
  const supabase = getClient(supabaseClient);
  const { zipCodes } = resolveScope(scope);

  const rows = await fetchRowsByZipScope(
    zipCodes,
    (zipChunk) => {
      let query = supabase.from("zip_signals").select(ZIP_SIGNAL_SELECT);
      if (zipChunk) query = query.in("zip_code", zipChunk);
      query = query.order("zip_code", { ascending: true });
      return query as unknown as RangeableQuery<ZipSignalRow>;
    },
    { pageSize: options.pageSize, maxRows: options.maxRows }
  );

  const byZip = new Map<string, WarroomZipSignalRecord>();
  rows.forEach((row) => byZip.set(row.zip_code, row));
  return Array.from(byZip.values()).sort((a, b) => a.zip_code.localeCompare(b.zip_code));
}

export function computeSignalCounts(
  practiceSignals: WarroomPracticeSignalRecord[],
  zipSignals: WarroomZipSignalRecord[]
): WarroomSignalCounts {
  const counts: WarroomSignalCounts = {
    stealthDsoPractices: 0,
    stealthDsoClusters: 0,
    phantomInventoryPractices: 0,
    familyDynastyPractices: 0,
    microClusterPractices: 0,
    microClusters: 0,
    retirementComboHigh: 0,
    recentChanges90d: 0,
    adaGapZips: 0,
    totalFlaggedPractices: 0,
  };

  const distinctStealthClusters = new Set<string>();
  const distinctMicroClusters = new Set<string>();

  practiceSignals.forEach((signal) => {
    if (signal.stealth_dso_flag) {
      counts.stealthDsoPractices += 1;
      if (signal.stealth_dso_cluster_id) distinctStealthClusters.add(signal.stealth_dso_cluster_id);
    }
    if (signal.phantom_inventory_flag) counts.phantomInventoryPractices += 1;
    if (signal.family_dynasty_flag) counts.familyDynastyPractices += 1;
    if (signal.micro_cluster_flag) {
      counts.microClusterPractices += 1;
      if (signal.micro_cluster_id) distinctMicroClusters.add(signal.micro_cluster_id);
    }
    if (signal.retirement_combo_flag) counts.retirementComboHigh += 1;
    if (signal.last_change_90d_flag) counts.recentChanges90d += 1;

    const hasAnyFlag =
      signal.stealth_dso_flag ||
      signal.phantom_inventory_flag ||
      signal.family_dynasty_flag ||
      signal.micro_cluster_flag ||
      signal.retirement_combo_flag ||
      signal.last_change_90d_flag ||
      signal.high_peer_retirement_flag;
    if (hasAnyFlag) counts.totalFlaggedPractices += 1;
  });

  counts.stealthDsoClusters = distinctStealthClusters.size;
  counts.microClusters = distinctMicroClusters.size;

  zipSignals.forEach((signal) => {
    if (signal.ada_benchmark_gap_flag) counts.adaGapZips += 1;
  });

  return counts;
}

export interface TopPracticeSignalsResult {
  stealthClusters: WarroomPracticeSignalRecord[];
  phantomInventory: WarroomPracticeSignalRecord[];
  retirementCombo: WarroomPracticeSignalRecord[];
  familyDynasties: WarroomPracticeSignalRecord[];
  microClusters: WarroomPracticeSignalRecord[];
}

export function extractTopPracticeSignals(
  signals: WarroomPracticeSignalRecord[],
  limit = 8
): TopPracticeSignalsResult {
  return {
    stealthClusters: signals
      .filter((signal) => signal.stealth_dso_flag)
      .sort((a, b) => (b.stealth_dso_cluster_size ?? 0) - (a.stealth_dso_cluster_size ?? 0))
      .slice(0, limit),
    phantomInventory: signals
      .filter((signal) => signal.phantom_inventory_flag)
      .sort((a, b) => (b.buyability_score ?? 0) - (a.buyability_score ?? 0))
      .slice(0, limit),
    retirementCombo: signals
      .filter((signal) => signal.retirement_combo_flag)
      .sort((a, b) => (b.retirement_combo_score ?? 0) - (a.retirement_combo_score ?? 0))
      .slice(0, limit),
    familyDynasties: signals
      .filter((signal) => signal.family_dynasty_flag)
      .sort((a, b) => (b.buyability_score ?? 0) - (a.buyability_score ?? 0))
      .slice(0, limit),
    microClusters: signals
      .filter((signal) => signal.micro_cluster_flag)
      .sort((a, b) => (b.micro_cluster_size ?? 0) - (a.micro_cluster_size ?? 0))
      .slice(0, limit),
  };
}

async function countCorporateHighConfidence(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<number> {
  // Post-Phase B (2026-04-25): dso_regional in practice_locations is already
  // strict (phone-only signal demoted to a flag in classification_reasoning).
  // strongRegional now keeps the ein/parent_company guard but drops
  // franchise_name (column not in practice_locations schema).
  const dsoNational = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query.eq("entity_classification", "dso_national")
  );
  const strongRegional = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query
      .eq("entity_classification", "dso_regional")
      .or("ein.not.is.null,parent_company.not.is.null")
  );
  const dsoSpecialists = await countPracticeLocationRows(supabase, zipCodes, (query) =>
    query
      .eq("entity_classification", "specialist")
      .in("ownership_status", ["dso_affiliated", "pe_backed"])
  );
  return dsoNational + strongRegional + dsoSpecialists;
}

async function averageScopedScores(
  supabase: SupabaseClient,
  zipCodes: string[] | null
): Promise<{ avgBuyability: number | null; avgOpportunity: number | null }> {
  const buyabilityRows = await fetchRowsByZipScope<{ buyability_score: number | null }>(
    zipCodes,
    (zipChunk) => {
      let query = supabase
        .from("practices")
        .select("buyability_score")
        .not("buyability_score", "is", null);
      if (zipChunk) query = query.in("zip", zipChunk);
      return query as unknown as RangeableQuery<{ buyability_score: number | null }>;
    },
    { pageSize: 1000 }
  );

  const opportunityRows = await fetchRowsByZipScope<{ opportunity_score: number | null }>(
    zipCodes,
    (zipChunk) => {
      let query = supabase
        .from("zip_scores")
        .select("opportunity_score")
        .not("opportunity_score", "is", null);
      if (zipChunk) query = query.in("zip_code", zipChunk);
      return query as unknown as RangeableQuery<{ opportunity_score: number | null }>;
    }
  );

  const buyabilityValues = buyabilityRows
    .map((row) => row.buyability_score)
    .filter((value): value is number => value != null);
  const opportunityValues = opportunityRows
    .map((row) => row.opportunity_score)
    .filter((value): value is number => value != null);

  return {
    avgBuyability: buyabilityValues.length
      ? Math.round((buyabilityValues.reduce((sum, value) => sum + value, 0) / buyabilityValues.length) * 10) / 10
      : null,
    avgOpportunity: opportunityValues.length
      ? Math.round((opportunityValues.reduce((sum, value) => sum + value, 0) / opportunityValues.length) * 10) / 10
      : null,
  };
}

export async function getWarroomSummary(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  supabaseClient?: SupabaseClient
): Promise<WarroomSummary> {
  const supabase = getClient(supabaseClient);
  const resolution = resolveScope(scope);
  const isPolygonScope = Boolean(resolution.polygon);

  let ownership: WarroomOwnershipCounts;
  let enrichedPractices: number;
  let acquisitionTargets: number;
  let retirementRisk: number;
  let corporateHighConfidence: number;

  if (isPolygonScope) {
    const practices = await getScopedPractices(scope, {}, supabase);
    ownership = computeOwnershipCountsFromPractices(practices);
    enrichedPractices = practices.filter((practice) => practice.data_axle_import_date != null).length;
    acquisitionTargets = practices.filter((practice) => (practice.buyability_score ?? 0) >= 50).length;
    retirementRisk = practices.filter((practice) => {
      const group = classifyPractice(practice.entity_classification, practice.ownership_status);
      return group === "independent" && (practice.year_established ?? 9999) < 1995;
    }).length;
    corporateHighConfidence = practices.filter((practice) => {
      if (practice.entity_classification === "dso_national") return true;
      if (
        practice.entity_classification === "dso_regional" &&
        (practice.ein || practice.parent_company || practice.franchise_name)
      ) {
        return true;
      }
      if (
        practice.entity_classification === "specialist" &&
        (practice.ownership_status === "dso_affiliated" || practice.ownership_status === "pe_backed")
      ) {
        return true;
      }
      return false;
    }).length;
  } else {
    [
      ownership,
      enrichedPractices,
      acquisitionTargets,
      retirementRisk,
      corporateHighConfidence,
    ] = await Promise.all([
      getOwnershipCountsByQuery(supabase, resolution.zipCodes),
      countEnrichedPractices(supabase, resolution.zipCodes),
      countAcquisitionTargets(supabase, resolution.zipCodes),
      countRetirementRisk(supabase, resolution.zipCodes),
      countCorporateHighConfidence(supabase, resolution.zipCodes),
    ]);
  }

  const [dealCount, deals, zipScores, changes, changes90d, scoreAverages] = await Promise.all([
    countScopedDeals(supabase, resolution.zipCodes),
    getScopedDeals(scope, {}, supabase),
    getScopedZipScores(scope, {}, supabase),
    getScopedChanges(scope, {}, supabase),
    getScopedChanges(scope, { sinceDate: dateDaysAgo(90) }, supabase),
    averageScopedScores(supabase, resolution.zipCodes),
  ]);

  let signalCounts: WarroomSignalCounts | null = null;
  try {
    const [practiceSignals, zipSignals] = await Promise.all([
      getScopedPracticeSignals(scope, { onlyFlagged: true }, supabase),
      getScopedZipSignals(scope, {}, supabase),
    ]);
    signalCounts = computeSignalCounts(practiceSignals, zipSignals);
  } catch (error) {
    // Signals tables may not yet exist in Supabase (background sync in flight).
    // Fall through with null signalCounts — UI will render "signals pending" state.
    signalCounts = null;
    void error;
  }

  return {
    scopeKind: resolution.scope.kind,
    scopeLabel: resolution.label,
    zipCodes: resolution.zipCodes,
    generatedAt: new Date().toISOString(),
    ownership,
    enrichedPractices,
    enrichedPct: pct(enrichedPractices, ownership.total),
    acquisitionTargets,
    retirementRisk,
    dealCount,
    latestDealDate: deals[0]?.deal_date ?? null,
    zipScoreCount: zipScores.length,
    averageCorporateSharePct: averageCorporateShare(zipScores),
    changeCount: changes.length,
    changeCount90d: changes90d.length,
    signalCounts,
    corporateHighConfidence,
    corporateHighConfidencePct: pct(corporateHighConfidence, ownership.total),
    avgBuyabilityScore: scoreAverages.avgBuyability,
    avgOpportunityScore: scoreAverages.avgOpportunity,
  };
}

export interface PracticePeerPercentiles {
  npi: string;
  buyability_pctile_zip_class: number | null;
  buyability_pctile_class: number | null;
  retirement_pctile_zip_class: number | null;
  retirement_pctile_class: number | null;
  high_peer_retirement_flag: boolean | null;
  peer_percentile_reasoning: string | null;
  deal_catchment_24mo: number | null;
  deal_catchment_reasoning: string | null;
}

const PEER_PERCENTILE_SELECT =
  "npi,buyability_pctile_zip_class,buyability_pctile_class,retirement_pctile_zip_class,retirement_pctile_class,high_peer_retirement_flag,peer_percentile_reasoning,deal_catchment_24mo,deal_catchment_reasoning";

/**
 * Single-NPI fetch of peer-percentile + deal-catchment columns from practice_signals.
 * Used by the compound-narrative route to inject peer atoms into the evidence ledger.
 * Returns null when the NPI has no signal row (most non-watched-ZIP practices).
 */
export async function getPracticeSignalsByNpi(
  npi: string,
  supabaseClient?: SupabaseClient
): Promise<PracticePeerPercentiles | null> {
  const supabase = getClient(supabaseClient);
  const { data, error } = await supabase
    .from("practice_signals")
    .select(PEER_PERCENTILE_SELECT)
    .eq("npi", npi)
    .maybeSingle();
  if (error) throw error;
  return (data as PracticePeerPercentiles | null) ?? null;
}

export { getScopeLabel, resolveScopeZipCodes };
