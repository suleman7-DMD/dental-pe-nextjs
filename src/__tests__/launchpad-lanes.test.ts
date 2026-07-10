import { describe, expect, it } from 'vitest'
import { resolveLane } from '@/lib/launchpad/ranking'
import { LAUNCHPAD_LANE_CAPS } from '@/lib/launchpad/signals'
import type {
  LaunchpadPracticeIntelRecord,
  LaunchpadPracticeRecord,
} from '@/lib/launchpad/signals'

// Lane truth (P0): "Ready to research/apply" (verified_target) is opened ONLY
// by a job_hunt_verification row. Older practice_intel AI dossiers — even
// fresh source-backed ones — must never buy the verified lane.

function makePractice(
  overrides: Partial<LaunchpadPracticeRecord> = {}
): LaunchpadPracticeRecord {
  return {
    id: 1,
    npi: '1000000001',
    location_id: 'loc-0001',
    provider_npis: ['1000000001'],
    practice_name: 'Test Dental',
    doing_business_as: null,
    provider_last_name: null,
    address: '1 Main St',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    phone: null,
    website: null,
    entity_type: null,
    entity_classification: 'general_practice',
    ownership_status: null,
    affiliated_dso: null,
    affiliated_pe_sponsor: null,
    buyability_score: 50,
    classification_confidence: null,
    classification_reasoning: null,
    latitude: null,
    longitude: null,
    year_established: null,
    employee_count: null,
    estimated_revenue: null,
    num_providers: null,
    taxonomy_code: null,
    parent_company: null,
    ein: null,
    franchise_name: null,
    data_source: null,
    data_axle_import_date: null,
    updated_at: null,
    ownership_tier: 'true_independent',
    census_review_status: null,
    ...overrides,
  }
}

// Fresh, fully source-backed dossier — the strongest intel that must STILL
// not open the verified lane.
function makeSourceBackedIntel(): LaunchpadPracticeIntelRecord {
  const fresh = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return {
    npi: '1000000001',
    research_date: fresh,
    verification_quality: 'verified',
    verification_searches: 4,
    verification_urls: ['https://example.com/about', 'https://example.com/team'],
    red_flags: null,
    green_flags: null,
    overall_assessment: 'Healthy independent practice.',
    provider_notes: null,
  } as unknown as LaunchpadPracticeIntelRecord
}

describe('resolveLane — verified lane requires job_hunt_verification', () => {
  it('no ownership tier → needs_research with the review sub-state in the reason', () => {
    const notStarted = resolveLane(makePractice({ ownership_tier: null }), null, false)
    expect(notStarted.lane).toBe('needs_research')
    expect(notStarted.cap).toBe(LAUNCHPAD_LANE_CAPS.needs_research)
    expect(notStarted.laneReason).toContain("hasn't been reviewed yet")

    const held = resolveLane(
      makePractice({ ownership_tier: null, census_review_status: 'held' }),
      null,
      false
    )
    expect(held.lane).toBe('needs_research')
    expect(held.laneReason).toContain('on hold')

    const undetermined = resolveLane(
      makePractice({ ownership_tier: null, census_review_status: 'undetermined' }),
      null,
      false
    )
    expect(undetermined.lane).toBe('needs_research')
    expect(undetermined.laneReason).toContain('too thin')
  })

  it('tier + fresh source-backed dossier but NO verification → promising_lead, never verified_target', () => {
    const result = resolveLane(makePractice(), makeSourceBackedIntel(), false)
    expect(result.lane).toBe('promising_lead')
    expect(result.cap).toBe(LAUNCHPAD_LANE_CAPS.promising_lead)
    // The dossier is disclosed as OLDER research, not as verification.
    expect(result.laneReason).toContain('older source-backed AI dossier')
    expect(result.laneReason).toContain("haven't been re-checked")
  })

  it('tier + job_hunt_verification → verified_target, uncapped', () => {
    const result = resolveLane(makePractice(), null, true)
    expect(result.lane).toBe('verified_target')
    expect(result.cap).toBeNull()
    expect(result.laneReason).toContain('own website was checked')
  })

  it('tier + no intel + no verification → promising_lead without a dossier note', () => {
    const result = resolveLane(makePractice(), null, false)
    expect(result.lane).toBe('promising_lead')
    expect(result.cap).toBe(LAUNCHPAD_LANE_CAPS.promising_lead)
    expect(result.laneReason).not.toContain('dossier')
  })

  it('verification without an ownership tier still lands in needs_research (census answer first)', () => {
    const result = resolveLane(makePractice({ ownership_tier: null }), null, true)
    expect(result.lane).toBe('needs_research')
  })
})
