import type { LaunchpadPracticeRecord } from "./signals"
import { displayName, legalEntityName } from "@/lib/census/display-name"

type DisplayInput = Pick<
  LaunchpadPracticeRecord,
  "doing_business_as" | "practice_name" | "provider_last_name" | "npi"
> & {
  address?: string | null
  city?: string | null
}

// Both helpers delegate to the shared §2.1 display-name contract — the
// launchpad keeps its historical function names but no private rules.
export function getPracticeDisplayName(practice: DisplayInput): string {
  return displayName(practice)
}

export function getPracticeSecondaryName(practice: DisplayInput): string | null {
  return legalEntityName(practice)
}
