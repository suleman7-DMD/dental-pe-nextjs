// ────────────────────────────────────────────────────────────────────────────
// Core domain types matching the SQLAlchemy models in scrapers/database.py
// ────────────────────────────────────────────────────────────────────────────

export interface Practice {
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
  classification_confidence: number | null
  classification_reasoning: string | null
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
  entity_classification: string | null
  // Computed fields (added client-side)
  job_opp_score?: number
  practice_age?: number
}

export interface Deal {
  id: number
  deal_date: string | null
  pe_sponsor: string | null
  platform_company: string | null
  target_name: string | null
  target_state: string | null
  deal_type: string | null
  specialty: string | null
  deal_size_mm: number | null
  source: string | null
  source_url: string | null
  num_locations: number | null
  notes: string | null
}

export interface PracticeChange {
  id: number
  npi: string
  change_date: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  change_type: string
  created_at: string | null
}

export interface ZipScore {
  zip_code: string
  total_practices: number | null
  independent_count: number | null
  dso_affiliated_count: number | null
  pe_backed_count: number | null
  unknown_count: number | null
  consolidation_pct_of_total: number | null
  dld_gp_per_10k: number | null
  buyable_practice_ratio: number | null
  corporate_share_pct: number | null
  market_type: string | null
  market_type_confidence: string | null
  metrics_confidence: string | null
  data_axle_enrichment_pct: number | null
  people_per_gp_door: number | null
  total_specialist_locations: number | null
}

export interface WatchedZip {
  zip_code: string
  city: string | null
  state: string | null
  metro: string | null
}

export interface DSOLocation {
  id: number
  dso_name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  latitude: number | null
  longitude: number | null
}

export interface ADAHPIBenchmark {
  id: number
  state: string
  career_stage: string
  year: number
  dso_affiliation_rate: number | null
}
