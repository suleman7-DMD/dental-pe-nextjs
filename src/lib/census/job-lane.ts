// ────────────────────────────────────────────────────────────────────────────
// Job-hunt lane — the single per-office answer to "can I act on this record?"
//
// Two layers:
//   · BASE lanes (rank ≤ 3) derive ONLY from census/registry facts. A reviewed
//     ownership answer alone never yields a "verified" lane, and base labels
//     never claim verification.
//   · VERIFIED lanes (rank ≥ 4) require a job_hunt_verification record — the
//     website-check pass that confirms current doctors, hiring pages, and
//     ownership statements with evidence URLs. Only these lanes may say
//     "verified", because a source-backed record exists for them.
//
// Anything rank ≥ 4 has been website-checked; the rank ordering within that
// layer is job-hunt actionability (hiring evidence > confirmed roster >
// call-to-confirm > stale > conflict > online dead end).
// ────────────────────────────────────────────────────────────────────────────

import { BUCKET_META } from './ownership-truth'

export type JobLane =
  // verified layer — backed by a job_hunt_verification record
  | 'hiring_page_found'
  | 'roster_verified'
  | 'call_required'
  | 'stale_recheck'
  | 'ownership_conflict'
  | 'no_usable_website'
  // base layer — census facts only
  | 'verify_doctors'
  | 'call_to_verify'
  | 'needs_answer'
  | 'not_job_relevant'

export interface JobLaneInput {
  ownership_tier?: string | null
  census_review_status?: string | null
  website?: string | null
  employee_count?: number | null
  year_established?: number | null
  network_id?: string | null
  pe_backed?: boolean | null
}

/** Subset of a job_hunt_verification row that the lane rules need. */
export interface JobLaneVerificationInput {
  verification_status: string | null
  website_url?: string | null
  doctors?: unknown[] | null
  provider_count_website?: number | null
  owner_operator_stated?: string | null
  ownership_evidence_status?: string | null
  has_hiring_page?: boolean | null
  openings?: unknown[] | null
  last_checked_at?: string | null
}

export interface JobLaneResult {
  lane: JobLane
  /** Higher = more actionable for a job hunt. Used for default table sort. */
  rank: number
  label: string
  color: string
  bg: string
  /** One plain sentence: why this office is in this lane. */
  why: string
  /** Exact gaps, worded honestly — empty only when a fresh verified record covers everything. */
  missing: string[]
}

export const STALE_AFTER_DAYS = 90

export const JOB_LANE_META: Record<
  JobLane,
  { rank: number; label: string; color: string; bg: string }
> = {
  hiring_page_found: {
    rank: 9,
    label: 'Hiring page found',
    color: '#15803D',
    bg: 'rgba(21,128,61,0.12)',
  },
  roster_verified: {
    rank: 8,
    label: 'Website roster verified',
    color: '#166534',
    bg: 'rgba(22,101,52,0.10)',
  },
  call_required: {
    rank: 7,
    label: 'Checked — call required',
    color: '#8B6508',
    bg: 'rgba(184,134,11,0.10)',
  },
  stale_recheck: {
    rank: 6,
    label: 'Verified — recheck (stale)',
    color: '#B45309',
    bg: 'rgba(180,83,9,0.08)',
  },
  ownership_conflict: {
    rank: 5,
    label: 'Ownership conflict — review',
    color: '#C23B3B',
    bg: 'rgba(194,59,59,0.08)',
  },
  no_usable_website: {
    rank: 4,
    label: 'Checked — no usable website',
    color: '#6B6B60',
    bg: 'rgba(107,107,96,0.08)',
  },
  verify_doctors: {
    rank: 3,
    label: 'Promising — verify doctors',
    color: '#2D7A3A',
    bg: 'rgba(45,122,58,0.08)',
  },
  call_to_verify: {
    rank: 2,
    label: 'Answered — call to verify',
    color: '#8B6508',
    bg: 'rgba(184,134,11,0.08)',
  },
  needs_answer: {
    rank: 1,
    label: 'Needs ownership answer',
    color: '#6B6B60',
    bg: 'rgba(107,107,96,0.08)',
  },
  not_job_relevant: {
    rank: 0,
    label: 'Not job-relevant (institutional)',
    color: BUCKET_META.institutional.color,
    bg: 'rgba(107,107,96,0.06)',
  },
}

/** Display order for filters/legends — most actionable first. */
export const JOB_LANE_ORDER: JobLane[] = [
  'hiring_page_found',
  'roster_verified',
  'call_required',
  'stale_recheck',
  'ownership_conflict',
  'no_usable_website',
  'verify_doctors',
  'call_to_verify',
  'needs_answer',
  'not_job_relevant',
]

/** Lanes that require a job_hunt_verification record behind them. */
export const VERIFIED_JOB_LANES: JobLane[] = [
  'hiring_page_found',
  'roster_verified',
  'call_required',
  'stale_recheck',
  'ownership_conflict',
  'no_usable_website',
]

/** Base lanes — census facts only; labels here must never claim verification. */
export const BASE_JOB_LANES: JobLane[] = [
  'verify_doctors',
  'call_to_verify',
  'needs_answer',
  'not_job_relevant',
]

export function isVerifiedJobLane(lane: JobLane): boolean {
  return JOB_LANE_META[lane].rank >= 4
}

const DOCTORS_GAP = 'Current doctors (not website-verified)'

