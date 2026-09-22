import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { filterDirectoryRows, getOfficeCoordinates } from '@/lib/utils/directory-visibility'
import { PracticeDirectory } from '@/app/job-market/_components/practice-directory'
import { PracticeDensityMap } from '@/app/job-market/_components/practice-density-map'
import type { Practice } from '@/lib/types'

vi.stubGlobal('React', React)
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/hooks/use-job-hunt-verification', () => ({ useJobHuntVerificationMap: () => ({
  unknown: { website_status: 'live', website_url: 'https://example.org', doctors: [], last_checked_at: '2026-07-10', verification_status: 'call_required' },
}) }))
vi.mock('@/app/job-market/_components/practice-detail-drawer', () => ({ PracticeDetailDrawer: () => null }))

const unlocated = {
  npi: 'unlocated', location_id: 'unlocated', practice_name: 'Unlocated Family Office',
  address: '123 Main St', city: 'Chicago', zip: '60602', state: 'IL',
  entity_classification: 'solo_established', ownership_tier: null,
  latitude: null, longitude: null,
} as Practice
const located = {
  ...unlocated, npi: 'located', location_id: 'located', practice_name: 'Located Office',
  latitude: 41.882, longitude: -87.624, ownership_tier: 'true_independent',
  ownership_evidence_urls: '["https://example.org/ownership"]',
} as Practice
const unresolvedLocated = { ...located, npi: 'unknown', location_id: 'unknown', ownership_tier: null }
const rows = [unlocated, located, unresolvedLocated]

describe('directory inclusion is independent of map coordinates and ownership resolution', () => {
  it('renders a full 100-office page with only the outer paginator, not five nested 20-row pages', () => {
    const offices = Array.from({ length: 4439 }, (_, i) => ({
      ...unlocated, npi: `office-${i}`, location_id: `office-${i}`, practice_name: `Office ${i}`,
    }))
    const html = renderToStaticMarkup(React.createElement(PracticeDirectory, { practices: offices, allPractices: offices }))
    const text = html.replace(/<[^>]*>/g, '')
    expect(html.match(/href="\/practice\/office-/g)).toHaveLength(100)
    expect(text).toContain('Page 1 of 45 (4,439 total)')
    expect(text).not.toContain('Page 1 of 5')
    expect(html.match(/>Next<\/button>/g)).toHaveLength(1)
    expect(html).toContain('Tracked does not mean validated')
  })

  it('renders the default All practices list including an unresolved, unlocated office', () => {
    const html = renderToStaticMarkup(React.createElement(PracticeDirectory, { practices: rows, allPractices: rows }))
    expect(html).toContain('href="/practice/unlocated"')
    expect(html).toContain('Unlocated Family Office')
    expect(html).toContain('Map location unavailable')
    expect(html).toContain('href="/practice/located"')
  })

  it('keeps every row by default and finds an unlocated office by name, address, or ZIP', () => {
    expect(filterDirectoryRows(rows)).toEqual(rows)
    for (const search of ['Unlocated Family', '123 Main', '60602']) {
      expect(filterDirectoryRows(rows, { search })).toContain(unlocated)
    }
  })

  it('preserves explicit ownership bucket/tier filters, their intersection, and clearing', () => {
    expect(filterDirectoryRows(rows, { buckets: ['unresolved'] })).toEqual([unlocated, unresolvedLocated])
    expect(filterDirectoryRows(rows, { buckets: ['true_solo_owner_operated'] })).toEqual([located])
    expect(filterDirectoryRows(rows, { tiers: ['true_independent'] })).toEqual([located])
    expect(filterDirectoryRows(rows, { buckets: ['unresolved'], tiers: ['true_independent'] })).toEqual([])
    expect(filterDirectoryRows(rows, { buckets: [], tiers: [] })).toEqual(rows)
  })

  it('does not create a marker from a known ZIP when stored coordinates are absent', () => {
    const html = renderToStaticMarkup(React.createElement(PracticeDensityMap, {
      practices: [unlocated], centerLat: 41.88, centerLon: -87.62,
    }))
    expect(html).toContain('0 offices mapped')
    expect(html).toContain('1 not pinned of 1 tracked offices')
    expect(html).toContain('Find these offices in the Directory')
  })

  it('maps valid stored coordinates unchanged, including unresolved ownership', () => {
    expect(getOfficeCoordinates(located)).toEqual({ lat: 41.882, lon: -87.624 })
    expect(getOfficeCoordinates(unresolvedLocated)).toEqual(getOfficeCoordinates(located))
    const html = renderToStaticMarkup(React.createElement(PracticeDensityMap, {
      practices: rows, centerLat: 41.88, centerLon: -87.62,
    }))
    expect(html).toContain('2 offices mapped')
    expect(html).toContain('1 not pinned of 3 tracked offices')
    const visibleText = html.replace(/<[^>]*>/g, '')
    expect(visibleText).toContain('Website/doctor evidence + coordinates: 1')
    expect(visibleText).not.toContain('hidden')
  })

  it('reconciles each office into one map disposition and accounts for selected filters', () => {
    const offices = [located, { ...located, location_id: 'missing-coords', latitude: null },
      { ...unlocated, location_id: 'no-evidence', latitude: 41.8, longitude: -87.7 }, unlocated]
    const render = (researchFilter: 'all' | 'recent_evidence') => renderToStaticMarkup(React.createElement(PracticeDensityMap, {
      practices: offices, centerLat: 41.88, centerLon: -87.62, researchFilter,
    })).replace(/<[^>]*>/g, '')
    const text = render('all')
    expect(text).toContain('1 offices mapped · 3 not pinned of 4 tracked offices')
    expect(text).toContain('office evidence, but no usable coordinates: 1')
    expect(text).toContain('coordinates, but insufficient office evidence: 1')
    expect(text).toContain('missing both coordinates and office evidence: 1')
    expect(render('recent_evidence')).toContain('Outside selected research filter: 4')
  })

  it.each([
    [null, -87.62], [41.88, undefined], [0, -87.62], [41.88, 0],
    [NaN, -87.62], [41.88, Infinity], [91, -87.62], [41.88, -181],
    ['', '-87.62'], [' ', '-87.62'], ['invalid', '-87.62'],
  ])('rejects unusable coordinate pair (%s, %s)', (latitude, longitude) => {
    expect(getOfficeCoordinates({ latitude, longitude })).toBeNull()
  })

  it('accepts numeric stored coordinates without shifting them', () => {
    expect(getOfficeCoordinates({ latitude: '41.882', longitude: '-87.624' }))
      .toEqual({ lat: 41.882, lon: -87.624 })
  })
})
