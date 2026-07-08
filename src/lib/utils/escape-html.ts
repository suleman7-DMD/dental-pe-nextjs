/**
 * Escape HTML special characters. REQUIRED around every interpolated value
 * in a Mapbox popup `.setHTML()` template — practice names, addresses, and
 * network labels come from external registries (NPI, Data Axle) and must
 * never reach the DOM unescaped.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
