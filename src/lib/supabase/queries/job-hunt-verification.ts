import type { SupabaseClient } from "@supabase/supabase-js"

// job_hunt_verification — the job-hunt website-check layer. One row per
// checked location. This is EXPLICITLY separate from the ownership census
// (ownership_tier / census_review_status) and from Data-Axle staff/revenue
// estimates: it records what the practice's own website says right now,
// with evidence URLs.

export interface JobHuntDoctor {
  name: string
  credential?: string | null
  role?: string | null
  source_url?: string | null
}

export interface JobHuntOpening {
  title?: string | null
  role?: string | null
  url?: string | null
  source_url?: string | null
  notes?: string | null
}

export interface JobHuntVerificationRecord {
  location_id: string
  public_practice_name: string | null
  website_url: string | null
  website_status: "live" | "dead" | "parked" | "social_only" | "none_found"
  doctors: JobHuntDoctor[]
  provider_count_website: number | null
  owner_operator_stated: string | null
  ownership_evidence_status: "consistent" | "conflict" | "no_statement"
  careers_page_url: string | null
  has_hiring_page: boolean
  openings: JobHuntOpening[]
  verification_status:
    | "roster_verified"
    | "hiring_page_found"
    | "call_required"
    | "no_usable_website"
    | "ownership_conflict"
    | "stale_recheck"
  evidence_urls: string[]
  notes: string | null
  last_checked_at: string
  checked_by: string
}

const SELECT = [
  "location_id",
  "public_practice_name",
  "website_url",
  "website_status",
  "doctors",
  "provider_count_website",
  "owner_operator_stated",
  "ownership_evidence_status",
  "careers_page_url",
  "has_hiring_page",
  "openings",
  "verification_status",
  "evidence_urls",
  "notes",
  "last_checked_at",
  "checked_by",
].join(",")

export async function fetchJobHuntVerification(
  supabase: SupabaseClient,
  locationId: string
): Promise<JobHuntVerificationRecord | null> {
  const { data, error } = await supabase
    .from("job_hunt_verification")
    .select(SELECT)
    .eq("location_id", locationId)
    .maybeSingle()

  if (error) throw error
  return (data as unknown as JobHuntVerificationRecord | null) ?? null
}

/**
 * The whole verification layer as a map keyed by location_id. The table only
 * holds hand-verified rows (dozens–hundreds), so one fetch covers every
 * directory/map/drawer consumer.
 */
export async function fetchJobHuntVerificationMap(
  supabase: SupabaseClient
): Promise<Record<string, JobHuntVerificationRecord>> {
  const map: Record<string, JobHuntVerificationRecord> = {}
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("job_hunt_verification")
      .select(SELECT)
      .order("location_id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data as unknown as JobHuntVerificationRecord[]) ?? []
    for (const row of rows) map[row.location_id] = row
    if (rows.length < PAGE) break
  }
  return map
}
