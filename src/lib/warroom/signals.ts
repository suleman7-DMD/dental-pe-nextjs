import type { WarroomScopeKind } from "./scope";

export type OwnershipGroup =
  | "independent"
  | "corporate"
  | "specialist"
  | "non_clinical"
  | "unknown";

export interface WarroomOwnershipCounts {
  total: number;
  independent: number;
  corporate: number;
  specialist: number;
  nonClinical: number;
  unknown: number;
  known: number;
  corporatePct: number;
  independentPct: number;
  unknownPct: number;
}

export interface WarroomPracticeRecord {
  id: number;
  npi: string;
  practice_name: string | null;
  doing_business_as: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  entity_classification: string | null;
  ownership_status: string | null;
  ownership_group: OwnershipGroup;
  affiliated_dso: string | null;
  affiliated_pe_sponsor: string | null;
  buyability_score: number | null;
  classification_confidence: number | null;
  classification_reasoning: string | null;
  latitude: number | null;
  longitude: number | null;
  year_established: number | null;
  employee_count: number | null;
  estimated_revenue: number | null;
  num_providers: number | null;
  location_type: string | null;
  data_source: string | null;
  data_axle_import_date: string | null;
  parent_company: string | null;
  ein: string | null;
  franchise_name: string | null;
  iusa_number: string | null;
  taxonomy_code: string | null;
  taxonomy_description: string | null;
  updated_at: string | null;
}

export interface WarroomDealRecord {
  id: number;
  deal_date: string | null;
  platform_company: string | null;
  pe_sponsor: string | null;
  target_name: string | null;
  target_city: string | null;
  target_state: string | null;
  target_zip: string | null;
  deal_type: string | null;
  deal_size_mm: number | null;
  ebitda_multiple: number | null;
  specialty: string | null;
  num_locations: number | null;
  source: string | null;
  source_url: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WarroomZipScoreRecord {
  id: number;
  zip_code: string;
  city: string | null;
  state: string | null;
  metro_area: string | null;
  total_practices: number | null;
  total_gp_locations: number | null;
  total_specialist_locations: number | null;
  independent_count: number | null;
  dso_affiliated_count: number | null;
  pe_backed_count: number | null;
  unknown_count: number | null;
  consolidated_count: number | null;
  consolidation_pct_of_total: number | null;
  independent_pct_of_total: number | null;
  pe_penetration_pct: number | null;
  pct_unknown: number | null;
  dld_gp_per_10k: number | null;
  dld_total_per_10k: number | null;
  people_per_gp_door: number | null;
  buyable_practice_count: number | null;
  buyable_practice_ratio: number | null;
  corporate_location_count: number | null;
  corporate_share_pct: number | null;
  corporate_highconf_count: number | null;
  family_practice_count: number | null;
  recent_changes_90d: number | null;
  state_deal_count_12m: number | null;
  opportunity_score: number | null;
  market_type: string | null;
  metrics_confidence: string | null;
  market_type_confidence: string | null;
  entity_classification_coverage_pct: number | null;
  data_axle_enrichment_pct: number | null;
  score_date: string | null;
}

export interface WarroomChangeRecord {
  id: number;
  npi: string;
  change_date: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  change_type: string | null;
  notes: string | null;
  created_at: string | null;
  practice_name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface WarroomSummary {
  scopeKind: WarroomScopeKind;
  scopeLabel: string;
  zipCodes: string[] | null;
  generatedAt: string;
  ownership: WarroomOwnershipCounts;
  enrichedPractices: number;
  enrichedPct: number;
  acquisitionTargets: number;
  retirementRisk: number;
  dealCount: number;
  latestDealDate: string | null;
  zipScoreCount: number;
  averageCorporateSharePct: number | null;
  changeCount: number;
  changeCount90d: number;
}

