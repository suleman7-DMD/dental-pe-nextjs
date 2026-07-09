import { describe, expect, it } from 'vitest'
import {
  BASE_JOB_LANES,
  JOB_LANE_META,
  JOB_LANE_ORDER,
  STALE_AFTER_DAYS,
  VERIFIED_JOB_LANES,
  deriveJobLane,
  isVerificationStale,
  isVerifiedJobLane,
} from '@/lib/census/job-lane'

const FULL_FACTS = {
  ownership_tier: 'true_independent',
  website: 'https://smiles.example.com',
  employee_count: 8,
  year_established: 1998,
  network_id: 'smith_dds',
}

const FRESH = new Date(Date.now() - 60 * 60 * 1000).toISOString()
const STALE = new Date(
  Date.now() - (STALE_AFTER_DAYS + 5) * 24 * 60 * 60 * 1000
).toISOString()

describe('deriveJobLane — base layer', () => {
  it('answered ownership + website lands in verify_doctors, never higher', () => {
    const r = deriveJobLane(FULL_FACTS)
    expect(r.lane).toBe('verify_doctors')
    expect(r.rank).toBe(3)
  })

  it('answered ownership without website lands in call_to_verify', () => {
    const r = deriveJobLane({ ownership_tier: 'branded_dso', website: null })
    expect(r.lane).toBe('call_to_verify')
  })

  it('no tier lands in needs_answer with the review sub-state in the why', () => {
    expect(deriveJobLane({ ownership_tier: null }).why).toContain('not started')
    expect(
      deriveJobLane({ ownership_tier: null, census_review_status: 'held' }).why
    ).toContain('held')
    expect(
      deriveJobLane({ ownership_tier: null, census_review_status: 'undetermined' })
        .why
    ).toContain('inconclusive')
  })

  it('institutional tier is not job-relevant even with a website', () => {
    const r = deriveJobLane({
      ownership_tier: 'institutional',
      website: 'https://hospital.example.org',
    })
    expect(r.lane).toBe('not_job_relevant')
    expect(r.rank).toBe(0)
  })

  it('every un-checked office reports the doctor-verification gap', () => {
    const inputs = [
      FULL_FACTS,
      { ownership_tier: 'branded_dso' },
      { ownership_tier: null },
      { ownership_tier: 'institutional' },
    ]
    for (const input of inputs) {
      expect(deriveJobLane(input).missing.join(' ')).toContain(
        'not website-verified'
      )
    }
  })

  it('no BASE lane label ever claims readiness or verification', () => {
    for (const lane of BASE_JOB_LANES) {
      const label = JOB_LANE_META[lane].label.toLowerCase()
      expect(label).not.toContain('ready')
      expect(label).not.toContain('verified')
    }
  })

  it('missing list itemizes real gaps for a sparse record', () => {
    const r = deriveJobLane({ ownership_tier: null, website: '' })
    expect(r.missing).toContain('Ownership answer')
    expect(r.missing).toContain('Website')
    expect(r.missing).toContain('Staff estimate')
    expect(r.missing).toContain('Year established')
  })
})

