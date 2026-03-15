/**
 * Map center points for metro areas.
 * Ported from dashboard/app.py METRO_CENTERS.
 */
export interface MetroCenter {
  lat: number;
  lon: number;
  zoom: number;
}

export const METRO_CENTERS: Record<string, MetroCenter> = {
  Chicagoland: { lat: 41.72, lon: -88.10, zoom: 10 },
  "Boston Metro": { lat: 42.35, lon: -71.13, zoom: 11 },
};
