import { formatNetworkId, tierToBucket, type HeadlineBucket } from '@/lib/census/ownership-truth'
import type { Practice } from '@/lib/types'

export const DEFAULT_DIRECTORY_VIEW = 'all'

/** Stored coordinates only. Numeric validity cannot establish source accuracy. */
export function getOfficeCoordinates(p: { latitude?: number | string | null; longitude?: number | string | null }): { lat: number; lon: number } | null {
  const parse = (value: number | string | null | undefined) =>
    value == null || (typeof value === 'string' && value.trim() === '') ? NaN : Number(value)
  const lat = parse(p.latitude)
  const lon = parse(p.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0 || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

/** Map eligibility never affects directory/search eligibility. */
export function filterDirectoryRows<T extends Practice & { display_name?: string }>(rows: T[], options: {
  search?: string
  buckets?: HeadlineBucket[]
  tiers?: string[]
} = {}): T[] {
  const term = (options.search ?? '').trim().toLowerCase()
  return rows.filter(p => {
    if (options.buckets?.length && !options.buckets.includes(tierToBucket(p.ownership_tier))) return false
    if (options.tiers?.length && (!p.ownership_tier || !options.tiers.includes(p.ownership_tier))) return false
    if (!term) return true
    return [p.practice_name, p.display_name, p.doing_business_as, p.address, p.city,
      p.network_id, p.network_id ? formatNetworkId(p.network_id) : null]
      .some(value => (value ?? '').toLowerCase().includes(term)) || (p.zip ?? '').toString().startsWith(term)
  })
}
