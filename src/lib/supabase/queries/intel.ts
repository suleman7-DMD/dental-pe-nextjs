import { SupabaseClient } from "@supabase/supabase-js";
import type {
  ZipQualitativeIntel,
  PracticeIntel,
  IntelStats,
} from "../../types/intel";

export type { ZipQualitativeIntel, PracticeIntel, IntelStats };

export async function getZipIntel(
  supabase: SupabaseClient
): Promise<ZipQualitativeIntel[]> {
  const { data, error } = await supabase
    .from("zip_qualitative_intel")
    .select("*")
    .order("zip_code", { ascending: true });

  if (error) throw error;
  return (data as ZipQualitativeIntel[]) ?? [];
}

export async function getPracticeIntel(
  supabase: SupabaseClient
): Promise<PracticeIntel[]> {
  const { data, error } = await supabase
    .from("practice_intel")
    .select("*")
    .order("research_date", { ascending: false });

  if (error) throw error;
  return (data as PracticeIntel[]) ?? [];
}

export async function getZipIntelByZip(
  supabase: SupabaseClient,
  zipCode: string
): Promise<ZipQualitativeIntel | null> {
  const { data, error } = await supabase
    .from("zip_qualitative_intel")
    .select("*")
    .eq("zip_code", zipCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as ZipQualitativeIntel;
}

export async function getPracticeIntelByNpi(
  supabase: SupabaseClient,
  npi: string
): Promise<PracticeIntel | null> {
  const { data, error } = await supabase
    .from("practice_intel")
    .select("*")
    .eq("npi", npi)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as PracticeIntel;
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
      .in("npi", slice);
    if (error) throw error;
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
  // Run all queries in parallel for speed
  const [
    { count: zipCount },
    { count: practiceCount },
    { data: zipCosts },
    { data: practiceCosts },
    { count: highReadiness },
  ] = await Promise.all([
    supabase.from("zip_qualitative_intel").select("zip_code", { count: "exact", head: true }),
    supabase.from("practice_intel").select("npi", { count: "exact", head: true }),
    supabase.from("zip_qualitative_intel").select("cost_usd").not("cost_usd", "is", null),
    supabase.from("practice_intel").select("cost_usd").not("cost_usd", "is", null),
    supabase.from("practice_intel").select("npi", { count: "exact", head: true }).eq("acquisition_readiness", "high"),
  ]);

  const allCosts = [
    ...((zipCosts ?? []) as { cost_usd: number }[]),
    ...((practiceCosts ?? []) as { cost_usd: number }[]),
  ];
  const avgCost =
    allCosts.length > 0
      ? allCosts.reduce((sum, r) => sum + r.cost_usd, 0) / allCosts.length
      : null;

  return {
    totalZipsResearched: zipCount ?? 0,
    totalPracticesResearched: practiceCount ?? 0,
    avgCostUsd: avgCost !== null ? Math.round(avgCost * 100) / 100 : null,
    highReadinessCount: highReadiness ?? 0,
  };
}
