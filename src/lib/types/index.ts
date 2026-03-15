// ────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the Dental PE Intelligence Dashboard
// ────────────────────────────────────────────────────────────────────────────

export interface Deal {
  id: number
  deal_date: string | null
  platform_company: string | null
  pe_sponsor: string | null
  target_name: string | null
  target_state: string | null
  deal_type: string | null
  deal_size_mm: number | null
  specialty: string | null
  source: string | null
  notes: string | null
  created_at: string | null
}

export interface Practice {
  id: number
  npi: string
  practice_name: string | null
  doing_business_as: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  entity_type: string | null
  taxonomy_code: string | null
  ownership_status: string | null
  affiliated_dso: string | null
  affiliated_pe_sponsor: string | null
  buyability_score: number | null
  buyability_confidence: number | null
  classification_confidence: number | null
  classification_reasoning: string | null
  entity_classification: string | null
  data_source: string | null
  latitude: number | null
  longitude: number | null
  parent_company: string | null
  ein: string | null
  franchise_name: string | null
  iusa_number: string | null
  website: string | null
  year_established: number | null
  employee_count: number | null
  estimated_revenue: number | null
  num_providers: number | null
  location_type: string | null
  import_batch_id: string | null
  data_axle_import_date: string | null
  taxonomy_description: string | null
  enumeration_date: string | null
  last_updated: string | null
  data_axle_raw_name: string | null
  raw_record_count: number | null
  parent_iusa: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  provider_last_name: string | null
}

export interface WatchedZip {
  id: number
  zip_code: string
  city: string | null
  state: string | null
  metro_area: string | null
  population: number | null
  median_household_income: number | null
}

export interface ZipScore {
  id: number
  zip_code: string
  total_practices: number | null
  independent_count: number | null
  dso_affiliated_count: number | null
  pe_backed_count: number | null
  unknown_count: number | null
  consolidation_score?: number | null
  total_gp_locations: number | null
  total_specialist_locations: number | null
  dld_gp_per_10k: number | null
  buyable_practice_ratio: number | null
  corporate_share_pct: number | null
  people_per_gp_door: number | null
  market_type: string | null
  metrics_confidence: string | null
  market_type_confidence: string | null
  data_axle_enrichment_pct: number | null
}

export interface PracticeChange {
  id: number
  npi: string
  change_date: string | null
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  change_type: string | null
  notes: string | null
}

export interface DSOLocation {
  id: number
  dso_name: string | null
  office_name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website: string | null
  scraped_at: string | null
}

export interface ADAHPIBenchmark {
  id: number
  data_year: number | null
  state: string | null
  career_stage: string | null
  dso_affiliation_rate: number | null
  created_at: string | null
}

export interface PipelineEvent {
  timestamp: string
  source: string
  status: string
  summary: string
  details: {
    new_records?: number
    duration_seconds?: number
    [key: string]: unknown
  }
}

export interface HomeSummary {
  totalDeals: number
  ytdDeals: number
  activeSponsors: number
  totalPractices: number
  consolidatedPct: string
  independentPct: string
  watchedZips: number
  lastPipelineRun: string | null
  retirementRisk: number
  recentDeals: Deal[]
}
