/**
 * Color constants for the design system.
 * Maps ownership statuses, deal types, entity classifications to colors.
 */

// ---- Deal type colors ----
export const DEAL_TYPE_COLORS: Record<string, string> = {
  buyout: "#0066FF",
  "add-on": "#00C853",
  recapitalization: "#FFB300",
  growth: "#9C27B0",
  de_novo: "#00BCD4",
  partnership: "#7C4DFF",
  other: "#566070",
};

// ---- Ownership status colors ----
export const OWNERSHIP_STATUS_COLORS: Record<string, string> = {
  independent: "#00C853",
  likely_independent: "#00C853",
  dso_affiliated: "#FFB300",
  pe_backed: "#FF3D00",
  unknown: "#566070",
};

// ---- Entity classification colors ----
export const ENTITY_CLASSIFICATION_COLORS: Record<string, string> = {
  solo_established: "#4CAF50",
  solo_new: "#81C784",
  solo_inactive: "#9E9E9E",
  solo_high_volume: "#2E7D32",
  family_practice: "#FF9800",
  small_group: "#42A5F5",
  large_group: "#1565C0",
  dso_regional: "#FFA726",
  dso_national: "#F44336",
  specialist: "#AB47BC",
  non_clinical: "#78909C",
};

// ---- Chart colorway (matching Plotly template from app.py) ----
export const CHART_COLORWAY = [
  "#0066FF",
  "#00C853",
  "#FFB300",
  "#9C27B0",
  "#00BCD4",
  "#FF3D00",
  "#7C4DFF",
  "#FF6D00",
  "#00E5FF",
  "#EEFF41",
];

// ---- Accent colors (from CSS vars) ----
export const ACCENTS = {
  blue: "#0066FF",
  green: "#00C853",
  red: "#FF3D00",
  amber: "#FFB300",
  purple: "#9C27B0",
  cyan: "#00BCD4",
} as const;

// ---- Theme colors (for Recharts) ----
export const CHART_THEME = {
  background: "transparent",
  gridColor: "#1E2A3A",
  textColor: "#8892A0",
  tooltipBg: "#1A2332",
  tooltipBorder: "#2A3A4A",
  tooltipText: "#FFFFFF",
} as const;

// ---- Market type colors ----
export const MARKET_TYPE_COLORS: Record<string, string> = {
  low_resident_commercial: "#E53935",
  high_saturation_corporate: "#F44336",
  corporate_dominant: "#FF5722",
  family_concentrated: "#FF9800",
  low_density_high_income: "#4CAF50",
  low_density_independent: "#66BB6A",
  growing_undersupplied: "#29B6F6",
  balanced_mixed: "#42A5F5",
  mixed: "#78909C",
};

// ---- Confidence colors ----
export const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#00C853",
  confirmed: "#00C853",
  medium: "#FFB300",
  provisional: "#FFB300",
  low: "#FF3D00",
  insufficient_data: "#FF3D00",
};

// ---- US States list ----
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];
