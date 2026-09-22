import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getDirectoryEvidence, officeMapDisposition, type ProviderResearch } from '@/lib/utils/directory-evidence'
import { matchesDirectoryResearch } from '@/lib/utils/directory-contacts'
import { DirectoryContactsCell } from '@/components/data-display/directory-contacts-cell'
import type { Practice } from '@/lib/types'
import type { JobHuntVerificationRecord } from '@/lib/supabase/queries/job-hunt-verification'

vi.stubGlobal('React', React)
const p = { npi: '1', provider_npis: ['1', '2'], website: 'imported.example', ownership_tier: null,
  latitude: 41.8, longitude: -87.7 } as Practice
const intel: ProviderResearch = { npi: '2', research_date: '2026-04-01', verification_quality: 'partial',
  verification_urls: '["https://source.example/evidence"]', website_url: 'https://older.example',
  services_listed: 'Fillings', provider_notes: 'Historical provider note' }
const owned = { ...p, ownership_tier: 'true_independent', ownership_evidence_urls: '["https://source.example/owner"]' }
const contact = { website_status: 'live', website_url: 'https://office.example', doctors: [] } as unknown as JobHuntVerificationRecord

describe('directory research and map evidence are distinct', () => {
  it('includes source-backed ownership research without requiring a contact check', () => {
    const evidence = getDirectoryEvidence(owned)
    expect(evidence.hasOfficeEvidence).toBe(true)
    expect(officeMapDisposition(owned, evidence)).toBe('mapped')
    expect(matchesDirectoryResearch(null, 'any_evidence', evidence.hasAnyEvidence)).toBe(true)
    expect(matchesDirectoryResearch(null, 'recent_evidence', evidence.hasAnyEvidence)).toBe(false)
  })
  it('uses positive contact evidence even with unknown ownership; never pins missing coordinates', () => {
    const evidence = getDirectoryEvidence(p, contact)
    expect(officeMapDisposition(p, evidence)).toBe('mapped')
    expect(officeMapDisposition({ ...p, latitude: null }, evidence)).toBe('missing_coordinates')
    expect(officeMapDisposition({ ...p, latitude: NaN }, evidence)).toBe('missing_coordinates')
  })
  it('does not equate estimates, ownership confidence, or negative checks with office evidence', () => {
    const raw = { ...p, ownership_tier: 'true_independent', ownership_confidence: 'high', employee_count: 20 }
    const evidence = getDirectoryEvidence(raw, { ...contact, website_status: 'dead' })
    expect(evidence.hasAnyEvidence).toBe(false)
    expect(officeMapDisposition(raw, evidence)).toBe('missing_office_evidence')
    expect(officeMapDisposition({ ...raw, longitude: null }, evidence)).toBe('missing_both')
  })
  it('recovers non-primary provider dossiers without promoting provider evidence into address validation', () => {
    const evidence = getDirectoryEvidence(p, null, { '2': intel, '3': { ...intel, npi: '3' } })
    expect(evidence.providerResearch).toEqual([intel])
    expect(evidence.hasAnyEvidence).toBe(true)
    expect(evidence.hasOfficeEvidence).toBe(false)
    expect(officeMapDisposition(p, evidence)).toBe('missing_office_evidence')
    expect(getDirectoryEvidence({ ...p, npi: '2' }, null, { '2': intel }).providerResearch).toHaveLength(1)
  })
  it('rejects unsupported dossiers and malformed/unsafe source URLs', () => {
    for (const row of [{ ...intel, verification_quality: 'insufficient' },
      { ...intel, verification_urls: '[]' }, { ...intel, verification_urls: 'broken' },
      { ...intel, verification_urls: '["javascript:alert(1)"]' }]) {
      expect(getDirectoryEvidence(p, null, { '2': row }).hasAnyEvidence).toBe(false)
    }
    expect(getDirectoryEvidence({ ...owned, ownership_evidence_urls: '["https://"]' }).hasOfficeEvidence).toBe(false)
  })
  it('renders source links, dates and historical data without replacing the imported website', () => {
    const html = renderToStaticMarkup(React.createElement(DirectoryContactsCell, {
      practice: p, evidence: getDirectoryEvidence(owned, null, { '2': intel }),
    }))
    for (const text of ['Ownership research sources', 'Older provider research', '2026-04-01', 'partial findings',
      'may describe another office', 'Historical research website', 'Historical provider note',
      'href="https://source.example/owner"', 'href="https://imported.example"']) expect(html).toContain(text)
  })
})
