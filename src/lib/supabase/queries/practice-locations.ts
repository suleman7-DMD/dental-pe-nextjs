import type { SupabaseClient } from "@supabase/supabase-js"
import type { LaunchpadPracticeRecord } from "@/lib/launchpad/signals"
import type { WarroomPracticeRecord } from "@/lib/warroom/signals"
import { classifyPractice } from "@/lib/constants/entity-classifications"

const PAGE_SIZE = 1000

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
}

export interface PracticeLocationFetchOptions {
  zips?: string[] | null
  includeResidential?: boolean
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

    if (zips && zips.length > 0) query = query.in("zip", zips)
    if (!options.includeResidential) query = query.eq("is_likely_residential", false)

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

export function practiceLocationToLaunchpadRecord(
  row: PracticeLocationRecord
): LaunchpadPracticeRecord {
  return {
    id: stableNumericId(row.location_id),
    npi: row.primary_npi ?? row.location_id,
    provider_npis: parseStringArray(row.provider_npis),
    practice_name: row.practice_name,
    doing_business_as: row.doing_business_as,
    provider_last_name: null,
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
