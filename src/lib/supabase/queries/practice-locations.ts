import type { SupabaseClient } from "@supabase/supabase-js"
import type { LaunchpadPracticeRecord } from "@/lib/launchpad/signals"
import type { WarroomPracticeRecord } from "@/lib/warroom/signals"
import {
  GP_LOCATION_CLASSIFICATIONS,
  classifyPractice,
  isGpLocationClassification,
} from "@/lib/constants/entity-classifications"

const PAGE_SIZE = 1000
const PRIMARY_MARKET_STATE = "IL"

export const PRACTICE_LOCATION_SELECT = [
  "location_id",
  "normalized_address",
  "zip",
  "city",
  "state",
  "practice_name",
  "doing_business_as",
  "primary_npi",
  "provider_npis",
  "provider_count",
  "is_likely_residential",
  "entity_classification",
  "ownership_status",
  "affiliated_dso",
  "affiliated_pe_sponsor",
  "buyability_score",
  "classification_confidence",
  "classification_reasoning",
  "latitude",
  "longitude",
  "year_established",
  "employee_count",
  "estimated_revenue",
  "data_axle_enriched",
  "parent_company",
  "ein",
  "website",
  "phone",
  "data_sources",
  "taxonomy_codes",
  "updated_at",
  "ownership_tier",
  "pe_backed",
  "ownership_evidence_basis",
  "ownership_evidence_urls",
  "ownership_confidence",
  "network_id",
  "census_review_status",
].join(",")

export interface PracticeLocationRecord {
  location_id: string
  normalized_address: string | null
  zip: string | null
  city: string | null
  state: string | null
  practice_name: string | null
  doing_business_as: string | null
  primary_npi: string | null
  provider_npis: string | null
  provider_count: number | null
  is_likely_residential: boolean | null
  entity_classification: string | null
  ownership_status: string | null
  affiliated_dso: string | null
  affiliated_pe_sponsor: string | null
  buyability_score: number | null
  classification_confidence: number | null
  classification_reasoning: string | null
  latitude: number | null
  longitude: number | null
  year_established: number | null
  employee_count: number | null
  estimated_revenue: number | null
  data_axle_enriched: boolean | null
  parent_company: string | null
  ein: string | null
  website: string | null
  phone: string | null
  data_sources: string | null
  taxonomy_codes: string | null
  updated_at: string | null
  ownership_tier: string | null
  pe_backed: boolean | null
  ownership_evidence_basis: string | null
  ownership_evidence_urls: string | null
  ownership_confidence: string | null
  network_id: string | null
  census_review_status: string | null
}

export interface PracticeLocationFetchOptions {
  zips?: string[] | null
  includeLegacyMarkets?: boolean
  includeResidential?: boolean
  gpOnly?: boolean
  orderBy?: "practice_name" | "city" | "zip" | "buyability_score" | "updated_at"
  ascending?: boolean
  maxRows?: number
}

function parseFirstTaxonomyCode(value: string | null): string | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.find((item) => typeof item === "string") ?? null
    }
  } catch {
    // Fall through to comma-delimited fallback.
  }
  return value.split(",").map((s) => s.trim()).find(Boolean) ?? null
}

function parseStringArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
    }
  } catch {
    // Fall through to comma-delimited fallback.
  }
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

