/**
 * Color scale functions for saturation metrics.
 * Used for heatmaps and conditional formatting.
 */

/** Interpolate between two hex colors. t = 0..1. */
function lerpColor(a: string, b: string, t: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  const r = clamp(ar + (br - ar) * t);
  const g = clamp(ag + (bg - ag) * t);
  const bv = clamp(ab + (bb - ab) * t);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}

/**
 * DLD (Dentist Location Density) color scale.
 * National avg ~6.1 GP per 10k residents.
 * Low density (green) -> High density (red).
 */
export function getDLDColor(dld: number | null): string {
  if (dld === null) return "#566070";
  if (dld <= 3) return "#00C853"; // very low density = green (opportunity)
  if (dld <= 6) return lerpColor("#00C853", "#FFB300", (dld - 3) / 3);
  if (dld <= 10) return lerpColor("#FFB300", "#FF3D00", (dld - 6) / 4);
  return "#FF3D00"; // very high density = red (saturated)
}

/**
 * Buyable practice ratio color scale.
 * Higher = more acquisition targets = green.
 */
export function getBuyableRatioColor(ratio: number | null): string {
  if (ratio === null) return "#566070";
  if (ratio <= 20) return "#FF3D00"; // low buyable = red
  if (ratio <= 50) return lerpColor("#FF3D00", "#FFB300", (ratio - 20) / 30);
  if (ratio <= 75) return lerpColor("#FFB300", "#00C853", (ratio - 50) / 25);
  return "#00C853"; // highly buyable = green
}

/**
 * Corporate share color scale.
 * Higher = more consolidated = red.
 */
export function getCorporateShareColor(share: number | null): string {
  if (share === null) return "#566070";
  if (share <= 10) return "#00C853"; // low corporate = green
  if (share <= 30) return lerpColor("#00C853", "#FFB300", (share - 10) / 20);
  if (share <= 50) return lerpColor("#FFB300", "#FF3D00", (share - 30) / 20);
  return "#FF3D00"; // high corporate = red
}

/**
 * Generic percentage color for consolidation (0-100).
 * Low = green (independent), High = red (consolidated).
 */
export function getConsolidationColor(pct: number | null): string {
  if (pct === null) return "#566070";
  if (pct <= 10) return "#00C853";
  if (pct <= 25) return lerpColor("#00C853", "#FFB300", (pct - 10) / 15);
  if (pct <= 50) return lerpColor("#FFB300", "#FF3D00", (pct - 25) / 25);
  return "#FF3D00";
}

/** Opportunity score color (higher = better). */
export function getOpportunityColor(score: number | null): string {
  if (score === null) return "#566070";
  if (score <= 30) return "#FF3D00";
  if (score <= 60) return lerpColor("#FF3D00", "#FFB300", (score - 30) / 30);
  if (score <= 80) return lerpColor("#FFB300", "#00C853", (score - 60) / 20);
  return "#00C853";
}
