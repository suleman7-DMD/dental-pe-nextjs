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

export interface WarroomPracticeSignalRecord {
  npi: string;
  practice_id: number | null;
  zip_code: string;
  practice_name: string | null;
  city: string | null;
  state: string | null;
  entity_classification: string | null;
  ownership_status: string | null;
  buyability_score: number | null;
  stealth_dso_flag: boolean;
  stealth_dso_cluster_id: string | null;
  stealth_dso_cluster_size: number | null;
  stealth_dso_zip_count: number | null;
  stealth_dso_basis: string | null;
  stealth_dso_reasoning: string | null;
  phantom_inventory_flag: boolean;
  phantom_inventory_reasoning: string | null;
  revenue_default_flag: boolean;
  revenue_default_reasoning: string | null;
  family_dynasty_flag: boolean;
  family_dynasty_reasoning: string | null;
  micro_cluster_flag: boolean;
  micro_cluster_id: string | null;
  micro_cluster_size: number | null;
  micro_cluster_reasoning: string | null;
  intel_quant_disagreement_flag: boolean;
  intel_quant_disagreement_type: string | null;
  intel_quant_disagreement_reasoning: string | null;
  retirement_combo_score: number | null;
  retirement_combo_flag: boolean;
  retirement_combo_reasoning: string | null;
  deal_catchment_24mo: number | null;
  deal_catchment_reasoning: string | null;
  last_change_90d_flag: boolean;
  last_change_date: string | null;
  last_change_type: string | null;
  last_change_reasoning: string | null;
  buyability_pctile_zip_class: number | null;
  buyability_pctile_class: number | null;
  retirement_pctile_zip_class: number | null;
  retirement_pctile_class: number | null;
  high_peer_buyability_flag: boolean;
  high_peer_retirement_flag: boolean;
  peer_percentile_reasoning: string | null;
  zip_white_space_flag: boolean;
  zip_compound_demand_flag: boolean;
  zip_contested_zone_flag: boolean;
  zip_ada_benchmark_gap_flag: boolean;
  data_limitations: string | null;
  created_at: string | null;
}

export interface WarroomZipSignalRecord {
  zip_code: string;
  city: string | null;
  state: string | null;
  metro_area: string | null;
  population: number | null;
  total_practices: number | null;
  total_gp_locations: number | null;
  total_specialist_locations: number | null;
  dld_gp_per_10k: number | null;
  people_per_gp_door: number | null;
  corporate_share_pct: number | null;
  buyable_practice_ratio: number | null;
  stealth_dso_practice_count: number | null;
  stealth_dso_cluster_count: number | null;
  phantom_inventory_count: number | null;
  phantom_inventory_pct: number | null;
  revenue_default_count: number | null;
  family_dynasty_count: number | null;
  micro_cluster_count: number | null;
  micro_cluster_practice_count: number | null;
  intel_quant_disagreement_count: number | null;
  retirement_combo_high_count: number | null;
  last_change_90d_count: number | null;
  deal_count_all_time: number | null;
  deal_count_24mo: number | null;
  deal_catchment_sum_24mo: number | null;
  deal_catchment_max_24mo: number | null;
  compound_demand_flag: boolean;
  compound_demand_score: number | null;
  compound_demand_reasoning: string | null;
  mirror_pair_flag: boolean;
  mirror_pair_count: number | null;
  top_mirror_zip: string | null;
  top_mirror_similarity: number | null;
  top_mirror_corporate_gap_pp: number | null;
  mirror_zips_json: string | null;
  mirror_reasoning: string | null;
  white_space_flag: boolean;
  white_space_score: number | null;
  white_space_reasoning: string | null;
  contested_zone_flag: boolean;
  contested_platform_count: number | null;
  contested_platforms_json: string | null;
  contested_zone_reasoning: string | null;
  ada_benchmark_pct: number | null;
  ada_benchmark_gap_pp: number | null;
  ada_benchmark_gap_flag: boolean;
  ada_benchmark_reasoning: string | null;
  high_peer_buyability_count: number | null;
  high_peer_retirement_count: number | null;
  data_limitations: string | null;
  created_at: string | null;
}

