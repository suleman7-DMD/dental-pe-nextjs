import type { LaunchpadScope } from "./scope"

export type LaunchpadTrack = "succession" | "high_volume" | "dso" | "all"
export type ConcreteLaunchpadTrack = Exclude<LaunchpadTrack, "all">

export const LAUNCHPAD_TRACKS: LaunchpadTrack[] = ["all", "succession", "high_volume", "dso"]
export const CONCRETE_LAUNCHPAD_TRACKS: ConcreteLaunchpadTrack[] = ["succession", "high_volume", "dso"]

export const LAUNCHPAD_TRACK_LABELS: Record<LaunchpadTrack, string> = {
  all: "All tracks",
  succession: "Succession / Apprentice",
  high_volume: "High-volume ethical",
  dso: "DSO associate",
}

export const LAUNCHPAD_TRACK_SHORT_LABELS: Record<LaunchpadTrack, string> = {
  all: "All",
  succession: "Succession",
  high_volume: "High-volume",
  dso: "DSO",
}

export const LAUNCHPAD_TRACK_DESCRIPTIONS: Record<LaunchpadTrack, string> = {
  all: "Explore mode — compute best-fit across all three tracks",
  succession:
    "Apprentice to owner — mentor-rich solo practices with retirement runway and buyability signal",
  high_volume:
    "Fast clinical reps — busy private or group practices with high insurance mix and 3-5 providers",
  dso: "Structured associate role with benefits — rated by DSO tier (Tier 1/2 preferred)",
}

export const DEFAULT_LAUNCHPAD_TRACK: LaunchpadTrack = "all"

export type LaunchpadTier = "best_fit" | "strong" | "maybe" | "low" | "avoid"

export const LAUNCHPAD_TIERS: LaunchpadTier[] = ["best_fit", "strong", "maybe", "low", "avoid"]

export const LAUNCHPAD_TIER_LABELS: Record<LaunchpadTier, string> = {
  best_fit: "Best fit",
  strong: "Strong fit",
  maybe: "Maybe",
  low: "Low fit",
  avoid: "Avoid",
}

export const LAUNCHPAD_TIER_THRESHOLDS: Record<LaunchpadTier, { min: number; max: number }> = {
  best_fit: { min: 80, max: 100 },
  strong: { min: 65, max: 79 },
  maybe: { min: 50, max: 64 },
  low: { min: 35, max: 49 },
  avoid: { min: 0, max: 34 },
}

export type LaunchpadSignalId =
  | "mentor_rich_signal"
  | "succession_track_signal"
  | "hiring_now_signal"
  | "high_volume_ethical_signal"
  | "boutique_solo_signal"
  | "ffs_concierge_signal"
  | "tech_modern_signal"
  | "community_dso_signal"
  | "mentor_density_zip_signal"
  | "commutable_signal"
  | "growing_undersupplied_signal"
  | "succession_published_signal"
  | "dso_avoid_warning"
  | "family_dynasty_warning"
  | "ghost_practice_warning"
  | "recent_acquisition_warning"
  | "associate_saturated_signal"
  | "medicaid_mill_warning"
  | "non_compete_radius_warning"
  | "pe_recap_volatility_warning"

export type LaunchpadSignalCategory = "opportunity" | "warning" | "context"

export interface LaunchpadSignalDefinition {
  id: LaunchpadSignalId
  label: string
  shortLabel: string
  category: LaunchpadSignalCategory
  baseWeight: number
  description: string
  requiresIntel?: boolean
}

