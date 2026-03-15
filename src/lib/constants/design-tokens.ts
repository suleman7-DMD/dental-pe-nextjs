/**
 * Design system tokens — "Vercel Dashboard x Bloomberg Terminal" spec.
 * Used across all dashboard pages for consistent styling.
 */

// Background hierarchy
export const BACKGROUNDS = {
  deepest: '#0A0F1E',
  card: '#0F1629',
  elevated: '#1A2035',
  sidebar: '#060B18',
} as const;

// Border hierarchy
export const BORDERS = {
  subtle: '#1E293B',
  emphasis: '#334155',
} as const;

// Text hierarchy
export const TEXT = {
  primary: '#F8FAFC',
  secondary: '#94A3B8',
  muted: '#64748B',
  dimmed: '#475569',
} as const;

// Semantic colors — use EVERYWHERE
export const SEMANTIC = {
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  purple: '#A855F7',
  blue: '#3B82F6',
  gray: '#64748B',
} as const;

// Semantic background tints (10% opacity for badges/backgrounds)
export const SEMANTIC_BG = {
  green: 'rgba(34, 197, 94, 0.1)',
  red: 'rgba(239, 68, 68, 0.1)',
  amber: 'rgba(245, 158, 11, 0.1)',
  purple: 'rgba(168, 85, 247, 0.1)',
  blue: 'rgba(59, 130, 246, 0.1)',
  gray: 'rgba(100, 116, 139, 0.1)',
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
    cyan: '#06B6D4',
  },
  text: {
    primary: TEXT.primary,
    secondary: TEXT.secondary,
    muted: TEXT.muted,
  },
  status: {
    independent: SEMANTIC.green,
    dso_affiliated: SEMANTIC.amber,
    pe_backed: SEMANTIC.red,
    unknown: TEXT.muted,
  },
  saturation: {
    greenBg: '#166534',
    yellowBg: '#A16207',
    redBg: '#991B1B',
  },
} as const

export const chartColorway = [
  SEMANTIC.blue, SEMANTIC.green, SEMANTIC.amber, SEMANTIC.purple, '#06B6D4',
  SEMANTIC.red, '#7C3AED', '#EA580C', '#22D3EE', '#A3E635',
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
