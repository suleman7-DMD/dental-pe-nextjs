import { describe, it, expect } from 'vitest'
import { mapRoster, mapState } from '@/lib/maps/directory-map'
import { applyOfficeGeocodes, mapIssue, type LiveOffice } from '@/lib/directory/live-directory'
import type { DirectoryWebCheck } from '@/lib/supabase/queries/directory-web-checks'
const row = (id:string, effect?:DirectoryWebCheck['effect']) => ({ location_id:id, npi:id, address:'100 Main St', latitude:41.8, longitude:-87.6,
  web_check:effect ? {effect, observed:{}, as_seen:{address:'100 Main St'}} as DirectoryWebCheck : undefined,
}) as LiveOffice

describe('three map statuses use the live directory universe', () => {
  it('combines verified and corrected; never treats listings as confirmed', () => {
    expect(mapState(row('a','open_verified'))).toBe('confirmed')
    expect(mapState(row('a','open_corrected'))).toBe('confirmed')
    for (const effect of ['listed_only','needs_review','no_web_evidence'] as const) expect(mapState(row('a',effect))).toBe('unresolved')
    expect(mapState(row('a'))).toBe('unchecked')
  })
  it('reconciles three disjoint groups and removes records even when coordinates exist', () => {
    const rows = [row('a','open_verified'),row('b','open_corrected'),row('c','needs_review'),row('d'),row('e','removed')]
    const all = mapRoster(rows)
    expect(all.counts).toEqual({confirmed:2,unresolved:1,unchecked:1})
    expect(all.mapped.map(p=>p.location_id)).toEqual(['a','b','c','d'])
    expect(mapRoster(rows,'confirmed').mapped.map(p=>p.location_id)).toEqual(['a','b'])
    expect(mapRoster(rows,'unresolved').listed.map(p=>p.location_id)).toEqual(['c'])
    expect(mapRoster(rows,'unchecked').listed.map(p=>p.location_id)).toEqual(['d'])
  })
  it('reconciles mapped, missing coordinates and changed addresses within the selected status', () => {
    const missing = {...row('a','open_verified'),latitude:null}
    const moved = row('b','open_corrected'); moved.web_check!.observed.address = '200 Main St'
    const data = mapRoster([missing,moved,row('c','open_verified'),row('d')],'confirmed')
    expect(data.listed.length).toBe(data.mapped.length + data.missing + data.moved)
    expect(data).toMatchObject({missing:1,moved:1})
    expect(data.mapped.map(p=>p.location_id)).toEqual(['c'])
  })
  it('updates classification and removes dots on the next snapshot', () => {
    expect(mapRoster([row('a')],'unchecked').mapped).toHaveLength(1)
    expect(mapRoster([row('a','open_corrected')],'unchecked').mapped).toHaveLength(0)
    expect(mapRoster([row('a','open_corrected')],'confirmed').mapped).toHaveLength(1)
    expect(mapRoster([row('a','removed')],'confirmed').mapped).toHaveLength(0)
  })
})

describe('address geocode snapshot fills missing and moved dots', () => {
  const geo = { a: { address: '100 Main St', lat: 41.9, lon: -87.7, precision: 'exact' }, b: { address: '200 Main St', lat: 41.95, lon: -87.65, precision: 'exact' }, c: { address: '999 Old Rd', lat: 42, lon: -88, precision: 'exact' } }
  it('fills missing coordinates, follows a corrected street, and never overrides stored coordinates', () => {
    const missing = { ...row('a', 'open_verified'), latitude: null, longitude: null }
    const moved = row('b', 'open_corrected'); moved.address = '200 Main St'; moved.web_check!.observed.address = '200 Main St'
    const stored = row('d', 'open_verified')
    const out = applyOfficeGeocodes([missing, moved, stored], { ...geo, d: { address: '100 Main St', lat: 1, lon: 1, precision: 'exact' } })
    expect(out[0]).toMatchObject({ latitude: 41.9, longitude: -87.7, coord_source: 'census_geocoder' })
    expect(out[1]).toMatchObject({ latitude: 41.95, coord_source: 'census_geocoder' })
    expect(out[2]).toBe(stored)
    const roster = mapRoster(out)
    expect(roster).toMatchObject({ missing: 0, moved: 0, geocoded: 2 })
    expect(roster.mapped).toHaveLength(3)
  })
  it('drops a geocode once the displayed address no longer matches it', () => {
    const changed = { ...row('c', 'open_verified'), latitude: null, longitude: null }
    const [out] = applyOfficeGeocodes([changed], geo)
    expect(out.coord_source).toBeUndefined()
    expect(mapIssue(out)).toBe('missing_coordinates')
  })
})
