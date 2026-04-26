import { createServerClient } from "@/lib/supabase/server";
import { getDataBreakdownBundle } from "@/lib/supabase/queries/data-breakdown";
import { DataBreakdownShell } from "./_components/data-breakdown-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;
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
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return <DataBreakdownShell bundle={bundle} error={error} />;
}
