/**
 * Shared practice_intel trust audit — DESIGN_TRUTH_APP_SOLUTIONS §3 P4 + §7.2.
 *
 * This is the ONLY place that decides whether an intel row is trustworthy.
 * Every consumer — the launchpad ranking pipeline, lane verdicts, UI chips,
 * and the AI prompt routes — must run intel through auditIntel() instead of
 * re-deriving its own notion of "verified".
 *
 * The verdict contract (binding, §7.2):
 *  - "source_backed"  → quality verified/high, ≥2 searches, ≥1 URL, ≤90 days,
 *                       no blocking contradiction language. The ONLY status
 *                       allowed to render as a current verified dossier or to
 *                       reach an AI prompt as fact.
 *  - "legacy"         → substantive but stale or pre-verification. Archived
 *                       context only; never feeds scores or verdicts.
 *  - "rejected"       → partial/insufficient quality (incl. the 775 Lane-A
 *                       opportunistic rows), blocking contradictions, or no
 *                       substance. Needs re-research.
 */
import type { LaunchpadIntelAudit } from "@/lib/launchpad/signals"

/**
 * Structural input so both LaunchpadPracticeIntelRecord rows and AI-route
 * payloads can be audited. Missing fields audit as untrusted, never as trusted.
 */
export interface AuditableIntel {
  npi?: string | null
  research_date?: string | null
  verification_quality?: string | null
  verification_searches?: number | null
  verification_urls?: string[] | null
  overall_assessment?: string | null
  provider_notes?: string | null
  red_flags?: string[] | null
  website_url?: string | null
  google_rating?: number | null
}

export const SOURCE_BACKED_QUALITIES = new Set(["verified", "high"])
export const CURRENT_INTEL_MAX_DAYS = 90

const BLOCKING_INTEL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bownership\/structure mismatch\b/i, reason: "ownership/structure mismatch" },
  { pattern: /\bstructure mismatch\b/i, reason: "structure mismatch" },
  { pattern: /\bownership mismatch\b/i, reason: "ownership mismatch" },
  { pattern: /\binput data indicated\b/i, reason: "legacy data conflicts with web evidence" },
  { pattern: /\bmultiple licensed dentists?\b/i, reason: "provider roster contradicts solo premise" },
  { pattern: /\bmulti-doctor\b/i, reason: "multi-doctor structure needs review" },
  { pattern: /\bmulti-location\b/i, reason: "multi-location structure needs review" },
  { pattern: /\bsecondary location unconfirmed\b/i, reason: "unconfirmed second location" },
  { pattern: /\bowner(ship)? unclear\b/i, reason: "ownership unclear" },
  { pattern: /\bconflict(?:ing|s)?\b/i, reason: "conflicting evidence" },
  { pattern: /\bcontradict(?:ed|s|ory|ion|ions)?\b/i, reason: "contradictory evidence" },
]

/**
 * Negated-concern phrases ("no conflicting evidence", "without contradictions",
 * "not contradicted") must NOT trip the conflict/contradict patterns above.
 * They are stripped from the haystack before pattern testing.
 */
const NEGATED_CONCERN_RE =
  /\b(?:no|not|never|without|free of|lacking|zero)\s+(?:known\s+|apparent\s+|obvious\s+|major\s+|significant\s+)?(?:conflict\w*|contradict\w*|discrepanc\w*|mismatch\w*)(?:\s+(?:evidence|found|detected|noted|identified|observed))?/gi

export function intelAgeDays(intel: AuditableIntel): number {
  if (!intel.research_date) return Number.POSITIVE_INFINITY
  const t = Date.parse(intel.research_date)
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Math.floor((Date.now() - t) / 86_400_000)
}

