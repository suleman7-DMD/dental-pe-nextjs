import type { LaunchpadPracticeRecord } from "./signals"

type DisplayInput = Pick<
  LaunchpadPracticeRecord,
  "doing_business_as" | "practice_name" | "provider_first_name" | "provider_last_name" | "npi"
>

function clean(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (/^null$/i.test(trimmed) || /^none$/i.test(trimmed)) return null
  return trimmed
}

export function getPracticeDisplayName(practice: DisplayInput): string {
  const dba = clean(practice.doing_business_as)
  if (dba) return dba

  const name = clean(practice.practice_name)
  if (name) return name

  const last = clean(practice.provider_last_name)
  const first = clean(practice.provider_first_name)
  if (last) return first ? `Dr. ${first} ${last}` : `Dr. ${last}`

  return `NPI ${practice.npi}`
}

export function getPracticeSecondaryName(practice: DisplayInput): string | null {
  const dba = clean(practice.doing_business_as)
  const name = clean(practice.practice_name)
  if (dba && name && dba.toLowerCase() !== name.toLowerCase()) return name
  return null
}
