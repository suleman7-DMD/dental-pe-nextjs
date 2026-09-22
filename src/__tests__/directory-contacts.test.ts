import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { directoryContacts, DIRECTORY_CONTACT_EXPORT_HEADERS, matchesDirectoryResearch } from '@/lib/utils/directory-contacts'
import { filterDirectoryRows } from '@/lib/utils/directory-visibility'
import { DirectoryContactsCell } from '@/components/data-display/directory-contacts-cell'
import { PracticeDirectory } from '@/app/job-market/_components/practice-directory'
import { toCSVString } from '@/lib/utils/csv-export'
import type { Practice } from '@/lib/types'
import type { JobHuntVerificationRecord } from '@/lib/supabase/queries/job-hunt-verification'

vi.stubGlobal('React', React)
const { verificationMap } = vi.hoisted(() => ({ verificationMap: {} as Record<string, unknown> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/hooks/use-job-hunt-verification', () => ({ useJobHuntVerificationMap: () => verificationMap }))
vi.mock('@/app/job-market/_components/practice-detail-drawer', () => ({ PracticeDetailDrawer: () => null }))

const practice = {
  npi: 'office', location_id: 'office', practice_name: 'Family Dental',
  website: 'imported.example', phone: '312-555-0100', city: 'Chicago', zip: '60602',
  ownership_tier: null, latitude: null, longitude: null,
} as Practice
const verification: JobHuntVerificationRecord = {
  location_id: 'office', public_practice_name: 'Family Dental',
  website_url: 'https://researched.example', website_status: 'live',
  doctors: [{ name: 'Alex Rivera', credential: 'DDS', source_url: 'https://researched.example/team' }],
  provider_count_website: 1, owner_operator_stated: null, ownership_evidence_status: 'no_statement',
  careers_page_url: 'https://researched.example/careers', has_hiring_page: true,
  openings: [], verification_status: 'roster_verified', evidence_urls: [], notes: null,
  last_checked_at: '2026-07-10T12:00:00Z', checked_by: 'existing-research',
}
function render(v?: JobHuntVerificationRecord | null) {
  return renderToStaticMarkup(React.createElement(DirectoryContactsCell, { practice, verification: v }))
}
afterEach(() => {
  vi.useRealTimers()
  delete verificationMap.office
})

describe('existing research reaches directory outreach', () => {
  it('filters on recent source-backed contacts, not ownership confidence or raw website presence', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-22'))
    expect(matchesDirectoryResearch(undefined, 'all')).toBe(true)
    expect(matchesDirectoryResearch(undefined, 'recent_evidence')).toBe(false)
    expect(matchesDirectoryResearch(verification, 'recent_evidence')).toBe(true)
    expect(matchesDirectoryResearch({ ...verification, ownership_evidence_status: 'conflict' }, 'recent_evidence')).toBe(true)
    expect(matchesDirectoryResearch({ ...verification, doctors: [] }, 'recent_evidence')).toBe(true)
    expect(matchesDirectoryResearch({ ...verification, website_status: 'none_found' }, 'recent_evidence')).toBe(true)
    const negative = { ...verification, website_status: 'dead' as const, doctors: [] }
    expect(matchesDirectoryResearch(negative, 'recent_evidence')).toBe(false)
    expect(matchesDirectoryResearch(negative, 'any_research')).toBe(true)
    expect(matchesDirectoryResearch({ ...negative, doctors: [{ name: 'No source' }] }, 'recent_evidence')).toBe(false)
    for (const last_checked_at of ['', 'invalid', '2026-01-01', '2027-01-01']) {
      expect(matchesDirectoryResearch({ ...verification, last_checked_at }, 'recent_evidence')).toBe(false)
    }
    expect(matchesDirectoryResearch({ ...verification, verification_status: 'stale_recheck' }, 'recent_evidence')).toBe(false)
    expect(matchesDirectoryResearch({ ...negative, website_status: 'live', website_url: 'javascript:alert(1)' }, 'recent_evidence')).toBe(false)
  })

  it('uses the existing live-site ruling while preserving the original source for export', () => {
    const row = { ...practice, ...directoryContacts(practice, verification) }
    expect(row.contact_website).toBe('https://researched.example')
    expect(row.contact_website_source).toBe('Website-verified')
    expect(row.website).toBe('imported.example')
    const exported = Object.fromEntries(Object.entries(DIRECTORY_CONTACT_EXPORT_HEADERS).map(([key, label]) => [label, row[key as keyof typeof row]]))
    const csv = toCSVString([exported])
    for (const value of ['Alex Rivera', 'https://researched.example/team', 'https://researched.example',
      'imported.example', '2026-07-10T12:00:00Z', '312-555-0100', 'roster_verified', 'not a confirmed opening']) {
      expect(csv).toContain(value)
    }
  })

  it('finds an unlocated unresolved office by researched doctor name without bypassing ownership filters', () => {
    const row = { ...practice, ...directoryContacts(practice, verification) }
    expect(filterDirectoryRows([row], { search: '  alex RIVERA ' })).toEqual([row])
    expect(filterDirectoryRows([row], { search: 'Alex', buckets: ['unresolved'] })).toEqual([row])
    expect(filterDirectoryRows([row], { search: 'Alex', tiers: ['true_independent'] })).toEqual([])
  })

  it('renders contacts and source links in the actual default directory table', () => {
    verificationMap.office = verification
    const html = renderToStaticMarkup(React.createElement(PracticeDirectory, { practices: [practice], allPractices: [practice] }))
    for (const value of ['Contacts &amp; Research', 'Alex Rivera', 'href="https://researched.example/team"',
      'href="https://researched.example"', 'Checked 2026-07-10', 'not current staffing', 'openings unconfirmed',
      'On-file phone: 312-555-0100', 'Map location unavailable']) expect(html).toContain(value)
  })

  it('keeps dated research usable while clearly marking stale checks and ownership conflicts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01'))
    const html = render({ ...verification, ownership_evidence_status: 'conflict' })
    expect(directoryContacts(practice, { ...verification, ownership_evidence_status: 'conflict' }).research_ownership_status).toBe('conflict')
    expect(html).toContain('Recheck needed')
    expect(html).toContain('Ownership evidence conflicts')
    expect(html).toContain('Alex Rivera')
    vi.setSystemTime(new Date('2026-07-11'))
    expect(render(verification)).not.toContain('Recheck needed')
    expect(render({ ...verification, verification_status: 'stale_recheck' })).toContain('Recheck needed')
  })

  it('does not promote an unchecked or contradicted imported website into a verified contact', () => {
    expect(directoryContacts(practice).contact_website_source).toBe('Commercial estimate')
    expect(render()).toContain('Doctor research not on file')
    const dead = { ...verification, website_status: 'dead' as const }
    expect(directoryContacts(practice, dead).contact_website_source).toBe('Suspected wrong')
    expect(render(dead)).toContain('Imported website disputed')
    expect(render(dead)).not.toContain('href="https://imported.example"')
    expect(directoryContacts({ website: null }).contact_website).toBeNull()
    expect(directoryContacts(practice).researched_doctors).toBe('')
  })

  it('keeps every roster name searchable/exportable, with extra names expandable and unsafe links inert', () => {
    const v = { ...verification, doctors: [
      ...verification.doctors, { name: 'Second Doctor' }, { name: 'Third Doctor', source_url: 'javascript:alert(1)' },
    ] }
    const row = { ...practice, ...directoryContacts(practice, v) }
    expect(filterDirectoryRows([row], { search: 'Third Doctor' })).toEqual([row])
    expect(row.researched_doctors).toContain('Third Doctor')
    const html = render(v)
    expect(html).toContain('1 more name')
    expect(html).toContain('Third Doctor')
    expect(html).not.toContain('href="javascript:')
  })
})
