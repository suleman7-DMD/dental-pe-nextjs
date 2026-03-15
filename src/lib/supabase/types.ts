/* ─── Supabase / Postgres table types ─────────────────────────────────────
 * These match the SQLAlchemy models in scrapers/database.py exactly.
 * Column names use snake_case to mirror the Postgres schema.
 * ──────────────────────────────────────────────────────────────────────── */

export interface Deal {
  id: number;
  deal_date: string | null;
  platform_company: string;
  pe_sponsor: string | null;
  target_name: string | null;
  target_city: string | null;
  target_state: string | null;
  target_zip: string | null;
  deal_type: string | null; // buyout, add-on, recapitalization, growth, de_novo, partnership, other
  deal_size_mm: number | null;
  ebitda_multiple: number | null;
  specialty: string | null;
  num_locations: number | null;
  source: string;
  source_url: string | null;
  notes: string | null;
  raw_text: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Practice {
  id: number;
  npi: string;
  practice_name: string | null;
  doing_business_as: string | null;
  entity_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  taxonomy_code: string | null;
  taxonomy_description: string | null;
  enumeration_date: string | null;
  last_updated: string | null;
  ownership_status: string | null; // independent, dso_affiliated, pe_backed, unknown
  affiliated_dso: string | null;
  affiliated_pe_sponsor: string | null;
  notes: string | null;
  data_source: string | null; // nppes, data_axle, manual
  latitude: number | null;
  longitude: number | null;
  year_established: number | null;
  employee_count: number | null;
  estimated_revenue: number | null;
  num_providers: number | null;
  location_type: string | null;
  buyability_score: number | null;
  buyability_confidence: number | null;
  classification_confidence: number | null;
  classification_reasoning: string | null;
  data_axle_raw_name: string | null;
  data_axle_import_date: string | null;
  raw_record_count: number | null;
  import_batch_id: string | null;
  parent_company: string | null;
  parent_iusa: string | null;
  ein: string | null;
  franchise_name: string | null;
  iusa_number: string | null;
  website: string | null;
  provider_last_name: string | null;
  entity_classification: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PracticeChange {
  id: number;
  npi: string;
  change_date: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  change_type: string | null; // acquisition, name_change, relocation, closure, new_practice, unknown
  notes: string | null;
  created_at: string | null;
}

export interface ZipScore {
  id: number;
  zip_code: string;
  city: string | null;
  state: string | null;
  metro_area: string | null;
  total_practices: number | null;
  pe_backed_count: number | null;
  dso_affiliated_count: number | null;
  independent_count: number | null;
  unknown_count: number | null;
  institutional_count: number | null;
  raw_npi_count: number | null;
  classified_count: number | null;
  consolidation_pct: number | null;
  consolidation_pct_of_total: number | null;
  independent_pct_of_total: number | null;
  pe_penetration_pct: number | null;
  pct_unknown: number | null;
  recent_changes_90d: number | null;
  state_deal_count_12m: number | null;
  score_date: string | null;
  opportunity_score: number | null;
  data_confidence: string | null;
  consolidated_count: number | null;
  unclassified_pct: number | null;
  // Saturation metrics
  total_gp_locations: number | null;
  total_specialist_locations: number | null;
  dld_gp_per_10k: number | null;
  dld_total_per_10k: number | null;
  people_per_gp_door: number | null;
  // Ownership structure
  buyable_practice_count: number | null;
  buyable_practice_ratio: number | null;
  corporate_location_count: number | null;
  corporate_share_pct: number | null;
  family_practice_count: number | null;
  specialist_density_flag: boolean | null;
  // Data quality
  entity_classification_coverage_pct: number | null;
  data_axle_enrichment_pct: number | null;
  metrics_confidence: string | null;
  // Market classification
  market_type: string | null;
  market_type_confidence: string | null;
  // Compatibility with lib/types ZipScore
  consolidation_score?: number | null;
}

export interface WatchedZip {
  id: number;
  zip_code: string;
  city: string | null;
  state: string | null;
  metro_area: string | null;
  notes: string | null;
  population: number | null;
  median_household_income: number | null;
  population_growth_pct: number | null;
  demographics_updated_at: string | null;
}

export interface DSOLocation {
  id: number;
  dso_name: string;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  scraped_at: string | null;
  source_url: string | null;
}

export interface ADAHPIBenchmark {
  id: number;
  data_year: number;
  state: string;
  career_stage: string; // all, early_career_lt10, mid_career_10_25, late_career_gt25
  total_dentists: number | null;
  pct_dso_affiliated: number | null;
  pct_solo_practice: number | null;
  pct_group_practice: number | null;
  pct_large_group_10plus: number | null;
  source_file: string | null;
  created_at: string | null;
}

export interface PESponsor {
  id: number;
  name: string;
  also_known_as: string | null;
  hq_city: string | null;
  hq_state: string | null;
  aum_estimate_bn: number | null;
  healthcare_focus: boolean | null;
  notes: string | null;
}

export interface Platform {
  id: number;
  name: string;
  pe_sponsor_name: string | null;
  hq_state: string | null;
  estimated_locations: number | null;
  states_active: string | null;
  specialties: string | null;
  founded_year: number | null;
  notes: string | null;
}

export interface ZipOverview {
  id: number;
  zip_code: string;
  overview_html: string | null;
  created_at: string | null;
}

/* ─── Filter types ────────────────────────────────────────────────────── */

export interface DealFilters {
  deal_type?: string;
  pe_sponsor?: string;
  target_state?: string;
  source?: string;
  year?: number;
  search?: string;
}

export interface PracticeFilters {
  zip_codes?: string[];
  ownership_status?: string;
  entity_classification?: string;
  search?: string;
  has_coordinates?: boolean;
}

/* ─── Aggregation result types ────────────────────────────────────────── */

export interface DealStats {
  total_deals: number;
  by_deal_type: Record<string, number>;
  by_state: Record<string, number>;
  avg_deal_size_mm: number | null;
  avg_ebitda_multiple: number | null;
  unique_pe_sponsors: number;
  // Extended fields used by deal-flow page
  deals: Deal[];
  distinctSponsors: string[];
  distinctPlatforms: string[];
  distinctStates: string[];
  distinctSpecialties: string[];
  distinctSources: string[];
  distinctTypes: string[];
  // Extended fields used by home page
  totalDeals: number;
  ytdDeals: number;
  activeSponsors: number;
}

export interface OwnershipBreakdown {
  independent: number;
  dso_affiliated: number;
  pe_backed: number;
  unknown: number;
  total: number;
}

export interface DataFreshness {
  total_practices: number;
  enriched_count: number;
  total_deals: number;
  total_watched_zips: number;
  last_deal_date: string | null;
  last_practice_update: string | null;
}

/** Tiered practice stats returned by getPracticeStats() */
export interface PracticeStats {
  totalPractices: number;
  total: number;
  corporate: number;
  corporateHighConf: number;
  independent: number;
  unknown: number;
  enriched: number;
  consolidatedPct: string;
  independentPct: string;
}
