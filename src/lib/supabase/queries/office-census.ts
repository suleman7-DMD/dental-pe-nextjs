import type { SupabaseClient } from "@supabase/supabase-js"

// office_census_* — the "does this office exist and operate?" research queue.
// Separate from ownership (ownership_tier) and from the job-hunt website layer.
// Rows are RESEARCH ITEMS, not offices: only a research-ledger decision
// (data/office_census/research_ledger.jsonl) puts a candidate in
// CONFIRMED_OPERATING_GP. Built by scrapers/office_census.py, published by
// scrapers/office_census_publish.py. Protocol: data/office_census/README.md.

export type OfficeCensusQueueState =
  | "CONFIRMED_OPERATING_GP"
  | "NEEDS_CURRENT_VERIFICATION"
  | "IDENTITY_REVIEW"
  | "OPERATING_STATUS_UNRESOLVED"
  | "GP_SCOPE_UNRESOLVED"
  | "LOCATION_INCOMPLETE"
  | "PROBABLE_NON_OFFICE"
  | "LIKELY_SPECIALIST_ONLY"
  | "SOURCE_CANDIDATE_UNREPRESENTED"
  | "EXTERNAL_DISCOVERY"
  | "RESEARCHED_UNRESOLVED"
  | "RESOLVED_EXCLUDED"
  | "RESOLVED_SPLIT"

export type OfficeCensusOrigin =
  | "directory_row"
  | "excluded_row"
  | "data_axle_unrepresented"
  | "nppes_unrepresented"
  | "dso_locator_unrepresented"
  | "external_discovery"

export interface OfficeCensusZipCoverage {
  zip: string
  city: string | null
  pilot: boolean
  stage: "not_started" | "in_progress" | "rows_validated" | "discovery_done" | "recall_audited"
  batch_rank: number
  directory_rows: number
  excluded_rows: number
  source_candidates: number
  external_discoveries: number
  confirmed: number
  needs_verification: number
  identity_review: number
  status_unresolved: number
  gp_scope_unresolved: number
  location_incomplete: number
  probable_non_office: number
  likely_specialist_only: number
  source_unrepresented: number
  external_pending: number
  researched_unresolved: number
  resolved_excluded: number
  dir_with_coords: number
  dir_missing_coords: number
  dir_coords_recoverable: number
  dir_coords_suspect: number
  dir_site_checked_live: number
  dir_prior_web_research: number
  dir_ownership_review_only: number
  dir_no_prior_research: number
  dir_identity_flagged: number
  open_items: number
  review_items: number
  sources_searched: string[]
  last_activity: string | null
  build_id: string
}

export interface OfficeCensusPriorEvidence {
  ownership_census?: { status: string; reviewed_at: string | null; evidence_urls: string[] }
  ai_dossier?: {
    npi: string
    quality: string | null
    researched_at: string | null
    website_url: string | null
    google_review_count: number | null
    google_recent_review: string | null
    urls: string[]
  }
  job_hunt_check?: {
    checked_at: string | null
    website_status: string | null
    website_url: string | null
    verification_status: string | null
    public_name: string | null
    note: string | null
    evidence_urls: string[]
  }
  manual_corrections?: unknown
}

export interface OfficeCensusCandidate {
  candidate_id: string
  zip: string
  city: string | null
  origin: OfficeCensusOrigin
  in_directory: boolean
  location_id: string | null
  name: string | null
  address: string | null
  suite: string | null
  suites_seen: string[]
  phone: string | null
  website: string | null
  entity_classification: string | null
  queue_state: OfficeCensusQueueState
  priority: number
  effort: string
  flags: string[]
  gp_scope_taxonomy: string | null
  provider_count: number | null
  org_npis_at_street: number | null
  phones_at_street: number | null
  da_records_at_street: number | null
  da_latest_update: string | null
  prior_evidence_level: string
  prior_evidence: OfficeCensusPriorEvidence
  source_refs: {
    npis?: string[]
    iusa?: string[]
    data_sources?: string
    da_names?: string[]
    dso?: string[]
    same_phone_rows?: string[]
    address_variant_rows?: string[]
  }
  latitude: number | null
  longitude: number | null
  coord_status: string
  observations: number
  sources_checked: string[]
  decision: Record<string, unknown> | null
  batch_rank: number | null
  build_id: string
}

export interface OfficeCensusBuild {
  build_id: string
  rules_version: string
  built_at: string
  published_at: string
  manifest: {
    scope?: string
    watched_zips?: number
    totals?: {
      candidates: number
      directory_rows: number
      by_origin: Record<string, number>
      by_state: Record<string, number>
      directory_by_state: Record<string, number>
      directory_by_prior_evidence: Record<string, number>
      directory_coord_status: Record<string, number>
      directory_flags: Record<string, number>
      zips_by_stage: Record<string, number>
      ledger_decisions?: number
      ledger_observations?: number
    }
    state_definitions?: Record<string, string>
    ledger_orphans?: number
  }
}

const PAGE = 1000

async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data as T[] | null) ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export async function getOfficeCensusCoverage(
  supabase: SupabaseClient
): Promise<OfficeCensusZipCoverage[]> {
  return fetchAllPages<OfficeCensusZipCoverage>((from, to) =>
    supabase
      .from("office_census_zip_coverage")
      .select("*")
      .order("batch_rank", { ascending: true })
      .order("zip", { ascending: true })
      .range(from, to)
  )
}

export async function getOfficeCensusLatestBuild(
  supabase: SupabaseClient
): Promise<OfficeCensusBuild | null> {
  const { data, error } = await supabase
    .from("office_census_builds")
    .select("build_id,rules_version,built_at,published_at,manifest")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as OfficeCensusBuild | null) ?? null
}

export async function getOfficeCensusCandidatesForZip(
  supabase: SupabaseClient,
  zip: string
): Promise<OfficeCensusCandidate[]> {
  return fetchAllPages<OfficeCensusCandidate>((from, to) =>
    supabase
      .from("office_census_candidates")
      .select("*")
      .eq("zip", zip)
      .order("priority", { ascending: true })
      .order("candidate_id", { ascending: true })
      .range(from, to)
  )
}
