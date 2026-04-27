import { createServerClient } from "@/lib/supabase/server";
import { getDataBreakdownBundle } from "@/lib/supabase/queries/data-breakdown";
import { DataBreakdownShell } from "./_components/data-breakdown-shell";

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: "Data Breakdown | Dental PE Intelligence",
  description:
    "Verify every count on the dashboard — see exactly where each number comes from with per-segment breakdowns and source queries.",
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

  return <DataBreakdownShell bundle={bundle} error={error} />;
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