export interface WarroomSignalCounts {
  stealthDsoPractices: number;
  stealthDsoClusters: number;
  phantomInventoryPractices: number;
  familyDynastyPractices: number;
  microClusterPractices: number;
  microClusters: number;
  intelDisagreements: number;
  retirementComboHigh: number;
  recentChanges90d: number;
  whiteSpaceZips: number;
  compoundDemandZips: number;
  mirrorPairZips: number;
  contestedZips: number;
  adaGapZips: number;
  totalFlaggedPractices: number;
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
  signalCounts: WarroomSignalCounts | null;
  corporateHighConfidence: number;
  corporateHighConfidencePct: number;
  avgBuyabilityScore: number | null;
  avgOpportunityScore: number | null;
}

export interface WarroomTargetCandidate {
  practice: WarroomPracticeRecord;
  signal: WarroomPracticeSignalRecord | null;
  zipSignal: WarroomZipSignalRecord | null;
  zipScore: WarroomZipScoreRecord | null;
}

export interface WarroomScoreComponent {
  label: string;
  weight: number;
  contribution: number;
  reasoning: string;
}

export interface RankedTarget {
  npi: string;
  practiceName: string;
  city: string | null;
  zip: string | null;
  ownershipGroup: OwnershipGroup;
  entityClassification: string | null;
  buyabilityScore: number | null;
  yearEstablished: number | null;
  employeeCount: number | null;
  numProviders: number | null;
  estimatedRevenue: number | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  rank: number;
  tier: "hot" | "warm" | "cool" | "cold";
  flagCount: number;
  flags: string[];
  components: WarroomScoreComponent[];
  headline: string;
  candidate: WarroomTargetCandidate;
}

export type WarroomBriefingSeverity = "critical" | "high" | "medium" | "info";

export interface WarroomBriefingItem {
  id: string;
  severity: WarroomBriefingSeverity;
  title: string;
  detail: string;
  lens?: string;
  action?: { label: string; href?: string; intentHint?: string };
  metric?: { label: string; value: string | number; unit?: string };
}

export interface WarroomIntentFilter {
  scope: "chicagoland" | "west_loop_south_loop" | "woodridge" | "bolingbrook" | null;
  zipCodes: string[];
  subzones: string[];
  ownershipGroups: OwnershipGroup[];
  entityClassifications: string[];
  minBuyability: number | null;
  maxBuyability: number | null;
  minYearEstablished: number | null;
  maxYearEstablished: number | null;
  minEmployees: number | null;
  maxEmployees: number | null;
  requireFlags: string[];
  excludeFlags: string[];
  requirePeBacked: boolean | null;
  dsoNames: string[];
  peSponsorNames: string[];
  retirementRiskOnly: boolean;
  acquisitionTargetsOnly: boolean;
  limit: number | null;
}

export interface WarroomIntent {
  rawText: string;
  normalized: string;
  filter: WarroomIntentFilter;
  chips: { id: string; label: string; key: keyof WarroomIntentFilter }[];
  warnings: string[];
  recognizedTokens: string[];
}

export interface WarroomSitrepBundle {
  scope: {
    id: string;
    kind: WarroomScopeKind;
    label: string;
    zipCodes: string[] | null;
    zipCount: number;
  };
  generatedAt: string;
  summary: WarroomSummary;
  zipScores: WarroomZipScoreRecord[];
  zipSignals: WarroomZipSignalRecord[];
  recentDeals: WarroomDealRecord[];
  recentChanges: WarroomChangeRecord[];
  topSignals: {
    stealthClusters: WarroomPracticeSignalRecord[];
    phantomInventory: WarroomPracticeSignalRecord[];
    retirementCombo: WarroomPracticeSignalRecord[];
    intelDisagreements: WarroomPracticeSignalRecord[];
    familyDynasties: WarroomPracticeSignalRecord[];
    microClusters: WarroomPracticeSignalRecord[];
  };
  rankedTargets: RankedTarget[];
  briefing: WarroomBriefingItem[];
  dataHealth: {
    signalsAvailable: boolean;
    signalsError: string | null;
    practicesFetched: number;
    lastSignalComputed: string | null;
    lastZipScored: string | null;
    warnings: string[];
  };
}
