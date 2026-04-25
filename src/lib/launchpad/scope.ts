import { LIVING_LOCATIONS } from "@/lib/constants/living-locations"

export const LAUNCHPAD_SCOPE_IDS = [
  "all_chicagoland",
  "west_loop_south_loop",
  "woodridge",
  "bolingbrook",
  // Boston Metro sub-presets
  "boston_core",
  "cambridge_somerville",
  "brookline_fenway",
  "newton_waltham",
] as const

export type LaunchpadScope = (typeof LAUNCHPAD_SCOPE_IDS)[number]
export type LaunchpadScopeId = LaunchpadScope

export const DEFAULT_LAUNCHPAD_SCOPE: LaunchpadScope = "all_chicagoland"

export interface LaunchpadScopeOption {
  id: LaunchpadScope
  label: string
  shortLabel: string
  livingLocationKey: keyof typeof LIVING_LOCATIONS
  centerZip: string
  centerLat: number
  centerLon: number
  zipCount: number
  zipCodes: string[]
  description: string
}

function toOption(
  id: LaunchpadScope,
  livingKey: keyof typeof LIVING_LOCATIONS,
  shortLabel: string,
  description: string
): LaunchpadScopeOption {
  const location = LIVING_LOCATIONS[livingKey]
  return {
    id,
    label: livingKey,
    shortLabel,
    livingLocationKey: livingKey,
    centerZip: location.center_zip,
    centerLat: location.center_lat,
    centerLon: location.center_lon,
    zipCount: location.commutable_zips.length,
    zipCodes: [...location.commutable_zips],
    description,
  }
}

export const LAUNCHPAD_SCOPES: LaunchpadScopeOption[] = [
  toOption(
    "all_chicagoland",
    "All Chicagoland",
    "All Chicagoland",
    "269 ZIPs across the metro — city + suburbs"
  ),
  toOption(
    "west_loop_south_loop",
    "West Loop / South Loop",
    "West Loop",
    "City-centric commute, 142 ZIPs"
  ),
  toOption(
    "woodridge",
    "Woodridge",
    "Woodridge",
    "DuPage / western suburbs, 129 ZIPs"
  ),
  toOption(
    "bolingbrook",
    "Bolingbrook",
    "Bolingbrook",
    "Will County / southwest corridor, 127 ZIPs"
  ),
  // Boston Metro sub-presets
  toOption(
    "boston_core",
    "Boston Core",
    "Boston Core",
    "Back Bay, South End, Roxbury, Mission Hill, Fenway, Allston, Brighton — 8 ZIPs"
  ),
  toOption(
    "cambridge_somerville",
    "Cambridge + Somerville",
    "Cambridge",
    "Cambridge + Somerville — 6 ZIPs"
  ),
  toOption(
    "brookline_fenway",
    "Brookline + Fenway",
    "Brookline",
    "Brookline, Chestnut Hill — 3 ZIPs"
  ),
  toOption(
    "newton_waltham",
    "Newton + Waltham",
    "Newton",
    "Newton, Waltham — 4 ZIPs"
  ),
]

export const LAUNCHPAD_SCOPE_BY_ID: Record<LaunchpadScope, LaunchpadScopeOption> =
  LAUNCHPAD_SCOPES.reduce(
    (acc, option) => {
      acc[option.id] = option
      return acc
    },
    {} as Record<LaunchpadScope, LaunchpadScopeOption>
  )

const LAUNCHPAD_SCOPE_ID_SET: ReadonlySet<string> = new Set(LAUNCHPAD_SCOPE_IDS)

export function isLaunchpadScope(value: unknown): value is LaunchpadScope {
  return typeof value === "string" && LAUNCHPAD_SCOPE_ID_SET.has(value)
}

export function getLaunchpadScopeOption(scope: LaunchpadScope): LaunchpadScopeOption {
  return LAUNCHPAD_SCOPE_BY_ID[scope] ?? LAUNCHPAD_SCOPE_BY_ID[DEFAULT_LAUNCHPAD_SCOPE]
}

export function resolveLaunchpadZipCodes(scope: LaunchpadScope): string[] {
  return getLaunchpadScopeOption(scope).zipCodes
}

export function getLaunchpadScopeLabel(scope: LaunchpadScope): string {
  return getLaunchpadScopeOption(scope).label
}

export function isZipCommutable(scope: LaunchpadScope, zip: string | null | undefined): boolean {
  if (!zip) return false
  const option = getLaunchpadScopeOption(scope)
  return option.zipCodes.includes(zip)
}
