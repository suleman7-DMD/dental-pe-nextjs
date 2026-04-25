// Shared request/response types for all Launchpad AI routes.
// Import from here in both route handlers and client-side hooks.

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface PracticeSnapshot {
  name: string
  dba?: string | null
  entity_classification?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  year_established?: number | null
  employee_count?: number | null
  num_providers?: number | null
  estimated_revenue?: number | null
  buyability_score?: number | null
  website?: string | null
  affiliated_dso?: string | null
  dso_tier?: string | null
  ownership_status?: string | null
  classification_confidence?: number | null
}

export interface ZipContext {
  metro?: string | null
  market_type?: string | null
  corporate_share_pct?: number | null
  dld_gp_per_10k?: number | null
  buyable_practice_ratio?: number | null
  commutable?: boolean | null
  metrics_confidence?: string | null
  population?: number | null
  median_household_income?: number | null
}

export interface IntelContext {
  raw_json?: unknown
  overall_assessment?: string | null
  acquisition_readiness?: string | null
  confidence?: string | null
  green_flags?: string[] | null
  red_flags?: string[] | null
}

export interface TrackScores {
  succession: number
  high_volume: number
  dso: number
}

// ---------------------------------------------------------------------------
// /api/launchpad/ask
// ---------------------------------------------------------------------------

export interface AskIntelRequest {
  question: string
  npi?: string
  zip_code?: string
  practice_snapshot?: PracticeSnapshot
  zip_context?: ZipContext
  intel_context?: IntelContext
}

export interface AskIntelResponse {
  answer: string
  model: string
}

// ---------------------------------------------------------------------------
// /api/launchpad/compound-narrative
// ---------------------------------------------------------------------------

export interface CompoundNarrativeRequest {
  practice: PracticeSnapshot & { npi: string }
  signals: string[]
  scores: TrackScores
  track: "succession" | "high_volume" | "dso" | "all"
}

export interface CompoundNarrativeResponse {
  thesis: string | null
  reason?: "no_verified_research"
  evidence_quality?: "verified" | "partial" | "high"
  structural_summary?: {
    name: string
    entity_classification: string | null
    years_in_operation: number | null
    providers: number | null
    employees: number | null
    buyability_score: number | null
    active_signals: string[]
    track_scores: TrackScores
  }
}

// ---------------------------------------------------------------------------
// /api/launchpad/interview-prep
// ---------------------------------------------------------------------------

export interface InterviewPrepRequest {
  practice: PracticeSnapshot & { npi: string }
  signals: string[]
  intel?: IntelContext | null
  track: "succession" | "high_volume" | "dso" | "all"
}

export interface InterviewQuestion {
  q: string
  listenFor: string
}

export interface InterviewCategory {
  name: string
  questions: InterviewQuestion[]
}

export interface InterviewPrepResponse {
  categories: InterviewCategory[]
}

// ---------------------------------------------------------------------------
// /api/launchpad/zip-mood
// ---------------------------------------------------------------------------

export interface ZipMoodRequest {
  zip_code: string
  zip_context: ZipContext
  zip_intel?: unknown
  practice_stats?: {
    total: number
    mentor_rich_count?: number | null
    dso_density?: number | null
    independent_pct?: number | null
  }
}

export interface ZipMoodResponse {
  mood: string
  confidence: "high" | "medium" | "low"
}

// ---------------------------------------------------------------------------
// /api/launchpad/smart-briefing
// ---------------------------------------------------------------------------

export interface SmartBriefingPractice {
  npi: string
  snapshot: PracticeSnapshot
  signals: string[]
  scores: TrackScores
  intel?: IntelContext | null
}

export interface SmartBriefingRequest {
  practices: SmartBriefingPractice[]
  track: "succession" | "high_volume" | "dso" | "all"
}

export interface SmartBriefingPracticeResult {
  npi: string
  name: string
  strengths: string[]
  risks: string[]
  questions: string[]
}

export interface SmartBriefingResponse {
  practices: SmartBriefingPracticeResult[]
  recommendation: {
    top_npi: string
    rationale: string
  }
}

// ---------------------------------------------------------------------------
// /api/launchpad/contract-parse
// ---------------------------------------------------------------------------

export interface ContractParseRequest {
  contract_text: string
}

export interface ContractFlag {
  severity: "red" | "amber" | "green"
  message: string
}

export interface ContractParseResponse {
  non_compete: {
    radius_miles: number | null
    duration_months: number | null
    severity: "low" | "medium" | "high"
  }
  compensation: {
    base_salary_usd: number | null
    production_pct: number | null
    collection_floor_pct: number | null
    draw_structure: string | null
  }
  termination: {
    notice_period_days: number | null
    at_will: boolean | null
  }
  restrictive_covenants: string[]
  ce_reimbursement: {
    annual_usd: number | null
    clawback: boolean | null
  }
  flags: ContractFlag[]
  overall_assessment: string
}
