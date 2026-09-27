import type { ExpressionSpecification, FilterSpecification } from 'mapbox-gl'

export type LandUseMode = 'homes' | 'full' | 'sites'
export const LAND_USE_SOURCE = 'cmap-land-use'
export const LAND_USE_FILL = 'cmap-land-use-fill'
export const LAND_USE_URL = 'https://datahub.cmap.illinois.gov/maps/1022fd982a5b4b51a9cecb20ea6c2a29/about'
export const LAND_USE_VERSION = 'cmap-2023-v1'

// Explicit CMAP codes: vacant/platted housing and residential common space are NOT homes.
export const LAND_USE_GROUPS = [
  { id: 'residential', label: 'Residential', color: '#b09ada', codes: ['1111', '1112', '1130', '1140'], note: 'Land used for housing; not a count of residents or occupied units.' },
  { id: 'mixed', label: 'Housing + shops', color: '#d78bb6', codes: ['1216'], note: 'Mixed commercial use with residential units. Both people and businesses may be here.' },
  { id: 'commercial', label: 'Commercial & offices', color: '#e6ae67', codes: ['1211', '1212', '1214', '1215', '1220', '1240', '1250'], note: 'Existing commercial use. Investigate individual premises and local rules for dental use.' },
  { id: 'medical', label: 'Medical', color: '#cf7180', codes: ['1310'], note: 'Existing medical facilities. This does not establish available dental office space.' },
  { id: 'open', label: 'Parks & open space', color: '#86b9a6', codes: ['1151', '3100', '3200', '3300', '3400', '3500'], note: 'Open space includes conservation areas, parks, golf courses, trails and residential common land; legal protection varies.' },
  { id: 'airport', label: 'Airports', color: '#7d91a5', codes: ['1530'], note: 'Airport land use helps explain large gaps in neighborhood practice distribution.' },
  { id: 'industrial', label: 'Industry & warehouses', color: '#a0a3b9', codes: ['1410', '1420', '1431', '1432', '1433', '1450'], note: 'Industrial, extraction, storage or warehousing use; not proof of a legal exclusion for every parcel.' },
  { id: 'institutional', label: 'Institutions & campuses', color: '#85b6ce', codes: ['1321', '1322', '1330', '1340', '1350', '1360', '1370', '1380'], note: 'Schools, government, cemeteries, laboratories and other institutions. Some may include residents or clinical services.' },
  { id: 'infrastructure', label: 'Transport & utilities', color: '#b4bec4', codes: ['1511', '1512', '1520', '1540', '1550', '1561', '1562', '1563', '1564', '1565', '1570'], note: 'Road, rail, parking and utility land use.' },
  { id: 'agriculture', label: 'Agriculture', color: '#c7bd87', codes: ['2000'], note: 'Agricultural use; scattered dwellings may still exist.' },
  { id: 'water', label: 'Water', color: '#82c3dc', codes: ['5000'], note: 'Mapped water bodies.' },
  { id: 'vacant', label: 'Vacant / construction', color: '#d6cbbb', codes: ['4110', '4120', '4130', '4140', '4210', '4220', '4230', '4240'], note: 'Vacant or under construction in 2023. Current use may have changed; not confirmed housing or available development land.' },
  { id: 'unknown', label: 'Unclassified', color: '#d9dcdf', codes: ['9999'], note: 'CMAP could not classify this land. Do not infer use from its color or from missing practices.' },
] as const

export const LAND_USE_DETAILS: Record<string, string> = {
  '1111': 'Detached single-family housing', '1112': 'Attached single-family housing',
  '1130': 'Multifamily housing', '1140': 'Mobile-home housing', '1151': 'Residential common open space',
  '1211': 'Shopping mall', '1212': 'Regional commercial', '1214': 'Big-box retail',
  '1215': 'Urban mixed commercial', '1216': 'Urban commercial with housing', '1220': 'Offices',
  '1240': 'Cultural / entertainment', '1250': 'Hotels', '1310': 'Medical facilities',
  '1321': 'Schools', '1322': 'Higher education', '1330': 'Government', '1340': 'Correctional facilities',
  '1350': 'Religious institutions', '1360': 'Cemeteries', '1370': 'Other institutions', '1380': 'National laboratories',
  '1410': 'Mineral extraction', '1420': 'General industrial', '1431': 'Large manufacturing',
  '1432': 'Large warehouses', '1433': 'Large flex industrial', '1450': 'Industrial storage',
  '1511': 'Rail right-of-way', '1512': 'Road right-of-way', '1520': 'Other linear transportation',
  '1530': 'Airport', '1540': 'Parking', '1550': 'Communications', '1561': 'Utility right-of-way',
  '1562': 'Wastewater treatment', '1563': 'Landfill', '1564': 'Other utilities', '1565': 'Stormwater management',
  '1570': 'Intermodal terminal', '2000': 'Agriculture', '3100': 'Recreation / parks', '3200': 'Golf course',
  '3300': 'Conservation open space', '3400': 'Private open space', '3500': 'Trails / greenways',
  '4110': 'Vacant residential land', '4120': 'Vacant commercial land', '4130': 'Vacant industrial land',
  '4140': 'Other vacant land', '4210': 'Housing under construction', '4220': 'Commercial construction',
  '4230': 'Industrial construction', '4240': 'Other construction', '5000': 'Water', '9999': 'Unclassifiable land',
}

export function landUseGroup(code: unknown) {
  return LAND_USE_GROUPS.find(g => (g.codes as readonly string[]).includes(String(code))) ?? LAND_USE_GROUPS[12]
}

export function landUseFilter(mode: LandUseMode): FilterSpecification {
  const codes = mode === 'homes' ? ['1111', '1112', '1130', '1140', '1216']
    : mode === 'sites' ? ['1211', '1212', '1214', '1215', '1216', '1220', '1310'] : null
  return codes ? ['in', ['get', 'code'], ['literal', codes]] : ['has', 'code']
}

export const landUseColor: ExpressionSpecification = ['match', ['get', 'code'],
  ...LAND_USE_GROUPS.flatMap(g => [g.codes.length === 1 ? g.codes[0] : [...g.codes], g.color]), '#d9dcdf'] as ExpressionSpecification

export function validLandUseTile(z: number, x: number, y: number) {
  return [z, x, y].every(Number.isSafeInteger) && z >= 7 && z <= 14 && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z
}
