import type { SupabaseClient } from "@supabase/supabase-js"

// directory_web_checks — the rapid web-check overlay for the Directory page.
// One row per checked location (its latest check), published from the census
// repo's data/office_census/rapid/checks.jsonl by
// scrapers/directory_web_checks_publish.py. It answers "is this row a current
// general-dentistry office, as listed?" — separate from ownership
// (ownership_tier) and from the job-hunt website layer. The page applies it at
// read time; practice_locations itself is never changed by it.

export type WebCheckEffect =
  | "removed"
  | "open_corrected"
  | "open_verified"
  | "listed_only"
  | "needs_review"
  | "no_web_evidence"

export interface WebCheckEvidence {
  kind: string
  url: string
  quote?: string | null
}

export interface WebCheckFields {
  name?: string | null
  address?: string | null
  suite?: string | null
  phone?: string | null
  website?: string | null
  zip?: string | null
}

export interface DirectoryWebCheck {
  location_id: string
  zip: string
  effect: WebCheckEffect
  decision: string
  reason: string | null
  duplicate_of: string | null
  gp_scope: string | null
  /** Fields the check saw differently on the web (applied only for open_corrected). */
  observed: WebCheckFields
  /** What the directory row said when it was checked. */
  as_seen: WebCheckFields
  signals: string[]
  ties_by: string[]
  evidence: WebCheckEvidence[]
  note: string | null
  checked_at: string
}

const SELECT = [
  "location_id",
  "zip",
  "effect",
  "decision",
  "reason",
  "duplicate_of",
  "gp_scope",
  "observed",
  "as_seen",
  "signals",
  "ties_by",
  "evidence",
  "note",
  "checked_at",
].join(",")

/** The whole overlay keyed by location_id (a few thousand rows at most; paginated). */
export async function fetchDirectoryWebCheckMap(
  supabase: SupabaseClient
): Promise<Record<string, DirectoryWebCheck>> {
  const map: Record<string, DirectoryWebCheck> = {}
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("directory_web_checks")
      .select(SELECT)
      .order("location_id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data as unknown as DirectoryWebCheck[]) ?? []
    for (const row of rows) map[row.location_id] = row
    if (rows.length < PAGE) break
  }
  return map
}

/** Overlay failures must never blank the directory: log and render without it. */
export async function fetchDirectoryWebCheckMapSafe(
  supabase: SupabaseClient
): Promise<Record<string, DirectoryWebCheck>> {
  try {
    return await fetchDirectoryWebCheckMap(supabase)
  } catch (e) {
    console.error("fetchDirectoryWebCheckMap failed:", e)
    return {}
  }
}

export async function fetchDirectoryWebCheck(
  supabase: SupabaseClient,
  locationId: string
): Promise<DirectoryWebCheck | null> {
  const { data, error } = await supabase
    .from("directory_web_checks")
    .select(SELECT)
    .eq("location_id", locationId)
    .maybeSingle()
  if (error) {
    console.error("fetchDirectoryWebCheck failed:", error)
    return null
  }
  return (data as unknown as DirectoryWebCheck | null) ?? null
}
