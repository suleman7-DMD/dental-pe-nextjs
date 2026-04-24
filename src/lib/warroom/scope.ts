import { LIVING_LOCATIONS } from "@/lib/constants/living-locations"
import { ZIP_CENTROIDS } from "@/lib/constants/zip-centroids"

export type WarroomScopeKind =
  | "us"
  | "chicagoland"
  | "subzone"
  | "polygon"
  | "saved"
  | "zip"

export interface BoundingBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export const WARROOM_SCOPE_IDS = [
  "chicagoland",
  "west_loop_south_loop",
  "woodridge",
  "bolingbrook",
] as const

export type WarroomScope = (typeof WARROOM_SCOPE_IDS)[number]
export type WarroomScopeId = WarroomScope

export interface WarroomScopeOption {
  id: WarroomScope
  label: string
  shortLabel: string
  livingLocationKey: keyof typeof LIVING_LOCATIONS
  centerZip: string
  zipCount: number
  zipCodes: string[]
}

function zipSetScope(
  id: WarroomScope,
  label: keyof typeof LIVING_LOCATIONS,
  shortLabel: string
): WarroomScopeOption {
  const location = LIVING_LOCATIONS[label]
  return {
    id,
    label,
    shortLabel,
    livingLocationKey: label,
    centerZip: location.center_zip,
    zipCount: location.commutable_zips.length,
    zipCodes: [...location.commutable_zips],
  }
}

export const WARROOM_SCOPES: WarroomScopeOption[] = [
  zipSetScope("chicagoland", "All Chicagoland", "Chicagoland"),
  zipSetScope("west_loop_south_loop", "West Loop / South Loop", "West Loop"),
  zipSetScope("woodridge", "Woodridge", "Woodridge"),
  zipSetScope("bolingbrook", "Bolingbrook", "Bolingbrook"),
]

export const WARROOM_SCOPE_BY_ID: Record<WarroomScope, WarroomScopeOption> = {
  chicagoland: WARROOM_SCOPES[0],
  west_loop_south_loop: WARROOM_SCOPES[1],
  woodridge: WARROOM_SCOPES[2],
  bolingbrook: WARROOM_SCOPES[3],
}

export const DEFAULT_WARROOM_SCOPE: WarroomScope = "chicagoland"
export const DEFAULT_WARROOM_SCOPE_ID: WarroomScopeId = DEFAULT_WARROOM_SCOPE

const WARROOM_SCOPE_ID_SET: ReadonlySet<string> = new Set(WARROOM_SCOPE_IDS)

export function isWarroomScope(value: unknown): value is WarroomScope {
  return typeof value === "string" && WARROOM_SCOPE_ID_SET.has(value)
}

export const isWarroomScopeId = isWarroomScope

export function getWarroomScopeOption(scope: WarroomScope) {
  return WARROOM_SCOPE_BY_ID[scope] ?? WARROOM_SCOPE_BY_ID[DEFAULT_WARROOM_SCOPE]
}

export type GeoJsonPosition = readonly [number, number, ...number[]]
export type GeoJsonRing = readonly GeoJsonPosition[]
export type GeoJsonPolygonRings = readonly GeoJsonRing[]

export interface GeoJsonLike {
  type?: string
  coordinates?: unknown
  geometry?: unknown
  features?: unknown
  properties?: Record<string, unknown>
}

export type WarroomScopeValue = string | string[] | GeoJsonLike

export interface WarroomDataScope {
  kind: WarroomScopeKind
  value?: WarroomScopeValue
}

export type WarroomScopeInput = WarroomScope | WarroomDataScope

export const DEFAULT_WARROOM_DATA_SCOPE: WarroomDataScope = {
  kind: "chicagoland",
}

const CORE_CHICAGOLAND_ZIPS = [
  "60491", "60439", "60441", "60540", "60564", "60565", "60563", "60527",
  "60515", "60516", "60517", "60532", "60559", "60514", "60521", "60523",
  "60148", "60440", "60490", "60504", "60502", "60431", "60435", "60586",
  "60585", "60503", "60554", "60543", "60560",
] as const