export function intelBlockingReasons(intel: AuditableIntel): string[] {
  const haystack = [
    intel.overall_assessment,
    intel.provider_notes,
    ...(intel.red_flags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(NEGATED_CONCERN_RE, " ")

  const reasons: string[] = []
  for (const { pattern, reason } of BLOCKING_INTEL_PATTERNS) {
    if (pattern.test(haystack) && !reasons.includes(reason)) reasons.push(reason)
  }
  return reasons
}

export function hasSourceBackedIntel(intel: AuditableIntel): boolean {
  const quality = intel.verification_quality?.toLowerCase() ?? ""
  return (
    SOURCE_BACKED_QUALITIES.has(quality) &&
    (intel.verification_searches ?? 0) >= 2 &&
    (intel.verification_urls?.length ?? 0) > 0 &&
    intelAgeDays(intel) <= CURRENT_INTEL_MAX_DAYS &&
    intelBlockingReasons(intel).length === 0
  )
}

export function hasSubstantiveIntel(intel: AuditableIntel): boolean {
  const quality = intel.verification_quality?.toLowerCase() ?? ""
  if (quality === "insufficient") return false
  return (
    intel.overall_assessment != null ||
    intel.website_url != null ||
    intel.google_rating != null
  )
}

export function auditIntel(intel: AuditableIntel): LaunchpadIntelAudit {
  const quality = intel.verification_quality?.toLowerCase() ?? null
  const searches = intel.verification_searches ?? 0
  const urlCount = intel.verification_urls?.length ?? 0
  const sourceBacked = hasSourceBackedIntel(intel)
  const substantive = hasSubstantiveIntel(intel)
  let status: LaunchpadIntelAudit["status"]
  let reason: string
  if (sourceBacked) {
    status = "source_backed"
    reason = "Accepted: current verified practice_intel row."
  } else if (intelBlockingReasons(intel).length > 0) {
    status = "rejected"
    reason = `Rejected for Job Hunt scoring: ${intelBlockingReasons(intel).join("; ")}.`
  } else if ((quality === "partial" || quality === "insufficient") && substantive) {
    status = "rejected"
    reason = `Rejected for Job Hunt scoring: verification_quality=${quality}; re-research required.`
  } else if (intelAgeDays(intel) > CURRENT_INTEL_MAX_DAYS && substantive) {
    status = "legacy"
    reason = `Accepted only as archived context: researched ${intelAgeDays(intel)} days ago.`
  } else if (substantive) {
    status = "legacy"
    reason = "Accepted: pre-verification intel with substantive content."
  } else {
    status = "rejected"
    if (!quality) reason = "Rejected: missing verification_quality."
    else if (!SOURCE_BACKED_QUALITIES.has(quality)) {
      reason = `Rejected: verification_quality=${quality}.`
    } else if (searches < 2) {
      reason = `Rejected: only ${searches} web search${searches === 1 ? "" : "es"} reported.`
    } else if (urlCount === 0) {
      reason = "Rejected: no verification URLs stored."
    } else {
      reason = "Rejected: no substantive content."
    }
  }
  return {
    npi: intel.npi ?? "",
    status,
    research_date: intel.research_date ?? null,
    verification_quality: intel.verification_quality ?? null,
    verification_searches: intel.verification_searches ?? null,
    verification_urls: intel.verification_urls ?? [],
    reason,
  }
}

export function qualityScore(intel: AuditableIntel): number {
  const quality = intel.verification_quality?.toLowerCase()
  if (quality === "verified" || quality === "high") return 3
  if (quality === "partial") return 2
  if (quality === "insufficient") return 1
  return 0
}

export function chooseBestIntel<T extends AuditableIntel>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const sourceBackedDelta = Number(hasSourceBackedIntel(b)) - Number(hasSourceBackedIntel(a))
    if (sourceBackedDelta !== 0) return sourceBackedDelta
    const qualityDelta = qualityScore(b) - qualityScore(a)
    if (qualityDelta !== 0) return qualityDelta
    return (b.research_date ?? "").localeCompare(a.research_date ?? "")
  })[0]
}
