// ────────────────────────────────────────────────────────────────────────────
// TypeScript interfaces for the Qualitative Intelligence tables
// Matches SQLAlchemy models: ZipQualitativeIntel, PracticeIntel in database.py
// ────────────────────────────────────────────────────────────────────────────

export interface ZipQualitativeIntel {
  zip_code: string
  research_date: string
  // Housing & Development
  housing_status: string | null
  housing_developments: string | null
  housing_summary: string | null
  // Schools
  school_district: string | null
  school_rating: string | null
  school_source: string | null
  school_note: string | null
  // Retail & Income Signals
  retail_premium: string | null
  retail_mass: string | null
  retail_income_signal: string | null
  // Commercial Development
  commercial_status: string | null
  commercial_projects: string | null
  commercial_note: string | null
  // Dental-Specific News
  dental_new_offices: string | null
  dental_dso_moves: string | null
  dental_note: string | null
  // Real Estate
  median_home_price: number | null
  home_price_trend: string | null
  home_price_yoy_pct: number | null
  real_estate_source: string | null
  // Zoning & Planning
  zoning_items: string | null
  zoning_note: string | null
  // Population Signals
  pop_growth_signals: string | null
  pop_demographics: string | null
  pop_note: string | null
  // Employment & Insurance
  major_employers: string | null
  insurance_signal: string | null
  // Competition
  competitor_new: string | null
  competitor_closures: string | null
  competitor_note: string | null
  // Synthesis
  demand_outlook: string | null
  supply_outlook: string | null
  investment_thesis: string | null
  confidence: string | null
  sources: string | null
  // Metadata
  research_method: string | null
  raw_json: string | null
  cost_usd: number | null
  model_used: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PracticeIntel {
  npi: string
  research_date: string
  // Website Analysis
  website_url: string | null
  website_era: string | null
  website_last_update: string | null
  website_analysis: string | null
  // Services & Technology
  services_listed: string | null
  services_high_rev: string | null
  services_note: string | null
  technology_listed: string | null
  technology_level: string | null
  // Provider Info
  provider_count_web: number | null
  owner_career_stage: string | null
  provider_notes: string | null
  // Google Reviews
  google_review_count: number | null
  google_rating: number | null
  google_recent_date: string | null
  google_velocity: string | null
  google_sentiment: string | null
  // Hiring Signals
  hiring_active: number | null
  hiring_positions: string | null
  hiring_source: string | null
  // Acquisition News
  acquisition_found: number | null
  acquisition_details: string | null
  // Social Media
  social_facebook: string | null
  social_instagram: string | null
  social_other: string | null
  // Other Profiles
  healthgrades_rating: number | null
  healthgrades_reviews: number | null
  zocdoc_listed: number | null
  // Doctor Profile
  doctor_publications: number | null
  doctor_speaking: number | null
  doctor_associations: string | null
  doctor_notes: string | null
  // Insurance Signals
  accepts_medicaid: number | null
  ppo_heavy: number | null
  insurance_note: string | null
  // Assessment
  red_flags: string | null
  green_flags: string | null
  overall_assessment: string | null
  acquisition_readiness: string | null
  confidence: string | null
  sources: string | null
  // Metadata
  research_method: string | null
  escalated: number | null
  escalation_findings: string | null
  raw_json: string | null
  cost_usd: number | null
  model_used: string | null
  created_at: string | null
  updated_at: string | null
}

export interface IntelStats {
  totalZipsResearched: number
  totalPracticesResearched: number
  avgCostUsd: number | null
  highReadinessCount: number
}
