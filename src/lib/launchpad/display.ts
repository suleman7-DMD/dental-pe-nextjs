export interface PracticeNameSource {
  doing_business_as?: string | null
  practice_name?: string | null
  npi: string
}

export function getPracticeDisplayName(practice: PracticeNameSource): string {
  return practice.doing_business_as ?? practice.practice_name ?? `NPI ${practice.npi}`
}