export const LAUNCHPAD_SIGNALS: Record<LaunchpadSignalId, LaunchpadSignalDefinition> = {
  mentor_rich_signal: {
    id: "mentor_rich_signal",
    label: "Mentor-rich",
    shortLabel: "Mentor",
    category: "opportunity",
    baseWeight: 25,
    description:
      "Solo practitioner, 25+ years in business, at least two staff members — retirement runway with mentorship capacity.",
  },
  succession_track_signal: {
    id: "succession_track_signal",
    label: "Succession track",
    shortLabel: "Succession",
    category: "opportunity",
    baseWeight: 30,
    description:
      "Mentor-rich owner who is still a sole provider and has a strong buyability score — classic apprentice-to-owner setup.",
  },
  hiring_now_signal: {
    id: "hiring_now_signal",
    label: "Hiring now",
    shortLabel: "Hiring",
    category: "opportunity",
    baseWeight: 20,
    description: "Active associate opening detected via website, Google listing, or AI research.",
    requiresIntel: true,
  },
  high_volume_ethical_signal: {
    id: "high_volume_ethical_signal",
    label: "High-volume ethical",
    shortLabel: "High-volume",
    category: "opportunity",
    baseWeight: 20,
    description:
      "Busy private/group practice with stable income mix, 5+ employees, not corporate — maximum clinical reps without DSO pressure.",
  },
  boutique_solo_signal: {
    id: "boutique_solo_signal",
    label: "Boutique solo",
    shortLabel: "Boutique",
    category: "opportunity",
    baseWeight: 25,
    description:
      "High-volume solo practice with $1M+ revenue and modern technology (CBCT, iTero) — premium clinical environment.",
  },
  ffs_concierge_signal: {
    id: "ffs_concierge_signal",
    label: "FFS / Concierge",
    shortLabel: "FFS",
    category: "opportunity",
    baseWeight: 15,
    description:
      "Fee-for-service or concierge insurance mix — typically higher per-procedure margin and premium patient base.",
    requiresIntel: true,
  },
  tech_modern_signal: {
    id: "tech_modern_signal",
    label: "Tech modern",
    shortLabel: "Tech",
    category: "opportunity",
    baseWeight: 10,
    description: "High technology level (CBCT, iTero, intraoral scanner) detected by AI research.",
    requiresIntel: true,
  },
  community_dso_signal: {
    id: "community_dso_signal",
    label: "Community DSO",
    shortLabel: "Tier 1/2 DSO",
    category: "opportunity",
    baseWeight: 18,
    description:
      "Affiliated with a Tier 1 or Tier 2 DSO (Mortenson, MB2, PDS, Benevis) — structured benefits + mentorship.",
  },
  mentor_density_zip_signal: {
    id: "mentor_density_zip_signal",
    label: "Mentor-rich ZIP",
    shortLabel: "Dense ZIP",
    category: "opportunity",
    baseWeight: 12,
    description: "ZIP has 5+ mentor-rich practices and low corporate share — plenty of fallback options nearby.",
  },
  commutable_signal: {
    id: "commutable_signal",
    label: "Commutable",
    shortLabel: "Commute",
    category: "context",
    baseWeight: 20,
    description: "ZIP is in the selected living location's commutable ZIP list.",
  },
  growing_undersupplied_signal: {
    id: "growing_undersupplied_signal",
    label: "Growing undersupplied",
    shortLabel: "Growing",
    category: "opportunity",
    baseWeight: 10,
    description: "ZIP market type is growing_undersupplied with medium/high confidence — tailwind for associate demand.",
  },
  succession_published_signal: {
    id: "succession_published_signal",
    label: "Succession published",
    shortLabel: "Published",
    category: "opportunity",
    baseWeight: 15,
    description:
      "Owner has published succession intent (AI research detected active-seeking language or broker listing).",
    requiresIntel: true,
  },
  dso_avoid_warning: {
    id: "dso_avoid_warning",
    label: "DSO avoid-tier",
    shortLabel: "Avoid DSO",
    category: "warning",
    baseWeight: -40,
    description:
      "Affiliated with an AVOID-tier DSO (Aspen, Sage, Western, Smile Brands, Risas) — documented patient-harm or churn patterns.",
  },
  family_dynasty_warning: {
    id: "family_dynasty_warning",
    label: "Family dynasty",
    shortLabel: "Family",
    category: "warning",
    baseWeight: -15,
    description:
      "Shared last name at the address suggests internal succession — new grad likely a placeholder role.",
  },
  ghost_practice_warning: {
    id: "ghost_practice_warning",
    label: "Ghost practice",
    shortLabel: "Ghost",
    category: "warning",
    baseWeight: -30,
    description: "Solo-inactive classification — no phone and no website. Likely retired or dormant.",
  },
  recent_acquisition_warning: {
    id: "recent_acquisition_warning",
    label: "Recently acquired",
    shortLabel: "Recent DSO",
    category: "warning",
    baseWeight: -20,
    description:
      "Ownership flipped to DSO-affiliated in the past 18 months — expect contract and comp churn.",
  },
  associate_saturated_signal: {
    id: "associate_saturated_signal",
    label: "Associate-saturated",
    shortLabel: "Saturated",
    category: "warning",
    baseWeight: -10,
    description:
      "Large group with 5+ providers — less mentorship time per associate at this scale.",
  },
  medicaid_mill_warning: {
    id: "medicaid_mill_warning",
    label: "Medicaid mill risk",
    shortLabel: "Medicaid mill",
    category: "warning",
    baseWeight: -15,
    description:
      "Medicaid-heavy + low-income ZIP + high Google-review velocity — high-throughput production pressure.",
    requiresIntel: true,
  },
  non_compete_radius_warning: {
    id: "non_compete_radius_warning",
    label: "Non-compete risk",
    shortLabel: "Non-compete",
    category: "warning",
    baseWeight: -25,
    description:
      "Tier 3 or AVOID DSO — documented aggressive non-compete enforcement (IL courts uphold 10–25mi / up to 2 years).",
  },
  pe_recap_volatility_warning: {
    id: "pe_recap_volatility_warning",
    label: "PE recap volatility",
    shortLabel: "PE volatile",
    category: "warning",
    baseWeight: -15,
    description:
      "PE-sponsor-backed with a deal in the past 12 months — ownership churn typically disrupts associate comp.",
  },
}

