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
  const { data: allDeals, count: totalDeals } = await supabase
    .from("deals")
    .select("*", { count: "exact" })
    .order("deal_date", { ascending: false });

  const deals = (allDeals as Deal[]) ?? [];
  const total = totalDeals ?? deals.length;

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
  const { data } = await supabase
    .from("deals")
    .select("pe_sponsor")
    .not("pe_sponsor", "is", null);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { pe_sponsor: string }) => {
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
  const { data } = await supabase
    .from("deals")
    .select("platform_company");

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { platform_company: string }) => {
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
 * Return sorted list of distinct PE sponsor names.
 */
export async function getDistinctSponsors(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("pe_sponsor")
    .not("pe_sponsor", "is", null);

  if (error) throw error;
  const unique = Array.from(
    new Set(
      (data ?? [])
        .map((r: { pe_sponsor: string | null }) => r.pe_sponsor)
        .filter(Boolean) as string[]
    )
  ).sort();
  return unique;
}

/**
 * Return sorted list of distinct platform company names.
 */
export async function getDistinctPlatforms(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("platform_company")
    .not("platform_company", "is", null);

  if (error) throw error;
  const unique = Array.from(
    new Set(
      (data ?? [])
        .map((r: { platform_company: string | null }) => r.platform_company)
        .filter(Boolean) as string[]
    )
  ).sort();
  return unique;
}

/**
 * Return sorted list of distinct target states.
 */
export async function getDistinctStates(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("target_state")
    .not("target_state", "is", null);

  if (error) throw error;
  const unique = Array.from(
    new Set(
      (data ?? [])
        .map((r: { target_state: string | null }) => r.target_state)
        .filter(Boolean) as string[]
    )
  ).sort();
  return unique;
}