const CHI_NORTH_ZIPS = [
  "60004", "60005", "60007", "60008", "60010", "60015", "60016", "60017",
  "60018", "60022", "60025", "60026", "60035", "60037", "60038", "60040",
  "60045", "60053", "60056", "60061", "60062", "60067", "60068", "60069",
  "60070", "60074", "60076", "60077", "60089", "60090", "60091", "60093",
  "60201", "60202", "60203", "60712", "60714",
] as const

const CHI_CITY_ZIPS = [
  "60601", "60602", "60603", "60604", "60605", "60606", "60607", "60608",
  "60609", "60610", "60611", "60612", "60613", "60614", "60615", "60616",
  "60617", "60618", "60619", "60620", "60621", "60622", "60623", "60624",
  "60625", "60626", "60628", "60629", "60630", "60631", "60632", "60633",
  "60634", "60636", "60637", "60638", "60639", "60640", "60641", "60642",
  "60643", "60644", "60645", "60646", "60647", "60649", "60651", "60652",
  "60653", "60654", "60655", "60656", "60657", "60659", "60660", "60661",
] as const

const CHI_SOUTH_ZIPS = [
  "60406", "60409", "60411", "60412", "60415", "60418", "60419", "60422",
  "60423", "60425", "60426", "60428", "60429", "60430", "60438", "60442",
  "60443", "60445", "60449", "60452", "60453", "60454", "60455", "60456",
  "60457", "60458", "60459", "60461", "60462", "60463", "60464", "60465",
  "60466", "60467", "60468", "60469", "60471", "60472", "60473", "60475",
  "60476", "60477", "60478", "60480", "60481", "60482", "60484", "60487",
  "60501", "60803", "60804", "60805", "60827",
] as const

const CHI_WEST_ZIPS = [
  "60101", "60103", "60104", "60106", "60107", "60108", "60126", "60130",
  "60131", "60133", "60137", "60138", "60139", "60143", "60153", "60154",
  "60155", "60160", "60161", "60162", "60163", "60164", "60165", "60171",
  "60176", "60181", "60187", "60188", "60189", "60190", "60191", "60193",
  "60194", "60195", "60301", "60302", "60304", "60305", "60402", "60501",
  "60513", "60525", "60526", "60534", "60546", "60555", "60558", "60706",
  "60707",
] as const

const CHI_FAR_WEST_ZIPS = [
  "60110", "60118", "60119", "60120", "60121", "60122", "60123", "60124",
  "60134", "60144", "60151", "60172", "60173", "60174", "60175", "60185",
  "60186", "60505", "60506", "60510", "60511", "60512", "60519", "60536",
  "60537", "60538", "60539", "60541", "60542", "60544", "60545", "60548",
] as const

const CHI_FAR_SOUTH_ZIPS = [
  "60403", "60404", "60410", "60416", "60421", "60432", "60433", "60434",
  "60436", "60446", "60447", "60448", "60450", "60451",
] as const

export const CHICAGOLAND_SUBZONE_ZIPS = {
  core: [...CORE_CHICAGOLAND_ZIPS],
  north: [...CHI_NORTH_ZIPS],
  city: [...CHI_CITY_ZIPS],
  south: [...CHI_SOUTH_ZIPS],
  west: [...CHI_WEST_ZIPS],
  far_west: [...CHI_FAR_WEST_ZIPS],
  far_south: [...CHI_FAR_SOUTH_ZIPS],
} as const satisfies Record<string, readonly string[]>

export type ChicagolandSubzone = keyof typeof CHICAGOLAND_SUBZONE_ZIPS

export const CHICAGOLAND_SUBZONE_LABELS: Record<ChicagolandSubzone, string> = {
  core: "Core DuPage/Will Corridor",
  north: "North Shore / North Suburbs",
  city: "Chicago City",
  south: "South Suburbs",
  west: "Inner West Suburbs",
  far_west: "Far West / Fox Valley",
  far_south: "Far South / Joliet",
}

