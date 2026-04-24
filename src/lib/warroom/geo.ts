import { ZIP_CENTROIDS } from "@/lib/constants/zip-centroids"
import type { RankedTarget, WarroomDealRecord } from "./signals"

const EARTH_RADIUS_MILES = 3958.7613

type LatLng = [number, number]

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const [lat1, lng1] = a
  const [lat2, lng2] = b
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const lat1Rad = toRadians(lat1)
  const lat2Rad = toRadians(lat2)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function getZipCentroid(zip: string | null | undefined): LatLng | null {
  if (!zip) return null
  const trimmed = zip.slice(0, 5)
  const entry = ZIP_CENTROIDS[trimmed]
  return entry ?? null
}

export function getTargetCoords(target: RankedTarget): LatLng | null {
  if (target.latitude != null && target.longitude != null) {
    return [target.latitude, target.longitude]
  }
  return getZipCentroid(target.zip)
}

export function getDealCoords(deal: WarroomDealRecord): LatLng | null {
  return getZipCentroid(deal.target_zip)
}

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear()
  const months = to.getMonth() - from.getMonth()
  return years * 12 + months
}

export interface NearbyDealMatch {
  deal: WarroomDealRecord
  distanceMiles: number
}

export function filterNearbyDealsWithin(
  deals: WarroomDealRecord[],
  target: RankedTarget,
  { withinMiles, withinMonths }: { withinMiles: number; withinMonths: number }
): NearbyDealMatch[] {
  const origin = getTargetCoords(target)
  if (!origin) return []
  const now = new Date()
  const matches: NearbyDealMatch[] = []

  for (const deal of deals) {
    if (!deal.deal_date) continue
    const dealDate = new Date(deal.deal_date)
    if (Number.isNaN(dealDate.getTime())) continue
    if (monthsBetween(dealDate, now) > withinMonths) continue

    const dealCoords = getDealCoords(deal)
    if (!dealCoords) continue
    const distance = haversineMiles(origin, dealCoords)
    if (distance > withinMiles) continue
    matches.push({ deal, distanceMiles: distance })
  }

  matches.sort((a, b) => a.distanceMiles - b.distanceMiles)
  return matches
}
