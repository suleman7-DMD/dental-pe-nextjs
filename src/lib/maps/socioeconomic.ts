import type { ExpressionSpecification } from 'mapbox-gl'

export type SocioeconomicMetric = 'income' | 'education'
export const SOCIOECONOMIC_SOURCE = 'acs-tracts'
export const SOCIOECONOMIC_LAYER = 'acs-tract-fill'
export const SOCIOECONOMIC_DATA = '/data/chicagoland-acs-2024.geojson'
export const SOCIOECONOMIC_METRICS = {
  income: { label: 'Median household income', field: 'B19049_001E', moe: 'B19049_001M',
    unit: 'Annual household income · 2024 dollars', stops: [0, 50000, 100000, 150000, 200000],
    labels: ['$0', '$50k', '$100k', '$150k', '$200k+'], colors: ['#fff7bc', '#fec44f', '#fe9929', '#d95f0e', '#993404'],
    source: 'https://www.arcgis.com/home/item.html?id=c9faa265b82848498bc0a8390c0afa65' },
  education: { label: 'Education: bachelor’s degree or higher', field: 'B15002_calc_pctGEBAE', moe: 'B15002_calc_pctGEBAM',
    unit: 'Share of adults age 25+ · percent', stops: [0, 25, 50, 75, 100],
    labels: ['0%', '25%', '50%', '75%', '100%'], colors: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
    source: 'https://www.arcgis.com/home/item.html?id=5906be82cfc349948cecbed2f7297e9f' },
} as const

/** Null, Census sentinels, empty strings and non-finite values are never zero. */
export function acsNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
export function socioeconomicValue(properties: Record<string, unknown>, metric: SocioeconomicMetric): number | null {
  const value = acsNumber(properties[SOCIOECONOMIC_METRICS[metric].field])
  if (metric === 'education' && (acsNumber(properties.B15002_001E) === null || Number(properties.B15002_001E) <= 0 || (value !== null && value > 100))) return null
  return value
}
export function formatSocioeconomicValue(value: number | null, metric: SocioeconomicMetric): string {
  if (value === null) return 'No estimate available'
  // ACS represents open-ended median-income intervals using these endpoints.
  if (metric === 'income' && value === 250001) return '$250,000+'
  if (metric === 'income' && value === 2499) return 'Below $2,500'
  return metric === 'income' ? `$${Math.round(value).toLocaleString('en-US')}` : `${value.toFixed(1)}%`
}
// Expressions use the same guards as the tooltip. Gray explicitly means no estimate.
export function socioeconomicColor(metric: SocioeconomicMetric): ExpressionSpecification {
  const config = SOCIOECONOMIC_METRICS[metric]
  const number: ExpressionSpecification = ['to-number', ['get', config.field], -1]
  const valid: ExpressionSpecification = ['all', ['!=', ['get', config.field], null], ['>=', number, 0]]
  if (metric === 'education') valid.push(['<=', number, 100], ['>', ['to-number', ['get', 'B15002_001E'], 0], 0])
  return ['case', valid, ['interpolate', ['linear'], number, ...config.stops.flatMap((stop, i) => [stop, config.colors[i]])], '#b8bec5'] as ExpressionSpecification
}
