import { describe, expect, it } from 'vitest'
import { makeDirectorySnapshot, mapIssue, summarizeDirectory } from '@/lib/directory/live-directory'
import type { Practice } from '@/lib/types'
import type { DirectoryWebCheck } from '@/lib/supabase/queries/directory-web-checks'
const row = (id: string) => ({ location_id: id, address: '1200 Sterling Ave', zip: '60056', latitude: 42, longitude: -87.7 }) as Practice
const check = (id: string, effect: DirectoryWebCheck['effect'], observed = {}): DirectoryWebCheck => ({
  location_id: id, zip: '60056', effect, decision: '', reason: null, duplicate_of: null, gp_scope: null,
  observed, as_seen: { address: '1200 Sterling Ave' }, signals: [], ties_by: [], evidence: [], note: null, checked_at: '2026-09-26T00:00:00Z',
})
describe('single live directory universe', () => {
  it('partitions statuses exactly and excludes a newly removed office from the list and map', () => {
    const rows = ['a','b','c','d','e'].map(row)
    const checks = { a: check('a','open_verified'), b: check('b','open_corrected', {suite:'200'}), c: check('c','listed_only'), e:check('e','removed') }
    const before = makeDirectorySnapshot(rows, {}, [], 'now')
    const after = makeDirectorySnapshot(rows, checks, [], 'now')
    expect(before.visible).toHaveLength(5)
    expect(after.visible).toHaveLength(4)
    expect(after.removed.map(p=>p.location_id)).toEqual(['e'])
    expect(summarizeDirectory(after.visible)).toEqual({confirmed:1,updated:1,unresolved:1,unchecked:1})
    expect(after.visible.filter(p=>!mapIssue(p))).toHaveLength(4)
    expect(mapIssue(after.removed[0])).toBe('removed')
    expect(after.visible[1].address).toBe('1200 Sterling Ave, Ste 200')
  })
  it('withholds old coordinates after a street move but preserves them for a suite correction', () => {
    const moved = { ...row('a'), web_check: check('a','open_corrected',{address:'1202 Sterling Ave'}) }
    expect(mapIssue(moved)).toBe('address_changed')
    expect(mapIssue({...moved,web_check:check('a','open_corrected',{address:'1200 Sterling Avenue #200'})})).toBeNull()
    expect(mapIssue({...row('a'),latitude:null})).toBe('missing_coordinates')
  })
  it('keeps no-web-evidence records and counts each stable location once', () => {
    const data = makeDirectorySnapshot([row('a'),row('a')],{a:check('a','no_web_evidence')},[],'now')
    expect(data.visible).toHaveLength(1)
    expect(summarizeDirectory(data.visible).unresolved).toBe(1)
  })
})
