import { SupabaseClient } from "@supabase/supabase-js";
import type {
  ZipQualitativeIntel,
  PracticeIntel,
  IntelStats,
} from "../../types/intel";

export type { ZipQualitativeIntel, PracticeIntel, IntelStats };

function timeoutSignal(ms: number): AbortSignal {
  if ("timeout" in AbortSignal && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function getZipIntel(
  supabase: SupabaseClient,
  options: { includeSynthetic?: boolean } = {}
): Promise<ZipQualitativeIntel[]> {
  const query = supabase
    .from("zip_qualitative_intel")
    .select("*")
    .order("zip_code", { ascending: true });

  // Default: hide the 287 placeholder rows that were inserted before the
  // bulletproofed protocol with forced web_search. Pass includeSynthetic=true
  // for diagnostic surfaces (e.g. /system or /data-breakdown) that want to
  // show coverage gaps.
  if (!options.includeSynthetic) {
    query.eq("is_synthetic", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ZipQualitativeIntel[]) ?? [];
}

export async function getPracticeIntel(
  supabase: SupabaseClient
): Promise<PracticeIntel[]> {
  try {
    const { data, error } = await supabase
      .from("practice_intel")
      .select("*")
      .order("research_date", { ascending: false })
      .limit(250)
      .abortSignal(timeoutSignal(1500));

    if (error) throw error;
    return (data ?? []) as PracticeIntel[];
  } catch (error) {
    void error;
    return [];
  }
}

export async function getZipIntelByZip(
  supabase: SupabaseClient,
  zipCode: string,
  options: { includeSynthetic?: boolean } = {}
): Promise<ZipQualitativeIntel | null> {
  const query = supabase
    .from("zip_qualitative_intel")
    .select("*")
    .eq("zip_code", zipCode);

  if (!options.includeSynthetic) {
    query.eq("is_synthetic", false);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as ZipQualitativeIntel | null;
}

export async function getPracticeIntelByNpi(
  supabase: SupabaseClient,
  npi: string
): Promise<PracticeIntel | null> {
  const { data, error } = await supabase
    .from("practice_intel")
    .select("*")
    .eq("npi", npi)
    .abortSignal(timeoutSignal(1500))
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    console.warn(`[intel] practice_intel npi=${npi} unavailable:`, error.message);
    return null;
  }
  return data as PracticeIntel | null;
}

export async function getPracticeIntelAvailability(
  supabase: SupabaseClient,
  npis: string[]
): Promise<Set<string>> {
  if (npis.length === 0) return new Set();
  const available = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < npis.length; i += CHUNK) {
    const slice = npis.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("practice_intel")
      .select("npi")
      .in("npi", slice)
      .abortSignal(timeoutSignal(1500));
    if (error) {
      console.warn("[intel] practice_intel availability unavailable:", error.message);
      return available;
    }
    (data ?? []).forEach((row) => {
      const npi = (row as { npi?: string | null }).npi;
      if (npi) available.add(npi);
    });
  }
  return available;
}

export async function getIntelStats(
  supabase: SupabaseClient
): Promise<IntelStats> {
  // Real ZIP intel only — exclude synthetic placeholders so the "ZIPs researched"
  // KPI on /intelligence reflects bulletproofed coverage, not the 287 stale stubs.
  const [
    { count: zipCount },
    { data: zipCosts },
    { data: practiceSync },
  ] = await Promise.all([
    supabase
      .from("zip_qualitative_intel")
      .select("zip_code", { count: "exact", head: true })
      .eq("is_synthetic", false),
    supabase
      .from("zip_qualitative_intel")
      .select("cost_usd")
      .eq("is_synthetic", false)
      .not("cost_usd", "is", null),
    supabase
      .from("sync_metadata")
      .select("rows_synced")
      .eq("table_name", "practice_intel")
      .maybeSingle(),
  ]);

  const allCosts = [
    ...((zipCosts ?? []) as { cost_usd: number }[]),
  ];
  const avgCost =
    allCosts.length > 0
      ? allCosts.reduce((sum, r) => sum + r.cost_usd, 0) / allCosts.length
      : null;

  return {
    totalZipsResearched: zipCount ?? 0,
    totalPracticesResearched: practiceSync?.rows_synced ?? 0,
    avgCostUsd: avgCost !== null ? Math.round(avgCost * 100) / 100 : null,
    highReadinessCount: 0,
  };
}