// Verified-layer gaps: these offices HAVE been website-checked, so the wording
// states what the check actually found. "Nothing missing" may only appear when
// current doctors are verified on the site AND the owner/operator is stated.
const VERIFIED_DOCTORS_GAP = 'Current doctors not published/verified on website'
const OWNER_GAP = 'Owner/operator not stated on website'

/** Recognized job_hunt_verification statuses — a record with any other
 *  status is treated as absent. Shared with funnel.ts (single definition). */
export const VERIFICATION_STATUSES = new Set([
  'roster_verified',
  'hiring_page_found',
  'call_required',
  'no_usable_website',
  'ownership_conflict',
  'stale_recheck',
])

export function isVerificationStale(
  v: Pick<JobLaneVerificationInput, 'verification_status' | 'last_checked_at'>
): boolean {
  if (v.verification_status === 'stale_recheck') return true
  if (!v.last_checked_at) return false
  const t = Date.parse(v.last_checked_at)
  if (Number.isNaN(t)) return false
  return Date.now() - t > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

export function deriveJobLane(
  p: JobLaneInput,
  verification?: JobLaneVerificationInput | null
): JobLaneResult {
  const hasTier = p.ownership_tier != null && p.ownership_tier !== ''
  const website = (p.website ?? '').trim()
  const v =
    verification && VERIFICATION_STATUSES.has(verification.verification_status ?? '')
      ? verification
      : null

  const missing: string[] = []
  if (!hasTier) missing.push('Ownership answer')
  if (hasTier && !p.network_id) missing.push('Owner/operator name on record')
  if (!website && !(v?.website_url ?? '').trim()) missing.push('Website')
  if (p.employee_count == null) missing.push('Staff estimate')
  if (p.year_established == null) missing.push('Year established')

  // Institutional settings stay out of the job hunt even when checked.
  if (hasTier && p.ownership_tier === 'institutional') {
    return {
      lane: 'not_job_relevant',
      why: 'Institutional setting (hospital / university / public health) — not a private-practice associate posting.',
      missing: [DOCTORS_GAP, ...missing],
      ...JOB_LANE_META.not_job_relevant,
    }
  }

  // ── Verified layer: a website-check record exists ─────────────────────────
  if (v) {
    const doctorCount = Array.isArray(v.doctors) ? v.doctors.length : 0
    const openingCount = Array.isArray(v.openings) ? v.openings.length : 0
    const stale = isVerificationStale(v)

    let lane: JobLane
    let why: string
    if (v.verification_status === 'ownership_conflict') {
      lane = 'ownership_conflict'
      why =
        'The website check found ownership evidence that conflicts with the census answer — resolve the conflict before acting on this office.'
      missing.unshift('Ownership conflict resolution')
    } else if (stale) {
      lane = 'stale_recheck'
      why = `This office was website-checked, but the check is over ${STALE_AFTER_DAYS} days old — recheck before acting on it.`
      missing.unshift('Fresh website check (last one is stale)')
    } else if (v.verification_status === 'hiring_page_found') {
      lane = 'hiring_page_found'
      why =
        openingCount > 0
          ? `Hiring evidence on file: ${openingCount} opening${openingCount === 1 ? '' : 's'} found on the practice's own site.`
          : "A careers/hiring page was found on the practice's own site — check it for current openings."
    } else if (v.verification_status === 'roster_verified') {
      lane = 'roster_verified'
      why = `Current doctors are verified from the practice's own website${doctorCount > 0 ? ` — ${doctorCount} doctor${doctorCount === 1 ? '' : 's'} on the roster` : ''}. Evidence URLs are on file.`
      if (v.has_hiring_page === false) missing.push('Hiring page (none found on site)')
    } else if (v.verification_status === 'no_usable_website') {
      lane = 'no_usable_website'
      why =
        'Checked — no usable practice website exists (dead, parked, or social-only). Verifying doctors or openings means a phone call or a visit.'
    } else {
      lane = 'call_required'
      why =
        'The website was checked but it does not publish a usable doctor roster — confirming current doctors requires a phone call.'
    }

    // Honesty gaps apply to EVERY verified lane. A record can carry hiring
    // evidence and still not tell you who works there or who owns it — the
    // missing list must say so, or the page contradicts itself.
    const ownerStated = (v.owner_operator_stated ?? '').trim() !== ''
    if (!ownerStated || v.ownership_evidence_status === 'no_statement') {
      missing.unshift(OWNER_GAP)
    }
    if (doctorCount === 0 || v.provider_count_website === 0) {
      missing.unshift(VERIFIED_DOCTORS_GAP)
    }

    return { lane, why, missing, ...JOB_LANE_META[lane] }
  }

  // ── Base layer: census facts only ─────────────────────────────────────────
  missing.unshift(DOCTORS_GAP)

  let lane: JobLane
  let why: string
  if (!hasTier) {
    lane = 'needs_answer'
    why =
      p.census_review_status === 'held'
        ? 'No final ownership answer — a reviewer held this record for adjudication. Treat with extra caution.'
        : p.census_review_status === 'undetermined'
          ? 'No final ownership answer — it was researched but the public evidence was inconclusive.'
          : 'No final ownership answer — ownership research has not started for this office.'
  } else if (website) {
    lane = 'verify_doctors'
    why =
      'Ownership is answered and a website is on file. One check left before applying: confirm the current doctors on the website — this office has not had that check yet.'
  } else {
    lane = 'call_to_verify'
    why =
      'Ownership is answered but no website is on file, so verifying current doctors means a phone call or a visit.'
  }

  return { lane, why, missing, ...JOB_LANE_META[lane] }
}