export const SIGNALS_REQUIRING_INTEL: LaunchpadSignalId[] = [
  "hiring_now_signal",
  "succession_published_signal",
  "tech_modern_signal",
  "ffs_concierge_signal",
  "medicaid_mill_warning",
]

export interface LaunchpadPracticeRecord {
  id: number
  npi: string
  practice_name: string | null
  doing_business_as: string | null
  provider_last_name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website: string | null
  entity_type: string | null
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
  num_providers: number | null
  taxonomy_code: string | null
  parent_company: string | null
  ein: string | null
  franchise_name: string | null
  data_source: string | null
  data_axle_import_date: string | null
  updated_at: string | null
}

export interface LaunchpadPracticeIntelRecord {
  npi: string
  research_date: string | null
  hiring_active: number | boolean | null
  owner_career_stage: string | null
  accepts_medicaid: number | boolean | null
  ppo_heavy: number | boolean | null
  technology_level: string | null
  google_rating: number | null
  google_velocity: string | null
  red_flags: string[] | null
  green_flags: string[] | null
  acquisition_readiness: string | null
  confidence: string | null
  overall_assessment: string | null
  raw_json: Record<string, unknown> | null
}

export interface LaunchpadZipScoreRecord {
  zip_code: string
  city: string | null
  state: string | null
  metro_area: string | null
  population: number | null
  median_household_income: number | null
  total_practices: number | null
  total_gp_locations: number | null
  total_specialist_locations: number | null
  dld_gp_per_10k: number | null
  people_per_gp_door: number | null
  buyable_practice_ratio: number | null
  corporate_share_pct: number | null
  corporate_highconf_count: number | null
  market_type: string | null
  metrics_confidence: string | null
  opportunity_score: number | null
  score_date: string | null
}

export interface LaunchpadRecentDealRecord {
  id: number
  deal_date: string | null
  platform_company: string | null
  pe_sponsor: string | null
  target_name: string | null
  target_city: string | null
  target_zip: string | null
}

export interface LaunchpadSignalContribution {
  signalId: LaunchpadSignalId
  label: string
  category: LaunchpadSignalCategory
  baseWeight: number
  multiplier: number
  contribution: number
  reasoning: string
}

export interface LaunchpadTrackScore {
  track: ConcreteLaunchpadTrack
  score: number
  rawScore: number
  tier: LaunchpadTier
  contributions: LaunchpadSignalContribution[]
  confidenceCapped: boolean
}

export interface LaunchpadRankedTarget {
  npi: string
  practice: LaunchpadPracticeRecord
  intel: LaunchpadPracticeIntelRecord | null
  zipScore: LaunchpadZipScoreRecord | null
  commutable: boolean
  dsoTier: string | null
  bestTrack: ConcreteLaunchpadTrack
  bestScore: number
  bestTier: LaunchpadTier
  displayScore: number
  displayTier: LaunchpadTier
  trackScores: Record<ConcreteLaunchpadTrack, LaunchpadTrackScore>
  activeSignalIds: LaunchpadSignalId[]
  warningSignalIds: LaunchpadSignalId[]
  headline: string
  rank: number
}

export interface LaunchpadSummary {
  scopeId: LaunchpadScope
  scopeLabel: string
  scopeZipCount: number
  generatedAt: string
  totalPracticesInScope: number
  /**
   * Location-deduped count of GP clinics across scope ZIPs (sum of
   * zip_scores.total_gp_locations). Phase A denominator that collapses
   * NPI-1 + NPI-2 + suite-variant rows at the same physical building.
   * ~2.7× smaller than `totalPracticesInScope`. Null when zip_scores
   * has no rows for the scope.
   */
  totalGpLocations: number | null
  mentorRichCount: number
  hiringNowCount: number
  avoidListCount: number
  successionCandidates: { bestFit: number; strong: number }
  highVolumeCandidates: { bestFit: number; strong: number }
  dsoCandidates: { bestFit: number; strong: number; avoidCount: number }
  medianCompRange: { low: number; high: number; source: string }
  intelCoverage: { total: number; withIntel: number; pct: number }
  corporateSharePct: number | null
}

export interface LaunchpadDataHealth {
  practicesFetched: number
  zipScoresFetched: number
  intelFetched: number
  recentChangesFetched: number
  recentDealsFetched: number
  intelCoveragePct: number
  warnings: string[]
}

export interface LaunchpadBundle {
  scope: {
    id: LaunchpadScope
    label: string
    centerZip: string
    zipCount: number
    zipCodes: string[]
  }
  track: LaunchpadTrack
  generatedAt: string
  summary: LaunchpadSummary
  rankedTargets: LaunchpadRankedTarget[]
  zipScores: LaunchpadZipScoreRecord[]
  recentDeals: LaunchpadRecentDealRecord[]
  dataHealth: LaunchpadDataHealth
}
