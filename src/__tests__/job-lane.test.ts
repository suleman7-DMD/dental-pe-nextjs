import { describe, expect, it } from 'vitest'
import {
  JOB_LANE_META,
  JOB_LANE_ORDER,
  deriveJobLane,
} from '@/lib/census/job-lane'

describe('deriveJobLane', () => {
  it('answered ownership + website lands in verify_doctors, never higher', () => {
    const r = deriveJobLane({
      ownership_tier: 'true_independent',
      website: 'https://smiles.example.com',
      employee_count: 8,
      year_established: 1998,
      network_id: 'smith_dds',
    })
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

  it('every lane always reports the doctor-verification gap — no office has it', () => {
    const inputs = [
      { ownership_tier: 'true_independent', website: 'https://x.com', employee_count: 5, year_established: 2001, network_id: 'n' },
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

  it('no lane label ever claims readiness or verification', () => {
    for (const lane of JOB_LANE_ORDER) {
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

  it('lane ranks strictly follow the display order', () => {
    const ranks = JOB_LANE_ORDER.map((l) => JOB_LANE_META[l].rank)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeLessThan(ranks[i - 1])
    }
  })
})
