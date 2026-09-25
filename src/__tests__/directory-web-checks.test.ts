import { describe, expect, it } from 'vitest'
import {
  REMOVAL_REASON_LABELS,
  WEB_CHECK_EFFECT_META,
  applyWebCheck,
  applyWebChecks,
  isRemovedByWebCheck,
} from '@/lib/directory/web-checks'
import type { DirectoryWebCheck, WebCheckEffect } from '@/lib/supabase/queries/directory-web-checks'
import { displayName } from '@/lib/census/display-name'

function check(location_id: string, effect: WebCheckEffect, extra: Partial<DirectoryWebCheck> = {}): DirectoryWebCheck {
  return {
    location_id, zip: '60056', effect, decision: 'VALID', reason: null, duplicate_of: null, gp_scope: 'gp',
    observed: {}, as_seen: { name: 'Mui Dental' }, signals: [], ties_by: [], evidence: [], note: null,
    checked_at: '2026-09-25', ...extra,
  }
}

const row = (location_id: string) => ({
  location_id, practice_name: 'MUI DENTAL LTD', doing_business_as: null as string | null,
  phone: '(847) 253-5901', website: null as string | null, address: '221 w prospect ave',
})

describe('directory web-check overlay', () => {
  it('removes only rows whose effect is removed', () => {
    const checks = {
      a: check('a', 'removed', { decision: 'NOT_CURRENT_GP', reason: 'closed' }),
      b: check('b', 'no_web_evidence'),
      c: check('c', 'listed_only'),
      d: check('d', 'needs_review'),
    }
    const { visible, removed } = applyWebChecks([row('a'), row('b'), row('c'), row('d'), row('e')], checks)
    expect(removed.map((r) => r.location_id)).toEqual(['a'])
    expect(visible.map((r) => r.location_id)).toEqual(['b', 'c', 'd', 'e'])
    expect(isRemovedByWebCheck({ location_id: 'a' }, checks)).toBe(true)
    expect(isRemovedByWebCheck({ location_id: 'b' }, checks)).toBe(false)
    expect(isRemovedByWebCheck({ location_id: null }, checks)).toBe(false)
  })

  it('shows web-seen fields only for corrected rows, keeping the legal name', () => {
    const corrected = applyWebCheck(row('a'), check('a', 'open_corrected', {
      observed: { name: 'Restore Dental Studio', phone: '(847) 253-8000', website: 'https://restoredental.com/',
        address: '221 W Prospect Ave', suite: '2' },
    }))
    expect(displayName(corrected)).toBe('Restore Dental Studio')
    expect(corrected.practice_name).toBe('MUI DENTAL LTD')
    expect(corrected.phone).toBe('(847) 253-8000')
    expect(corrected.address).toBe('221 W Prospect Ave, Ste 2')
    expect(corrected.web_check?.effect).toBe('open_corrected')

    const listed = applyWebCheck(row('a'), check('a', 'listed_only', { observed: { name: 'Listing Name' } }))
    expect(listed.doing_business_as).toBeNull()
    expect(listed.web_check?.effect).toBe('listed_only')
  })

  it('leaves rows without a check untouched', () => {
    const r = row('z')
    expect(applyWebCheck(r, undefined)).toBe(r)
  })

  it('labels every effect and removal reason', () => {
    for (const e of ['removed', 'open_corrected', 'open_verified', 'listed_only', 'needs_review', 'no_web_evidence'] as const) {
      expect(WEB_CHECK_EFFECT_META[e].label).toBeTruthy()
    }
    expect(Object.keys(REMOVAL_REASON_LABELS).sort()).toEqual(
      ['closed', 'duplicate', 'home_or_registration', 'moved', 'nonclinical', 'specialist_only'])
    expect(WEB_CHECK_EFFECT_META.no_web_evidence.why).toMatch(/does not mean it is closed/)
  })
})
