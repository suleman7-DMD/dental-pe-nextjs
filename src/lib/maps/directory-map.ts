import { mapIssue, researchState, type LiveOffice } from '@/lib/directory/live-directory'

export const MAP_STATES = ['confirmed', 'unresolved', 'unchecked'] as const
export type MapState = typeof MAP_STATES[number]
export const MAP_META = {
  confirmed: { label: 'Checked · confirmed', color: '#007F73', description: 'Confirmed current GP office, including offices with corrected details.' },
  unresolved: { label: 'Checked · unresolved', color: '#D76A08', description: 'Researched, but still needs a clear answer.' },
  unchecked: { label: 'Not yet checked', color: '#6455C3', description: 'No rapid-validator result yet.' },
} as const
export function mapState(p: Pick<LiveOffice, 'web_check'>): MapState {
  const state = researchState(p)
  return state === 'updated' ? 'confirmed' : state
}
export function mapRoster(rows: LiveOffice[], selected: MapState | 'all' = 'all') {
  const current = rows.filter(p => p.web_check?.effect !== 'removed')
  const counts = { confirmed: 0, unresolved: 0, unchecked: 0 }
  current.forEach(p => counts[mapState(p)]++)
  const listed = current.filter(p => selected === 'all' || mapState(p) === selected)
  const mapped = listed.filter(p => !mapIssue(p))
  return { counts, listed, mapped,
    missing: listed.filter(p => mapIssue(p) === 'missing_coordinates').length,
    moved: listed.filter(p => mapIssue(p) === 'address_changed').length,
  }
}
