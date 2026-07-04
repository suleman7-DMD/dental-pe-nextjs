import { createServerClient } from "@/lib/supabase/server";
import { getDataBreakdownBundle } from "@/lib/supabase/queries/data-breakdown";
import { getZipScores } from "@/lib/supabase/queries/zip-scores";
import { getCorporateBand, type CorporateBand } from "@/lib/constants/consolidation-honesty";
import { DataBreakdownShell } from "./_components/data-breakdown-shell";

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: "Methodology | Chicagoland Census",
  description:
    "Verify every count, unit, and source behind the Chicagoland practice census.",
};

export default async function DataBreakdownPage() {
  const supabase = await createServerClient();

  let bundle: Awaited<ReturnType<typeof getDataBreakdownBundle>> | null = null;
  let error: string | null = null;
  try {
    bundle = await getDataBreakdownBundle(supabase);
  } catch (e: unknown) {
    error = serializeError(e);
    console.error("[/data-breakdown] getDataBreakdownBundle threw:", e);
  }

  // The ONE legacy-detector exhibit the app keeps: the confirmed-floor band,
  // with its per-location share computed live from zip_scores (never hardcoded).
  let detectorBand: CorporateBand | null = null;
  try {
    const zipScores = await getZipScores(supabase);
    const gpTotal = zipScores.reduce((s, z) => s + (z.total_gp_locations ?? 0), 0);
    const corpTotal = zipScores.reduce(
      (s, z) => s + (z.corporate_share_pct ?? 0) * (z.total_gp_locations ?? 0),
      0
    );
    if (gpTotal > 0) detectorBand = getCorporateBand((corpTotal / gpTotal) * 100, "mixed");
  } catch (e: unknown) {
    console.error("[/data-breakdown] detector band inputs failed to load:", e);
  }

  return <DataBreakdownShell bundle={bundle} error={error} detectorBand={detectorBand} />;
}

function serializeError(e: unknown): string {
  if (!e) return "Unknown error (null/undefined thrown)";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === "string") parts.push(obj.message);
    if (typeof obj.code === "string" || typeof obj.code === "number") parts.push(`(code: ${obj.code})`);
    if (typeof obj.details === "string") parts.push(`details: ${obj.details}`);
    if (typeof obj.hint === "string") parts.push(`hint: ${obj.hint}`);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(obj);
    } catch {
      return Object.prototype.toString.call(obj);
    }
  }
  return String(e);
}