const SUBZONE_ALIASES: Record<string, ChicagolandSubzone> = {
  core: "core",
  original: "core",
  naperville: "core",
  dupage: "core",
  dupage_will: "core",
  chicagoland_core: "core",
  north: "north",
  chi_north: "north",
  chicago_north: "north",
  north_shore: "north",
  city: "city",
  chicago: "city",
  chi_city: "city",
  chicago_city: "city",
  south: "south",
  chi_south: "south",
  chicago_south: "south",
  west: "west",
  inner_west: "west",
  chi_west: "west",
  chicago_west: "west",
  far_west: "far_west",
  chi_far_west: "far_west",
  chicago_far_west: "far_west",
  fox_valley: "far_west",
  aurora_elgin: "far_west",
  far_south: "far_south",
  chi_far_south: "far_south",
  chicago_far_south: "far_south",
  joliet: "far_south",
}

function keyify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function dedupeZipCodes(zipCodes: string[]): string[] {
  return Array.from(new Set(zipCodes))
}

export function normalizeZipCodes(input: string | string[] | undefined): string[] {
  if (!input) return []
  const values = Array.isArray(input) ? input : [input]
  return dedupeZipCodes(
    values.flatMap((value) => {
      const matches = value.match(/\d{5}/g)
      if (matches) return matches
      const digits = value.replace(/\D/g, "")
      return digits.length >= 5 ? [digits.slice(0, 5)] : []
    })
  )
}

export function normalizeSubzoneName(value: string | undefined): ChicagolandSubzone | null {
  if (!value) return null
  return SUBZONE_ALIASES[keyify(value)] ?? null
}

export function getChicagolandZipCodes(): string[] {
  return [...LIVING_LOCATIONS["All Chicagoland"].commutable_zips]
}

export function getSubzoneZipCodes(value: string | undefined): string[] {
  const subzone = normalizeSubzoneName(value)
  return subzone ? [...CHICAGOLAND_SUBZONE_ZIPS[subzone]] : []
}

function getLivingLocationZipCodes(value: string): string[] {
  const requestedKey = keyify(value)
  const locationName = Object.keys(LIVING_LOCATIONS).find(
    (name) => keyify(name) === requestedKey
  )
  return locationName ? [...LIVING_LOCATIONS[locationName].commutable_zips] : []
}

function getSavedZipCodes(value: WarroomScopeValue | undefined): string[] {
  if (Array.isArray(value)) return normalizeZipCodes(value)
  if (typeof value !== "string") return []
  const livingZips = getLivingLocationZipCodes(value)
  if (livingZips.length > 0) return livingZips
  const subzoneZips = getSubzoneZipCodes(value)
  return subzoneZips.length > 0 ? subzoneZips : normalizeZipCodes(value)
}

export function normalizeWarroomDataScope(scope: WarroomScopeInput | undefined): WarroomDataScope {
  if (!scope) return DEFAULT_WARROOM_DATA_SCOPE
  if (typeof scope !== "string") return scope
  if (scope === "chicagoland") return { kind: "chicagoland" }
  return { kind: "saved", value: getWarroomScopeOption(scope).livingLocationKey }
}

function isPosition(value: unknown): value is GeoJsonPosition {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function normalizeRing(value: unknown): GeoJsonRing | null {
  if (!Array.isArray(value)) return null
  const ring = value.filter(isPosition)
  return ring.length >= 3 ? ring : null
}

function normalizePolygonCoordinates(value: unknown): GeoJsonPolygonRings | null {
  if (!Array.isArray(value)) return null
  const rings = value.map(normalizeRing).filter((ring): ring is GeoJsonRing => ring !== null)
  return rings.length > 0 ? rings : null
}

function normalizeMultiPolygonCoordinates(value: unknown): GeoJsonPolygonRings[] {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizePolygonCoordinates)
    .filter((polygon): polygon is GeoJsonPolygonRings => polygon !== null)
}

export function extractGeoJsonPolygons(value: unknown): GeoJsonPolygonRings[] {
  if (!value || typeof value !== "object") return []
  const candidate = value as GeoJsonLike
  if (candidate.type === "Feature") return extractGeoJsonPolygons(candidate.geometry)
  if (candidate.type === "FeatureCollection" && Array.isArray(candidate.features)) {
    return candidate.features.flatMap(extractGeoJsonPolygons)
  }
  if (candidate.type === "MultiPolygon") {
    return normalizeMultiPolygonCoordinates(candidate.coordinates)
  }
  if (candidate.type === "Polygon") {
    const polygon = normalizePolygonCoordinates(candidate.coordinates)
    return polygon ? [polygon] : []
  }
  const polygon = normalizePolygonCoordinates(candidate.coordinates)
  return polygon ? [polygon] : normalizeMultiPolygonCoordinates(candidate.coordinates)
}

