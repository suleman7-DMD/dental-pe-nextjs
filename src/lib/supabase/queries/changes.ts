import { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeChange } from "../types";

export async function getRecentChanges(
  supabase: SupabaseClient,
  zipCodes?: string[],
  days = 90
): Promise<PracticeChange[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  // If we have ZIP codes, we need to join through practices
  // Supabase doesn't support cross-table filtering directly in the REST API,
  // so we fetch practice NPIs in the given ZIPs first, then filter changes.
  if (zipCodes && zipCodes.length > 0) {
    // Paginate NPI query to avoid Supabase 1000-row default limit
    // (watched ZIPs contain 14k+ practices)
    const chunkSize = 100;
    const pageSize = 1000;
    const allNpis: string[] = [];

    for (let i = 0; i < zipCodes.length; i += chunkSize) {
      const zipChunk = zipCodes.slice(i, i + chunkSize);
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch } = await supabase
          .from("practices")
          .select("npi")
          .in("zip", zipChunk)
          .range(offset, offset + pageSize - 1);
        if (batch && batch.length > 0) {
          allNpis.push(...batch.map((r: { npi: string }) => r.npi));
          offset += batch.length;
          hasMore = batch.length === pageSize;
        } else {
          hasMore = false;
        }
      }
    }

    const npis = allNpis;

    if (npis.length === 0) return [];

    // Supabase IN filter has limits; batch if needed
    const batchSize = 500;
    const allChanges: PracticeChange[] = [];

    for (let i = 0; i < npis.length; i += batchSize) {
      const batch = npis.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("practice_changes")
        .select("*")
        .in("npi", batch)
        .gte("change_date", sinceDateStr)
        .order("change_date", { ascending: false });

      if (error) throw error;
      allChanges.push(...((data as PracticeChange[]) ?? []));
    }

    return allChanges.sort((a, b) => {
      const da = a.change_date ?? "";
      const db = b.change_date ?? "";
      return db.localeCompare(da);
    });
  }

  // No ZIP filter: get all recent changes
  const { data, error } = await supabase
    .from("practice_changes")
    .select("*")
    .gte("change_date", sinceDateStr)
    .order("change_date", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data as PracticeChange[]) ?? [];
}
