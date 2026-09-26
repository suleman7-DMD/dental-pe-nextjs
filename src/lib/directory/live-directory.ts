import type { Practice } from '@/lib/types'
import type { DirectoryWebCheck } from '@/lib/supabase/queries/directory-web-checks'
import { applyWebChecks } from './web-checks'
import { getOfficeCoordinates } from '@/lib/utils/directory-visibility'

export type LiveOffice = Pick<Practice, 'location_id' | 'npi' | 'practice_name' | 'doing_business_as' | 'provider_last_name' | 'address' | 'city' | 'state' | 'zip' | 'phone' | 'website' | 'latitude' | 'longitude' | 'network_id' | 'web_check'>

export const RESEARCH_STATES = ['confirmed', 'updated', 'unresolved', 'unchecked'] as const
export type ResearchState = typeof RESEARCH_STATES[number]
export const RESEARCH_META: Record<ResearchState, { label: string; color: string; description: string }> = {
  confirmed: { label: 'Confirmed', color: '#16836D', description: 'The validator confirmed a current general dental office at this address.' },
  updated: { label: 'Confirmed · updated', color: '#3975CE', description: 'Confirmed open, with a corrected name, address, suite, phone or website.' },
  unresolved: { label: 'Checked · unresolved', color: '#AF791C', description: 'The validator researched this record but could not confirm it. It remains in the directory.' },
  unchecked: { label: 'Not yet checked', color: '#939BA8', description: 'No rapid-validator result yet. Older ownership or provider research may still be on file.' },
}
export function researchState(p: Pick<Practice, 'web_check'>): ResearchState {
  switch (p.web_check?.effect) {
    case 'open_verified': return 'confirmed'
    case 'open_corrected': return 'updated'
    case 'listed_only': case 'needs_review': case 'no_web_evidence': return 'unresolved'
    default: return 'unchecked'
  }
}
// Deliberately conservative: a new street needs new coordinates. Suite-only
// corrections do not move the building. Never reuse the old dot after a move.
function streetKey(value: string) {
  const aliases: Record<string, string> = { north: 'n', south: 's', east: 'e', west: 'w', street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', boulevard: 'blvd', highway: 'hwy', lane: 'ln', court: 'ct' }
  return value.toLowerCase().split(/#|\b(?:suite|ste|unit|floor|fl|apt)\b/)[0]
    .replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).map(t => aliases[t] ?? t).join(' ')
}
export function mapIssue(p: LiveOffice): 'removed' | 'address_changed' | 'missing_coordinates' | null {
  if (p.web_check?.effect === 'removed') return 'removed'
  const check = p.web_check
  if (check?.effect === 'open_corrected' && check.observed.address &&
    (!check.as_seen.address || streetKey(check.observed.address) !== streetKey(check.as_seen.address))) return 'address_changed'
  if (check?.effect === 'open_corrected' && check.observed.zip && check.observed.zip !== check.zip) return 'address_changed'
  return getOfficeCoordinates(p) ? null : 'missing_coordinates'
}
export function summarizeDirectory(rows: LiveOffice[]) {
  const counts = { confirmed: 0, updated: 0, unresolved: 0, unchecked: 0 }
  for (const row of rows) counts[researchState(row)]++
  return counts
}
export interface DirectorySnapshot {
  visible: LiveOffice[]
  removed: LiveOffice[]
  zips: { zip: string; city: string }[]
  fetchedAt: string
  latestCheckAt: string | null
}
export function makeDirectorySnapshot(rows: LiveOffice[], checks: Record<string, DirectoryWebCheck>, zips: DirectorySnapshot['zips'], fetchedAt: string): DirectorySnapshot {
  const unique = [...new Map(rows.map(p => [p.location_id, p])).values()]
  const { visible, removed } = applyWebChecks(unique, checks)
  const latestCheckAt = [...visible, ...removed].map(p => p.web_check?.checked_at).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null
  return { visible, removed, zips, fetchedAt, latestCheckAt }
}