function stableNumericId(value: string | null | undefined): number {
  const raw = value ?? ""
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Attempts to extract a provider last name from a practice name when no
 * primary_npi is available (location-deduped rows from practice_locations
 * that lack a single canonical NPI). Returns null when the pattern is
 * ambiguous so downstream display falls back to the practice name itself.
 *
 * Recognized patterns (NPPES data is stored in all-caps):
 *   "SMITH DENTAL"      → "Smith"
 *   "SMITH DDS"         → "Smith"
 *   "DR SMITH"          → "Smith"
 *   "DR. SMITH"         → "Smith"
 *   "JOHN SMITH DDS"    → null  (given + last — too ambiguous)
 *   "SMITH AND JONES"   → null  (multi-name group)
 */
function extractLastNameFromPracticeName(name: string | null): string | null {
  if (!name) return null

  const upper = name.trim().toUpperCase()

  // Reject group / brand tokens — no single provider to surface.
  const groupTokens = [" AND ", " & ", " ASSOCIATES", " GROUP", " PARTNERS",
    " FAMILY", " CENTER", " CARE", " CLINIC", " HEALTH", " TEAM",
    " KIDS", " CHILDREN"]
  if (groupTokens.some((t) => upper.includes(t))) return null

  // Pattern 1: "DR LASTNAME" or "DR. LASTNAME" at the start.
  const drPrefix = upper.match(/^DR\.?\s+([A-Z]{2,25})(?:\s|$)/)
  if (drPrefix) return toTitleCase(drPrefix[1])

  // Pattern 2: single-word last name followed by a dental suffix.
  // The leading token must be one word (no space before the suffix) so we
  // don't accidentally grab the last name out of a "JOHN SMITH DDS" string.
  const suffixMatch = upper.match(
    /^([A-Z]{2,25})\s+(?:DDS|DMD|DENTAL|DENTISTRY|ORTHODONTICS|ENDODONTICS|PERIODONTICS|PEDIATRIC|PEDODONTICS)(?:\s|$)/
  )
  if (suffixMatch) return toTitleCase(suffixMatch[1])

  return null
}

function toTitleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export async function fetchPracticeLocations(
  supabase: SupabaseClient,
  options: PracticeLocationFetchOptions = {}
): Promise<PracticeLocationRecord[]> {
  const rows: PracticeLocationRecord[] = []
  const zips = options.zips?.filter(Boolean) ?? null
  let page = 0

  while (options.maxRows == null || rows.length < options.maxRows) {
    const remaining = options.maxRows == null ? PAGE_SIZE : options.maxRows - rows.length
    const size = Math.min(PAGE_SIZE, remaining)
    const from = page * PAGE_SIZE
    const to = from + size - 1

    let query = supabase
      .from("practice_locations")
      .select(PRACTICE_LOCATION_SELECT)

    if (zips && zips.length > 0) {
      query = query.in("zip", zips)
      if (!options.includeLegacyMarkets) {
        query = query.eq("state", PRIMARY_MARKET_STATE)
      }
    } else if (!options.includeLegacyMarkets) {
      query = query.eq("state", PRIMARY_MARKET_STATE)
    }
    if (!options.includeResidential) query = query.or("is_likely_residential.eq.false,is_likely_residential.is.null")
    if (options.gpOnly) {
      query = query.in("entity_classification", [...GP_LOCATION_CLASSIFICATIONS])
    }

    query = query.order(options.orderBy ?? "practice_name", {
      ascending: options.ascending ?? true,
      nullsFirst: false,
    })

    const { data, error } = await query.range(from, to)
    if (error) throw error

    const batch = (data as unknown as PracticeLocationRecord[]) ?? []
    rows.push(...batch)
    if (batch.length < size) break
    page += 1
  }

  return options.maxRows == null ? rows : rows.slice(0, options.maxRows)
}

export async function fetchGpPracticeLocations(
  supabase: SupabaseClient,
  options: Omit<PracticeLocationFetchOptions, "gpOnly"> = {}
): Promise<PracticeLocationRecord[]> {
  return fetchPracticeLocations(supabase, { ...options, gpOnly: true })
}

export async function fetchPracticeLocationById(
  supabase: SupabaseClient,
  locationId: string
): Promise<PracticeLocationRecord | null> {
  const { data, error } = await supabase
    .from("practice_locations")
    .select(PRACTICE_LOCATION_SELECT)
    .eq("location_id", locationId)
    .maybeSingle()

  if (error) throw error
  return (data as unknown as PracticeLocationRecord | null) ?? null
}

/**
 * All locations sharing a census network_id — the practice page's
 * "Network siblings" tab. network_id is census truth (assigned during hand
 * review), so membership here is a reviewed conclusion, never detector output.
 */
export async function fetchNetworkSiblings(
  supabase: SupabaseClient,
  networkId: string,
  excludeLocationId?: string
): Promise<PracticeLocationRecord[]> {
  const { data, error } = await supabase
    .from("practice_locations")
    .select(PRACTICE_LOCATION_SELECT)
    .eq("network_id", networkId)
    .order("city", { ascending: true, nullsFirst: false })
    .order("practice_name", { ascending: true, nullsFirst: false })
    .limit(200)

  if (error) throw error
  const rows = (data as unknown as PracticeLocationRecord[]) ?? []
  return excludeLocationId
    ? rows.filter((row) => row.location_id !== excludeLocationId)
    : rows
}

// PostgREST .or() filter strings treat commas/parens/dots as syntax, so the
// search term is reduced to characters that cannot break out of the pattern.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,().%\\]/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Global search: name / city / ZIP → practice records. ZIP-looking input
 * (3-5 digits) prefix-matches on zip; everything else substring-matches on
 * practice_name, doing_business_as, and city. IL scope, residential rows
 * excluded, capped small — this feeds a typeahead, not an export.
 */
export async function searchPracticeLocations(
  supabase: SupabaseClient,
  term: string,
  limit = 20
): Promise<PracticeLocationRecord[]> {
  const sanitized = sanitizeSearchTerm(term)
  if (sanitized.length < 2) return []

  let query = supabase
    .from("practice_locations")
    .select(PRACTICE_LOCATION_SELECT)
    .eq("state", PRIMARY_MARKET_STATE)
    .or("is_likely_residential.eq.false,is_likely_residential.is.null")

  if (/^\d{3,5}$/.test(sanitized)) {
    query = query.ilike("zip", `${sanitized}%`)
  } else {
    query = query.or(
      [
        `practice_name.ilike.%${sanitized}%`,
        `doing_business_as.ilike.%${sanitized}%`,
        `city.ilike.%${sanitized}%`,
      ].join(",")
    )
  }

  const { data, error } = await query
    .order("practice_name", { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data as unknown as PracticeLocationRecord[]) ?? []
}

export function isGpPracticeLocation(row: Pick<PracticeLocationRecord, "entity_classification">): boolean {
  return isGpLocationClassification(row.entity_classification)
}

export function practiceLocationToLaunchpadRecord(
  row: PracticeLocationRecord
): LaunchpadPracticeRecord {
  return {
    id: stableNumericId(row.location_id),
    location_id: row.location_id,
    npi: row.primary_npi ?? row.location_id,
    provider_npis: parseStringArray(row.provider_npis),
    practice_name: row.practice_name,
    doing_business_as: row.doing_business_as,
    provider_last_name: row.primary_npi ? null : extractLastNameFromPracticeName(row.practice_name),
    address: row.normalized_address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
    website: row.website,
    entity_type: null,
    entity_classification: row.entity_classification,
    ownership_status: row.ownership_status,
    affiliated_dso: row.affiliated_dso,
    affiliated_pe_sponsor: row.affiliated_pe_sponsor,
    buyability_score: row.buyability_score,
    classification_confidence: row.classification_confidence,
    classification_reasoning: row.classification_reasoning,
    latitude: row.latitude,
    longitude: row.longitude,
    year_established: row.year_established,
    employee_count: row.employee_count,
    estimated_revenue: row.estimated_revenue,
    num_providers: row.provider_count,
    taxonomy_code: parseFirstTaxonomyCode(row.taxonomy_codes),
    parent_company: row.parent_company,
    ein: row.ein,
    franchise_name: null,
    data_source: row.data_sources,
    data_axle_import_date: row.data_axle_enriched ? row.updated_at : null,
    updated_at: row.updated_at,
    ownership_tier: row.ownership_tier,
    pe_backed: row.pe_backed,
    ownership_evidence_basis: row.ownership_evidence_basis,
    ownership_evidence_urls: row.ownership_evidence_urls,
    ownership_confidence: row.ownership_confidence,
    network_id: row.network_id,
    census_review_status: row.census_review_status,
  }
}

export function practiceLocationToWarroomRecord(
  row: PracticeLocationRecord
): WarroomPracticeRecord {
  const base = practiceLocationToLaunchpadRecord(row)
  return {
    ...base,
    ownership_group: classifyPractice(
      row.entity_classification,
      row.ownership_status
    ) as WarroomPracticeRecord["ownership_group"],
    location_type: null,
    iusa_number: null,
    taxonomy_description: null,
  }
}
