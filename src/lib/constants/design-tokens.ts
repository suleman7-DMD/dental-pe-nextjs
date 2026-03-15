/**
 * Design system tokens — light theme with warm neutrals and goldenrod accent.
 * Used across all dashboard pages for consistent styling.
 */

// Background hierarchy
export const BACKGROUNDS = {
  deepest: '#FAFAF7',
  card: '#FFFFFF',
  elevated: '#F7F7F4',
  sidebar: '#2C2C2C',
} as const;

// Border hierarchy
export const BORDERS = {
  subtle: '#E8E5DE',
  emphasis: '#D4D0C8',
} as const;

// Text hierarchy
export const TEXT = {
  primary: '#1A1A1A',
  secondary: '#6B6B60',
  muted: '#9C9C90',
  dimmed: '#B0B0A4',
} as const;

// Semantic colors — use EVERYWHERE
export const SEMANTIC = {
  green: '#2D8B4E',
  red: '#C23B3B',
  amber: '#D4920B',
  purple: '#7C3AED',
  blue: '#B8860B',
  gray: '#9C9C90',
} as const;

// Semantic background tints (10% opacity for badges/backgrounds)
export const SEMANTIC_BG = {
  green: 'rgba(45, 139, 78, 0.1)',
  red: 'rgba(194, 59, 59, 0.1)',
  amber: 'rgba(212, 146, 11, 0.1)',
  purple: 'rgba(124, 58, 237, 0.1)',
  blue: 'rgba(184, 134, 11, 0.1)',
  gray: 'rgba(156, 156, 144, 0.1)',
} as const;

// Legacy-compatible alias — maps old `colors.x` paths to new tokens
export const colors = {
  bg: {
    primary: BACKGROUNDS.deepest,
    card: BACKGROUNDS.card,
    cardHover: BACKGROUNDS.elevated,
  },
  border: {
    default: BORDERS.subtle,
    hover: BORDERS.emphasis,
  },
  accent: {
    blue: SEMANTIC.blue,
    green: SEMANTIC.green,
    red: SEMANTIC.red,
    amber: SEMANTIC.amber,
    purple: SEMANTIC.purple,
    cyan: '#0D9488',
  },
  text: {
    primary: TEXT.primary,
    secondary: TEXT.secondary,
    muted: TEXT.muted,
  },
  status: {
    independent: '#2563EB',
    dso_affiliated: SEMANTIC.amber,
    pe_backed: SEMANTIC.red,
    unknown: TEXT.muted,
  },
  saturation: {
    greenBg: '#2D8B4E',
    yellowBg: '#D4920B',
    redBg: '#C23B3B',
  },
} as const

export const chartColorway = [
  '#2563EB', SEMANTIC.green, SEMANTIC.amber, SEMANTIC.purple, '#0D9488',
  SEMANTIC.red, '#7C3AED', '#C2410C', '#0D9488', '#65A30D',
]

export type OwnershipStatus = 'independent' | 'likely_independent' | 'dso_affiliated' | 'pe_backed' | 'unknown'

export function ownershipLabel(status: OwnershipStatus | string | null): string {
  const map: Record<string, string> = {
    independent: 'Independent',
    likely_independent: 'Likely Independent',
    dso_affiliated: 'DSO Affiliated',
    pe_backed: 'PE-Backed',
    unknown: 'Unknown',
  }
  return map[status ?? 'unknown'] ?? String(status)
}

export function ownershipColor(status: OwnershipStatus | string | null): string {
  const map: Record<string, string> = {
    independent: colors.status.independent,
    likely_independent: colors.status.independent,
    dso_affiliated: colors.status.dso_affiliated,
    pe_backed: colors.status.pe_backed,
    unknown: colors.status.unknown,
  }
  return map[status ?? 'unknown'] ?? colors.status.unknown
}
