// ────────────────────────────────────────────────────────────────────────────
// Job-hunt lane — the single per-office answer to "can I act on this record?"
//
// Lanes are derived ONLY from facts that exist in the data today. There is
// deliberately no "ready to contact" lane: current doctors are not
// website-verified for ANY office yet, so the best any record can honestly be
// is "promising — verify doctors". When the doctor-verification research pass
// lands, a higher lane can be added on top without changing these rules.
//
// This also encodes the ownership-verified vs job-hunt-verified distinction:
// a reviewed ownership answer alone never yields a "verified" lane.
// ────────────────────────────────────────────────────────────────────────────

import { BUCKET_META } from './ownership-truth'

export type JobLane =
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

export interface JobLaneResult {
  lane: JobLane
  /** Higher = more actionable for a job hunt. Used for default table sort. */
  rank: number
  label: string
  color: string
  bg: string
  /** One plain sentence: why this office is in this lane. */
  why: string
  /** Exact gaps, worded honestly — never empty while doctor data is missing. */
  missing: string[]
}

export const JOB_LANE_META: Record<
  JobLane,
  { rank: number; label: string; color: string; bg: string }
> = {
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
  'verify_doctors',
  'call_to_verify',
  'needs_answer',
  'not_job_relevant',
]

const DOCTORS_GAP = 'Current doctors (not website-verified)'

export function deriveJobLane(p: JobLaneInput): JobLaneResult {
  const hasTier = p.ownership_tier != null && p.ownership_tier !== ''
  const website = (p.website ?? '').trim()

  const missing: string[] = [DOCTORS_GAP]
  if (!hasTier) missing.push('Ownership answer')
  if (hasTier && !p.network_id) missing.push('Owner/operator name on record')
  if (!website) missing.push('Website')
  if (p.employee_count == null) missing.push('Staff estimate')
  if (p.year_established == null) missing.push('Year established')

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
  } else if (p.ownership_tier === 'institutional') {
    lane = 'not_job_relevant'
    why =
      'Institutional setting (hospital / university / public health) — not a private-practice associate posting.'
  } else if (website) {
    lane = 'verify_doctors'
    why =
      'Ownership is answered and a website is on file. One check left before applying: confirm the current doctors on the website — no office has that verified yet.'
  } else {
    lane = 'call_to_verify'
    why =
      'Ownership is answered but no website is on file, so verifying current doctors means a phone call or a visit.'
  }

  return { lane, why, missing, ...JOB_LANE_META[lane] }
}
