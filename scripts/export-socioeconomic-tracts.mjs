/** Read-only public ACS export. No office/database writes. Run from frontend root:
 * node scripts/export-socioeconomic-tracts.mjs
 * Pinned vintage: refuse annual upstream updates until deliberately reviewed.
 */
import { mkdir, writeFile } from 'node:fs/promises'

const vintage = '2020-2024'
const bounds = [-89.5, 40.6, -87.2, 42.7]
const sources = [
  { topic: 'income', item: 'c9faa265b82848498bc0a8390c0afa65', service: 'Median_Household_Income', fields: ['B19049_001E', 'B19049_001M'] },
  { topic: 'education', item: '5906be82cfc349948cecbed2f7297e9f', service: 'Educational_Attainment', fields: ['B15002_001E', 'B15002_calc_pctGEBAE', 'B15002_calc_pctGEBAM'] },
]
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(JSON.stringify(data.error))
  return data
}
const results = []
for (const source of sources) {
  const item = await json(`https://www.arcgis.com/sharing/rest/content/items/${source.item}?f=json`)
  if (!item.description?.match(/Current Vintage[\s\S]{0,60}2020-2024/)) throw new Error('Upstream ACS vintage changed')
  const service = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/ACS_${source.service}_View_Boundaries/FeatureServer/2`
  const base = { where: "State = 'Illinois'", geometry: bounds.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }
  const { count } = await json(`${service}/query?${new URLSearchParams({ ...base, f: 'json', returnCountOnly: 'true' })}`)
  const features = []
  for (let offset = 0; offset < count; offset += 500) {
    const page = await json(`${service}/query?${new URLSearchParams({ ...base, f: 'geojson', outFields: ['GEOID', 'NAME', 'County', ...source.fields].join(','), returnGeometry: source.topic === 'income' ? 'true' : 'false', outSR: '4326', maxAllowableOffset: '0.0002', geometryPrecision: '5', orderByFields: 'GEOID', resultOffset: String(offset), resultRecordCount: '500' })}`)
    features.push(...page.features)
  }
  if (features.length !== count || new Set(features.map(f => f.properties.GEOID)).size !== count) throw new Error('Incomplete/duplicate tract export')
  results.push(features)
  source.url = service
  source.count = count
  source.modified = item.modified
  console.log(`${source.topic}: ${count} tracts`)
}
const education = new Map(results[1].map(f => [f.properties.GEOID, f.properties]))
const features = results[0].map(f => {
  const e = education.get(f.properties.GEOID)
  if (!e || !f.geometry || !['Polygon', 'MultiPolygon'].includes(f.geometry.type)) throw new Error('Missing matching tract or polygon')
  return { type: 'Feature', id: f.properties.GEOID, geometry: f.geometry, properties: { ...f.properties, ...e } }
})
if (features.length !== education.size) throw new Error('Tract universes disagree')
const metadata = { vintage, retrievedAt: new Date().toISOString(), bounds, scope: 'Illinois tracts intersecting the Chicagoland map region; not clipped to watched ZIPs', tractCount: features.length, simplificationDegrees: 0.0002, source: 'U.S. Census Bureau ACS 5-year estimates, hosted by Esri; TIGER boundaries with major water areas removed', terms: 'https://goto.arcgis.com/termsofuse/viewtermsofuse', sources, notes: ['Raw selected source fields retained, including nulls and margins of error (90% confidence).', 'Income B19049_001E is in 2024 inflation-adjusted dollars. Education is bachelor or higher, adults 25+; Esri-calculated percent and MOE.', 'Esri normalizes negative Census sentinels to null (controlled-estimate MOE sentinel to zero). No interpolation or office-level demographic inference.', 'Education item accessInformation is stale (2019-2023/B16007); Current Vintage and live B15002 schema identify 2020-2024.'] }
await mkdir('public/data', { recursive: true })
await writeFile('public/data/chicagoland-acs-2024.geojson', JSON.stringify({ type: 'FeatureCollection', features }))
await writeFile('public/data/chicagoland-acs-2024.metadata.json', JSON.stringify(metadata, null, 2) + '\n')
console.log(`Saved ${features.length} joined tracts; no office data changed.`)
