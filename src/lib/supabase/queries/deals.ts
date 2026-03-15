import { SupabaseClient } from "@supabase/supabase-js";
import type { DealFilters, DealStats } from "../types";
// Re-export Deal so consumers can `import type { Deal } from '@/lib/supabase/queries/deals'`
export type { Deal } from "../types";
import type { Deal } from "../types";

export async function getDealsByFilters(
  supabase: SupabaseClient,
  filters: DealFilters,
  page = 1,
  pageSize = 50
): Promise<{ data: Deal[]; count: number }> {
  let query = supabase
    .from("deals")
    .select("*", { count: "exact" });

  if (filters.deal_type) {
    query = query.eq("deal_type", filters.deal_type);
  }
  if (filters.pe_sponsor) {
    query = query.ilike("pe_sponsor", `%${filters.pe_sponsor}%`);
  }
  if (filters.target_state) {
    query = query.eq("target_state", filters.target_state);
  }
  if (filters.source) {
    query = query.eq("source", filters.source);
  }
  if (filters.year) {
    const yearStart = `${filters.year}-01-01`;
    const yearEnd = `${filters.year}-12-31`;
    query = query.gte("deal_date", yearStart).lte("deal_date", yearEnd);
  }
  if (filters.search) {
    query = query.or(
      `platform_company.ilike.%${filters.search}%,target_name.ilike.%${filters.search}%,pe_sponsor.ilike.%${filters.search}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order("deal_date", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return { data: (data as Deal[]) ?? [], count: count ?? 0 };
}

export async function getDealStats(
  supabase: SupabaseClient
): Promise<DealStats> {
  // Fetch all deals (needed for deal-flow page + aggregation)
  // Supabase default limit is 1000 rows — paginate to get all 2,500+
  const allDeals: Deal[] = [];
  const pageSize = 1000;
  let page = 0;
  let totalDeals = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await supabase
      .from("deals")
      .select("id, deal_date, platform_company, pe_sponsor, target_name, target_city, target_state, target_zip, deal_type, deal_size_mm, ebitda_multiple, specialty, num_locations, source, source_url, notes, created_at, updated_at", { count: "exact" })
      .order("deal_date", { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (page === 0) totalDeals = count ?? 0;

    const batch = (data as Deal[]) ?? [];
    allDeals.push(...batch);

    if (batch.length < pageSize) break;
    page++;
  }

  const deals = allDeals;
  const total = totalDeals || deals.length;

  // Deals by type
  const byType: Record<string, number> = {};
  deals.forEach((d) => {
    const t = d.deal_type ?? "other";
    byType[t] = (byType[t] ?? 0) + 1;
  });

  // Deals by state
  const byState: Record<string, number> = {};
  deals.forEach((d) => {
    const s = d.target_state ?? "Unknown";
    byState[s] = (byState[s] ?? 0) + 1;
  });

  // Avg deal size
  const sizes = deals
    .map((d) => d.deal_size_mm)
    .filter((v): v is number => v != null);
  const avgSize =
    sizes.length > 0
      ? Math.round(
          (sizes.reduce((a, b) => a + b, 0) / sizes.length) * 100
        ) / 100
      : null;

  // Avg EBITDA multiple
  const mults = deals
    .map((d) => d.ebitda_multiple)
    .filter((v): v is number => v != null);
  const avgMult =
    mults.length > 0
      ? Math.round(
          (mults.reduce((a, b) => a + b, 0) / mults.length) * 100
        ) / 100
      : null;

  // Distinct values for filter dropdowns
  const distinctSponsors = Array.from(
    new Set(deals.map((d) => d.pe_sponsor).filter(Boolean) as string[])
  ).sort();
  const distinctPlatforms = Array.from(
    new Set(deals.map((d) => d.platform_company).filter(Boolean) as string[])
  ).sort();
  const distinctStates = Array.from(
    new Set(deals.map((d) => d.target_state).filter(Boolean) as string[])
  ).sort();
  const distinctSpecialties = Array.from(
    new Set(deals.map((d) => d.specialty).filter(Boolean) as string[])
  ).sort();
  const distinctSources = Array.from(
    new Set(deals.map((d) => d.source).filter(Boolean) as string[])
  ).sort();
  const distinctTypes = Array.from(
    new Set(deals.map((d) => d.deal_type).filter(Boolean) as string[])
  ).sort();

  // YTD deals (for home page)
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const ytdDeals = deals.filter(
    (d) => d.deal_date && d.deal_date >= yearStart
  ).length;

  return {
    total_deals: total,
    by_deal_type: byType,
    by_state: byState,
    avg_deal_size_mm: avgSize,
    avg_ebitda_multiple: avgMult,
    unique_pe_sponsors: distinctSponsors.length,
    // Extended: deal-flow page
    deals,
    distinctSponsors,
    distinctPlatforms,
    distinctStates,
    distinctSpecialties,
    distinctSources,
    distinctTypes,
    // Extended: home page
    totalDeals: total,
    ytdDeals,
    activeSponsors: distinctSponsors.length,
  };
}

export async function getTopSponsors(
  supabase: SupabaseClient,
  limit = 15
): Promise<{ name: string; deal_count: number }[]> {
  // Paginate to get all sponsors (2,500+ deals exceeds default 1000 row limit)
  const allRows: { pe_sponsor: string }[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("deals")
      .select("pe_sponsor")
      .not("pe_sponsor", "is", null)
      .range(from, to);

    if (error) throw error;
    const batch = (data ?? []) as { pe_sponsor: string }[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  const counts: Record<string, number> = {};
  allRows.forEach((row) => {
    counts[row.pe_sponsor] = (counts[row.pe_sponsor] ?? 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, deal_count]) => ({ name, deal_count }))
    .sort((a, b) => b.deal_count - a.deal_count)
    .slice(0, limit);
}

export async function getTopPlatforms(
  supabase: SupabaseClient,
  limit = 15
): Promise<{ name: string; deal_count: number }[]> {
  // Paginate to get all platforms (2,500+ deals exceeds default 1000 row limit)
  const allRows: { platform_company: string }[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("deals")
      .select("platform_company")
      .range(from, to);

    if (error) throw error;
    const batch = (data ?? []) as { platform_company: string }[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  const counts: Record<string, number> = {};
  allRows.forEach((row) => {
    counts[row.platform_company] =
      (counts[row.platform_company] ?? 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, deal_count]) => ({ name, deal_count }))
    .sort((a, b) => b.deal_count - a.deal_count)
    .slice(0, limit);
}

export async function getRecentDeals(
  supabase: SupabaseClient,
  limit = 20
): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("deal_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Deal[]) ?? [];
}

/**
 * Paginated helper to fetch all rows of a single column from deals table.
 */
async function fetchAllDealColumn<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  column: string,
  notNull = true
): Promise<T[]> {
  const allRows: T[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let q = supabase.from("deals").select(column);
    if (notNull) q = q.not(column, "is", null);
    q = q.range(from, to);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as unknown as T[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }
  return allRows;
}

/**
 * Return sorted list of distinct PE sponsor names.
 */
export async function getDistinctSponsors(
  supabase: SupabaseClient
): Promise<string[]> {
  const rows = await fetchAllDealColumn<{ pe_sponsor: string | null }>(
    supabase, "pe_sponsor"
  );
  const unique = Array.from(
    new Set(rows.map((r) => r.pe_sponsor).filter(Boolean) as string[])
  ).sort();
  return unique;
}

/**
 * Return sorted list of distinct platform company names.
 */
export async function getDistinctPlatforms(
  supabase: SupabaseClient
): Promise<string[]> {
  const rows = await fetchAllDealColumn<{ platform_company: string | null }>(
    supabase, "platform_company"
  );
  const unique = Array.from(
    new Set(rows.map((r) => r.platform_company).filter(Boolean) as string[])
  ).sort();
  return unique;
}

/**
 * Return sorted list of distinct target states.
 */
export async function getDistinctStates(
  supabase: SupabaseClient
): Promise<string[]> {
  const rows = await fetchAllDealColumn<{ target_state: string | null }>(
    supabase, "target_state"
  );
  const unique = Array.from(
    new Set(rows.map((r) => r.target_state).filter(Boolean) as string[])
  ).sort();
  return unique;
}
