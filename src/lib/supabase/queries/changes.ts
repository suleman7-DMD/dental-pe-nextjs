import { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeChange } from "../types";

// Explicit column list — avoids pulling large text blobs (notes can be JSON)
// and prevents select("*") statement_timeout (57014) on unindexed full scans.
const CHANGE_COLS =
  "id,npi,change_date,field_changed,old_value,new_value,change_type,notes,created_at";

export async function getRecentChanges(
  supabase: SupabaseClient,
  zipCodes?: string[],
  days = 90
): Promise<PracticeChange[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];
  let effectiveZipCodes = zipCodes?.filter(Boolean) ?? null;

  if (!effectiveZipCodes) {
    const { data, error } = await supabase
      .from("watched_zips")
      .select("zip_code")
      .eq("state", "IL");
    if (error) throw error;
    effectiveZipCodes = (data ?? []).map((row: { zip_code: string }) => row.zip_code);
  }

  // If we have ZIP codes, we need to join through practices
  // Supabase doesn't support cross-table filtering directly in the REST API,
  // so we fetch practice NPIs in the given ZIPs first, then filter changes.
  if (effectiveZipCodes.length > 0) {
    // Paginate NPI query to avoid Supabase 1000-row default limit
    // (watched ZIPs contain 14k+ practices)
    const chunkSize = 100;
    const pageSize = 1000;
    const allNpis: string[] = [];

    for (let i = 0; i < effectiveZipCodes.length; i += chunkSize) {
      const zipChunk = effectiveZipCodes.slice(i, i + chunkSize);
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch } = await supabase
          .from("practices")
          .select("npi")
          .in("zip", zipChunk)
          .order("npi", { ascending: true })
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
        .select(CHANGE_COLS)
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

  return [];
}
