/** CityDensity's PMTiles metadata: WorldPop 2026 100m constrained, palette #20. */
export const POPULATION_ARCHIVE = 'https://storage.googleapis.com/city-density-tiles/world.pmtiles'
export const POPULATION_DESCRIPTION = 'WorldPop 2026 100m constrained, palette #20'
export const POPULATION_SOURCE_ID = 'population-density'
export const POPULATION_LAYER_ID = 'population-density-raster'
export const SQUARE_KM_PER_SQUARE_MILE = 2.589988110336
// Regional context, not an exact mask of the watched postal ZIPs.
export const POPULATION_BOUNDS: [number, number, number, number] = [-89.5, 40.6, -87.2, 42.7]
export const POPULATION_MIN_ZOOM = 6
export const POPULATION_MAX_ZOOM = 11

export const POPULATION_LEGEND = [
  { perKm2: 0, position: 0 }, { perKm2: 600, position: 23 },
  { perKm2: 2000, position: 38.5 }, { perKm2: 8000, position: 61.5 },
  { perKm2: 35000, position: 100 },
].map(stop => ({ ...stop, perSquareMile: stop.perKm2 * SQUARE_KM_PER_SQUARE_MILE }))

// Preserve the published tile palette and its non-linear legend stop positions.
export const POPULATION_GRADIENT = 'linear-gradient(to right, rgba(185,225,225,0), rgba(155,210,210,0), rgba(125,195,198,.06), rgba(95,175,185,.31), rgba(65,155,170,.67), #2d87a0, #1e699b, #144691, #0a2382, #4b0f96, #a01eaa, #f0468c, #ffa028, #ffdc32)'

export function populationTileInRegion(z: number, x: number, y: number): boolean {
  if (![z, x, y].every(Number.isInteger) || z < POPULATION_MIN_ZOOM || z > POPULATION_MAX_ZOOM) return false
  const n = 2 ** z
  if (x < 0 || y < 0 || x >= n || y >= n) return false
  const lat = (tileY: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI
  const west = x / n * 360 - 180
  const east = (x + 1) / n * 360 - 180
  return east > POPULATION_BOUNDS[0] && west < POPULATION_BOUNDS[2] &&
    lat(y) > POPULATION_BOUNDS[1] && lat(y + 1) < POPULATION_BOUNDS[3]
}
