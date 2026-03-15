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

export async function getIntelStats(
  supabase: SupabaseClient
): Promise<IntelStats> {
  // Total ZIPs researched
  const { count: zipCount } = await supabase
    .from("zip_qualitative_intel")
    .select("*", { count: "exact", head: true });

  // Total practices researched
  const { count: practiceCount } = await supabase
    .from("practice_intel")
    .select("*", { count: "exact", head: true });

  // Average cost across both tables
  const { data: zipCosts } = await supabase
    .from("zip_qualitative_intel")
    .select("cost_usd")
    .not("cost_usd", "is", null);

  const { data: practiceCosts } = await supabase
    .from("practice_intel")
    .select("cost_usd")
    .not("cost_usd", "is", null);

  const allCosts = [
    ...((zipCosts ?? []) as { cost_usd: number }[]),
    ...((practiceCosts ?? []) as { cost_usd: number }[]),
  ];
  const avgCost =
    allCosts.length > 0
      ? allCosts.reduce((sum, r) => sum + r.cost_usd, 0) / allCosts.length
      : null;

  // High readiness count
  const { count: highReadiness } = await supabase
    .from("practice_intel")
    .select("*", { count: "exact", head: true })
    .eq("acquisition_readiness", "high");

  return {
    totalZipsResearched: zipCount ?? 0,
    totalPracticesResearched: practiceCount ?? 0,
    avgCostUsd: avgCost !== null ? Math.round(avgCost * 100) / 100 : null,
    highReadinessCount: highReadiness ?? 0,
  };
}
