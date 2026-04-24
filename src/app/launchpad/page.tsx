import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getLaunchpadBundle } from "@/lib/supabase/queries/launchpad"
import { DEFAULT_LAUNCHPAD_SCOPE } from "@/lib/launchpad/scope"
import { DEFAULT_LAUNCHPAD_TRACK } from "@/lib/launchpad/signals"
import { LaunchpadShell } from "./_components/launchpad-shell"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Launchpad | Dental PE Intelligence",
  description:
    "Launchpad — your first-job copilot. Ranked dental practices for new grads by succession, high-volume, and DSO track.",
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    const extras = Object.getOwnPropertyNames(error)
      .filter((key) => key !== "stack" && key !== "message" && key !== "name")
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (error as unknown as Record<string, unknown>)[key]
        return acc
      }, {})
    const extrasStr = Object.keys(extras).length
      ? ` | ${JSON.stringify(extras)}`
      : ""
    return `${error.name}: ${error.message}${extrasStr}`
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error)
    } catch {
      return Object.prototype.toString.call(error)
    }
  }
  return String(error)
}

export default async function LaunchpadPage() {
  const supabase = getSupabaseServerClient()
  try {
    const bundle = await getLaunchpadBundle({
      scope: DEFAULT_LAUNCHPAD_SCOPE,
      track: DEFAULT_LAUNCHPAD_TRACK,
      supabase,
    })
    return <LaunchpadShell initialBundle={bundle} />
  } catch (error) {
    console.error("[launchpad/page] getLaunchpadBundle failed:", error)
    return (
      <LaunchpadShell
        initialBundle={null}
        initialBundleError={serializeError(error)}
      />
    )
  }
}