describe('deriveJobLane — verified layer (job_hunt_verification record)', () => {
  it('each verification_status graduates to its verified lane', () => {
    const cases: Array<[string, string, number]> = [
      ['hiring_page_found', 'hiring_page_found', 9],
      ['roster_verified', 'roster_verified', 8],
      ['call_required', 'call_required', 7],
      ['ownership_conflict', 'ownership_conflict', 5],
      ['no_usable_website', 'no_usable_website', 4],
    ]
    for (const [status, lane, rank] of cases) {
      const r = deriveJobLane(FULL_FACTS, {
        verification_status: status,
        last_checked_at: FRESH,
      })
      expect(r.lane).toBe(lane)
      expect(r.rank).toBe(rank)
    }
  })

  it('a complete fresh roster_verified record has nothing missing', () => {
    const r = deriveJobLane(FULL_FACTS, {
      verification_status: 'roster_verified',
      website_url: 'https://smiles.example.com',
      doctors: [{ name: 'Dr. A' }, { name: 'Dr. B' }],
      provider_count_website: 2,
      owner_operator_stated: 'Site names Dr. A as owner',
      ownership_evidence_status: 'consistent',
      has_hiring_page: true,
      last_checked_at: FRESH,
    })
    expect(r.lane).toBe('roster_verified')
    expect(r.missing).toEqual([])
    expect(r.why).toContain('2 doctors')
  })

  it('Mynt regression: hiring page + openings + no doctors + no owner statement is NOT "nothing missing"', () => {
    const r = deriveJobLane(FULL_FACTS, {
      verification_status: 'hiring_page_found',
      website_url: 'https://mynt.example.com',
      doctors: [],
      provider_count_website: 0,
      owner_operator_stated: null,
      ownership_evidence_status: 'no_statement',
      has_hiring_page: true,
      openings: [{ title: 'Associate Dentist' }, { title: 'General Dentist' }],
      last_checked_at: FRESH,
    })
    expect(r.lane).toBe('hiring_page_found')
    expect(r.missing.length).toBeGreaterThan(0)
    expect(r.missing.join(' ')).toContain('Current doctors not published')
    expect(r.missing.join(' ')).toContain('Owner/operator not stated')
  })

  it('roster_verified with doctors but no owner statement still reports the owner gap', () => {
    const r = deriveJobLane(FULL_FACTS, {
      verification_status: 'roster_verified',
      doctors: [{ name: 'Dr. A' }],
      owner_operator_stated: null,
      ownership_evidence_status: 'no_statement',
      last_checked_at: FRESH,
    })
    expect(r.lane).toBe('roster_verified')
    expect(r.missing.join(' ')).toContain('Owner/operator not stated')
    expect(r.missing.join(' ')).not.toContain('Current doctors not published')
  })

  it('a check older than the staleness window overrides the stored status', () => {
    const r = deriveJobLane(FULL_FACTS, {
      verification_status: 'roster_verified',
      doctors: [{ name: 'Dr. A' }],
      last_checked_at: STALE,
    })
    expect(r.lane).toBe('stale_recheck')
    expect(r.missing.join(' ')).toContain('stale')
  })

  it('ownership_conflict wins even when the check is stale', () => {
    const r = deriveJobLane(FULL_FACTS, {
      verification_status: 'ownership_conflict',
      last_checked_at: STALE,
    })
    expect(r.lane).toBe('ownership_conflict')
    expect(r.missing).toContain('Ownership conflict resolution')
  })

  it('institutional stays not_job_relevant even with a verification record', () => {
    const r = deriveJobLane(
      { ownership_tier: 'institutional', website: 'https://hospital.example.org' },
      { verification_status: 'roster_verified', last_checked_at: FRESH }
    )
    expect(r.lane).toBe('not_job_relevant')
  })

  it('an unknown verification_status falls back to the base lane', () => {
    const r = deriveJobLane(FULL_FACTS, {
      verification_status: 'bogus_status',
      last_checked_at: FRESH,
    })
    expect(r.lane).toBe('verify_doctors')
    expect(r.rank).toBe(3)
  })

  it('a verification website_url fills the Website gap for records missing one', () => {
    const r = deriveJobLane(
      { ownership_tier: 'true_independent', website: null, network_id: 'n' },
      {
        verification_status: 'roster_verified',
        website_url: 'https://found-it.example.com',
        doctors: [{ name: 'Dr. A' }],
        last_checked_at: FRESH,
      }
    )
    expect(r.missing).not.toContain('Website')
  })

  it('call_required and no_usable_website still report the doctors gap', () => {
    for (const status of ['call_required', 'no_usable_website']) {
      const r = deriveJobLane(FULL_FACTS, {
        verification_status: status,
        last_checked_at: FRESH,
      })
      expect(r.missing.join(' ')).toContain('Current doctors not published')
    }
  })
})

describe('lane metadata invariants', () => {
  it('lane ranks strictly follow the display order', () => {
    const ranks = JOB_LANE_ORDER.map((l) => JOB_LANE_META[l].rank)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeLessThan(ranks[i - 1])
    }
  })

  it('verified and base lane sets partition the display order', () => {
    expect([...VERIFIED_JOB_LANES, ...BASE_JOB_LANES]).toEqual(JOB_LANE_ORDER)
    for (const lane of VERIFIED_JOB_LANES) expect(isVerifiedJobLane(lane)).toBe(true)
    for (const lane of BASE_JOB_LANES) expect(isVerifiedJobLane(lane)).toBe(false)
  })

  it('isVerificationStale honors the explicit status, the window, and bad dates', () => {
    expect(isVerificationStale({ verification_status: 'stale_recheck' })).toBe(true)
    expect(
      isVerificationStale({ verification_status: 'roster_verified', last_checked_at: STALE })
    ).toBe(true)
    expect(
      isVerificationStale({ verification_status: 'roster_verified', last_checked_at: FRESH })
    ).toBe(false)
    expect(
      isVerificationStale({ verification_status: 'roster_verified', last_checked_at: 'not-a-date' })
    ).toBe(false)
  })
})