function pointInRing(lon: number, lat: number, ring: GeoJsonRing): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export function isLatLonInPolygonRings(
  latitude: number,
  longitude: number,
  polygon: GeoJsonPolygonRings
): boolean {
  const [outerRing, ...holes] = polygon
  if (!outerRing || !pointInRing(longitude, latitude, outerRing)) return false
  return !holes.some((hole) => pointInRing(longitude, latitude, hole))
}

export function isLatLonInGeoJson(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  value: unknown
): boolean {
  if (latitude == null || longitude == null) return false
  return extractGeoJsonPolygons(value).some((polygon) =>
    isLatLonInPolygonRings(latitude, longitude, polygon)
  )
}

export function getGeoJsonBoundingBox(value: unknown): BoundingBox | null {
  const positions = extractGeoJsonPolygons(value).flatMap((polygon) =>
    polygon.flatMap((ring) => ring)
  )
  if (positions.length === 0) return null
  const lons = positions.map((position) => position[0])
  const lats = positions.map((position) => position[1])
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  }
}

export function getScopePolygon(scope: WarroomScopeInput | undefined): GeoJsonLike | null {
  const resolvedScope = normalizeWarroomDataScope(scope)
  if (resolvedScope.kind !== "polygon") return null
  return resolvedScope.value && typeof resolvedScope.value === "object" && !Array.isArray(resolvedScope.value)
    ? resolvedScope.value
    : null
}

function getPolygonZipCodes(value: unknown): string[] {
  return Object.entries(ZIP_CENTROIDS)
    .filter(([, [lat, lon]]) => isLatLonInGeoJson(lat, lon, value))
    .map(([zipCode]) => zipCode)
}

export function resolveScopeZipCodes(scope: WarroomScopeInput | undefined): string[] | null {
  const resolvedScope = normalizeWarroomDataScope(scope)
  switch (resolvedScope.kind) {
    case "us":
      return null
    case "chicagoland":
      return getChicagolandZipCodes()
    case "subzone":
      return typeof resolvedScope.value === "string"
        ? getSubzoneZipCodes(resolvedScope.value)
        : []
    case "zip":
      return typeof resolvedScope.value === "string" || Array.isArray(resolvedScope.value)
        ? normalizeZipCodes(resolvedScope.value)
        : []
    case "saved":
      return getSavedZipCodes(resolvedScope.value)
    case "polygon":
      return getPolygonZipCodes(resolvedScope.value)
    default:
      return []
  }
}

export function getScopeLabel(scope: WarroomScopeInput | undefined): string {
  if (typeof scope === "string") return getWarroomScopeOption(scope).label
  const resolvedScope = normalizeWarroomDataScope(scope)
  switch (resolvedScope.kind) {
    case "us":
      return "United States"
    case "chicagoland":
      return "Chicagoland"
    case "subzone": {
      const subzone = typeof resolvedScope.value === "string"
        ? normalizeSubzoneName(resolvedScope.value)
        : null
      return subzone ? CHICAGOLAND_SUBZONE_LABELS[subzone] : "Chicagoland Subzone"
    }
    case "zip": {
      const zips = typeof resolvedScope.value === "string" || Array.isArray(resolvedScope.value)
        ? normalizeZipCodes(resolvedScope.value)
        : []
      if (zips.length === 1) return `ZIP ${zips[0]}`
      return zips.length > 1 ? `${zips.length} ZIPs` : "ZIP Scope"
    }
    case "saved":
      return typeof resolvedScope.value === "string"
        ? resolvedScope.value
        : `Saved ZIP List (${resolveScopeZipCodes(resolvedScope)?.length ?? 0})`
    case "polygon": {
      const value = resolvedScope.value
      const properties = value && typeof value === "object" && !Array.isArray(value)
        ? value.properties
        : undefined
      const label = properties?.label ?? properties?.name
      return typeof label === "string" ? label : "Custom Polygon"
    }
    default:
      return "Warroom Scope"
  }
}
