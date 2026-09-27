export type CommutePoint = { lon: number; lat: number }
export interface CommuteLeg {
  seconds: number; meters: number; geometry: GeoJSON.LineString
  roads: string; snapMeters: number
}
export interface CommuteResult {
  date: string; timezone: string; morning: CommuteLeg; evening: CommuteLeg; fetchedAt: string; avoidTolls: boolean
}
/** Next occurrence, always in the future; weekday and clock use Chicago, not the browser timezone. */
export function nextWeekday(weekday: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = (type: string) => parts.find(p => p.type === type)!.value
  const date = new Date(`${value('year')}-${value('month')}-${value('day')}T12:00:00Z`)
  const days = (weekday - date.getUTCDay() + 7) % 7 || 7
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function commuteArrival(hour: number, minute: number, seconds: number): string {
  const total = hour * 60 + minute + Math.round(seconds / 60)
  const h = Math.floor(total / 60) % 24
  return `${h % 12 || 12}:${String(total % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
export function travelTime(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`
}
