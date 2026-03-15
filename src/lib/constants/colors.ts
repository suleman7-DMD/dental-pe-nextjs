/**
 * Color constants for the design system.
 * Maps ownership statuses, deal types, entity classifications to colors.
 * Updated to light theme with warm neutrals and goldenrod accent.
 */

// ---- Deal type colors ----
export const DEAL_TYPE_COLORS: Record<string, string> = {
  buyout: "#2563EB",
  "add-on": "#2D8B4E",
  recapitalization: "#D4920B",
  growth: "#7C3AED",
  de_novo: "#0D9488",
  partnership: "#6366F1",
  other: "#9C9C90",
};

// ---- Ownership status colors ----
export const OWNERSHIP_STATUS_COLORS: Record<string, string> = {
  independent: "#2563EB",
  likely_independent: "#2563EB",
  dso_affiliated: "#D4920B",
  pe_backed: "#C23B3B",
  unknown: "#9C9C90",
};

// ---- Entity classification colors ----
export const ENTITY_CLASSIFICATION_COLORS: Record<string, string> = {
  solo_established: "#2D8B4E",    // green
  solo_new: "#059669",            // medium green
  solo_inactive: "#9C9C90",       // gray
  solo_high_volume: "#166534",    // dark green
  family_practice: "#D4920B",     // amber
  small_group: "#2563EB",         // blue
  large_group: "#1D4ED8",         // darker blue
  dso_regional: "#EA580C",        // orange
  dso_national: "#C23B3B",        // red
  specialist: "#7C3AED",          // purple
  non_clinical: "#9C9C90",        // gray
  unknown: "#B0B0A4",             // dim gray
};

// ---- Chart colorway ----
export const CHART_COLORWAY = [
  "#2563EB",
  "#2D8B4E",
  "#D4920B",
  "#7C3AED",
  "#0D9488",
  "#C23B3B",
  "#6366F1",
  "#C2410C",
  "#0D9488",
  "#65A30D",
];

// ---- Accent colors (from CSS vars) ----
export const ACCENTS = {
  blue: "#B8860B",
  green: "#2D8B4E",
  red: "#C23B3B",
  amber: "#D4920B",
  purple: "#7C3AED",
  cyan: "#0D9488",
} as const;

// ---- Theme colors (for Recharts) ----
export const CHART_THEME = {
  background: "transparent",
  gridColor: "#E8E5DE",
  textColor: "#6B6B60",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#E8E5DE",
  tooltipText: "#1A1A1A",
} as const;

// ---- Market type colors ----
export const MARKET_TYPE_COLORS: Record<string, string> = {
  low_resident_commercial: "#C23B3B",
  high_saturation_corporate: "#DC2626",
  corporate_dominant: "#EA580C",
  family_concentrated: "#D4920B",
  low_density_high_income: "#2D8B4E",
  low_density_independent: "#059669",
  growing_undersupplied: "#0284C7",
  balanced_mixed: "#2563EB",
  mixed: "#9C9C90",
};

// ---- Confidence colors ----
export const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#2D8B4E",
  confirmed: "#2D8B4E",
  medium: "#D4920B",
  provisional: "#D4920B",
  low: "#C23B3B",
  insufficient_data: "#C23B3B",
};

// ---- US States list ----
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];
