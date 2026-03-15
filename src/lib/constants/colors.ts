/**
 * Color constants for the design system.
 * Maps ownership statuses, deal types, entity classifications to colors.
 * Updated to "Vercel Dashboard x Bloomberg Terminal" palette.
 */

// ---- Deal type colors ----
export const DEAL_TYPE_COLORS: Record<string, string> = {
  buyout: "#3B82F6",
  "add-on": "#22C55E",
  recapitalization: "#F59E0B",
  growth: "#A855F7",
  de_novo: "#06B6D4",
  partnership: "#7C3AED",
  other: "#64748B",
};

// ---- Ownership status colors ----
export const OWNERSHIP_STATUS_COLORS: Record<string, string> = {
  independent: "#22C55E",
  likely_independent: "#22C55E",
  dso_affiliated: "#F59E0B",
  pe_backed: "#EF4444",
  unknown: "#64748B",
};

// ---- Entity classification colors ----
export const ENTITY_CLASSIFICATION_COLORS: Record<string, string> = {
  solo_established: "#22C55E",    // green
  solo_new: "#4ADE80",            // light green
  solo_inactive: "#64748B",       // gray
  solo_high_volume: "#16A34A",    // dark green
  family_practice: "#F59E0B",     // amber
  small_group: "#3B82F6",         // blue
  large_group: "#2563EB",         // darker blue
  dso_regional: "#FB923C",        // orange
  dso_national: "#EF4444",        // red
  specialist: "#A855F7",          // purple
  non_clinical: "#64748B",        // gray
  unknown: "#475569",             // dim gray
};

// ---- Chart colorway ----
export const CHART_COLORWAY = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#A855F7",
  "#06B6D4",
  "#EF4444",
  "#7C3AED",
  "#EA580C",
  "#22D3EE",
  "#A3E635",
];

// ---- Accent colors (from CSS vars) ----
export const ACCENTS = {
  blue: "#3B82F6",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#A855F7",
  cyan: "#06B6D4",
} as const;

// ---- Theme colors (for Recharts) ----
export const CHART_THEME = {
  background: "transparent",
  gridColor: "#1E293B",
  textColor: "#94A3B8",
  tooltipBg: "#0F1629",
  tooltipBorder: "#1E293B",
  tooltipText: "#F8FAFC",
} as const;

// ---- Market type colors ----
export const MARKET_TYPE_COLORS: Record<string, string> = {
  low_resident_commercial: "#EF4444",
  high_saturation_corporate: "#DC2626",
  corporate_dominant: "#F97316",
  family_concentrated: "#F59E0B",
  low_density_high_income: "#22C55E",
  low_density_independent: "#4ADE80",
  growing_undersupplied: "#38BDF8",
  balanced_mixed: "#3B82F6",
  mixed: "#64748B",
};

// ---- Confidence colors ----
export const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#22C55E",
  confirmed: "#22C55E",
  medium: "#F59E0B",
  provisional: "#F59E0B",
  low: "#EF4444",
  insufficient_data: "#EF4444",
};

// ---- US States list ----
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];
