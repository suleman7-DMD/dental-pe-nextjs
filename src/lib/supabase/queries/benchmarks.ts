import { SupabaseClient } from "@supabase/supabase-js";
import type { ADAHPIBenchmark } from "../types";

export async function getADABenchmarksByState(
  supabase: SupabaseClient,
  state: string
): Promise<ADAHPIBenchmark[]> {
  const { data, error } = await supabase
    .from("ada_hpi_benchmarks")
    .select("*")
    .eq("state", state)
    .order("data_year", { ascending: true });

  if (error) throw error;
  return (data as ADAHPIBenchmark[]) ?? [];
}

export async function getADABenchmarksAll(
  supabase: SupabaseClient
): Promise<ADAHPIBenchmark[]> {
  const { data, error } = await supabase
    .from("ada_hpi_benchmarks")
    .select("*")
    .order("data_year", { ascending: true });

  if (error) throw error;
  return (data as ADAHPIBenchmark[]) ?? [];
}

export async function getADAStates(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("ada_hpi_benchmarks")
    .select("state");

  if (error) throw error;

  const unique = new Set(
    (data ?? []).map((r: { state: string }) => r.state)
  );
  return Array.from(unique).sort();
}
