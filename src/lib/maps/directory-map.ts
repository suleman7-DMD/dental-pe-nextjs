import { mapIssue, researchState, type LiveOffice } from '@/lib/directory/live-directory'

export const MAP_STATES = ['confirmed', 'unresolved', 'unchecked'] as const
export type MapState = typeof MAP_STATES[number]
// Three groups only. Verified and corrected ("resolved") offices are one group.
// Colors avoid the population (teal→purple→magenta→yellow), income (orange)
// and education (purple) ramps so dots stay distinct on every map layer.
export const MAP_META = {
  confirmed: { label: 'Checked · confirmed', short: 'Confirmed', color: '#12A150', description: 'Checked and confirmed as a current GP office, including offices whose details were corrected (resolved).' },
  unresolved: { label: 'Checked · unresolved', short: 'Unresolved', color: '#F2A10C', description: 'Checked by the validator, but it could not confirm the office yet. It stays in the directory.' },
  unchecked: { label: 'Not yet checked', short: 'Unchecked', color: '#64748B', description: 'No office-validator result yet.' },
} as const
export function mapState(p: Pick<LiveOffice, 'web_check'>): MapState {
  const state = researchState(p)
  return state === 'updated' ? 'confirmed' : state
}
export function mapRoster(rows: LiveOffice[], selected: MapState | 'all' | readonly MapState[] = 'all') {
  const current = rows.filter(p => p.web_check?.effect !== 'removed')
  const counts = { confirmed: 0, unresolved: 0, unchecked: 0 }
  current.forEach(p => counts[mapState(p)]++)
  const keep = (s: MapState) => selected === 'all' || (typeof selected === 'string' ? s === selected : selected.includes(s))
  const listed = current.filter(p => keep(mapState(p)))
  const mapped = listed.filter(p => !mapIssue(p))
  return { counts, listed, mapped,
    missing: listed.filter(p => mapIssue(p) === 'missing_coordinates').length,
    moved: listed.filter(p => mapIssue(p) === 'address_changed').length,
    geocoded: mapped.filter(p => p.coord_source === 'census_geocoder').length,
  }
}
/**
 * Location ids whose map status changed between two live snapshots. Offices that
 * merely enter or leave the selection (search, area) are not status changes.
 */
export function changedStatuses(previous: ReadonlyMap<string, MapState>, next: ReadonlyMap<string, MapState>): string[] {
  const changed: string[] = []
  for (const [id, state] of next) { const before = previous.get(id); if (before && before !== state) changed.push(id) }
  return changed
}
