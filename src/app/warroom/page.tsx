import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSitrepBundle } from "@/lib/warroom/data"
import { DEFAULT_WARROOM_SCOPE } from "@/lib/warroom/scope"
import type { WarroomSitrepBundle } from "@/lib/warroom/signals"
import { WarroomShell } from "./_components/warroom-shell"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = {
  title: "Review Desk | Chicagoland Directory",
  description:
    "Review queues, maps, and practice dossiers for rows that need closer ownership attention.",
}

export default async function WarroomPage() {
  let initialBundle: WarroomSitrepBundle | null = null
  let initialBundleError: string | null = null

  try {
    const supabase = getSupabaseServerClient()
    initialBundle = await getSitrepBundle(DEFAULT_WARROOM_SCOPE, { loadSignals: true }, supabase)
  } catch (error) {
    initialBundleError =
      error instanceof Error ? error.message : "Failed to load warroom bundle"
    console.error("[warroom] Initial bundle fetch failed:", error)
  }

  return (
    <WarroomShell
      initialBundle={initialBundle}
      initialBundleError={initialBundleError}
    />
  )
}
