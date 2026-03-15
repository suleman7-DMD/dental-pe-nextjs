/**
 * Design system tokens matching the Streamlit dark theme.
 * Used across all dashboard pages for consistent styling.
 */
export const colors = {
  bg: {
    primary: '#0B0E11',
    card: '#141922',
    cardHover: '#1A2332',
  },
  border: {
    default: '#1E2A3A',
    hover: '#2A3A4A',
  },
  accent: {
    blue: '#0066FF',
    green: '#00C853',
    red: '#FF3D00',
    amber: '#FFB300',
    purple: '#9C27B0',
    cyan: '#00BCD4',
  },
  text: {
    primary: '#E8ECF1',
    secondary: '#8892A0',
    muted: '#566070',
  },
  status: {
    independent: '#00C853',
    dso_affiliated: '#FFB300',
    pe_backed: '#FF3D00',
    unknown: '#566070',
  },
  saturation: {
    greenBg: '#1B5E20',
    yellowBg: '#F57F17',
    redBg: '#B71C1C',
  },
} as const

export const chartColorway = [
  '#0066FF', '#00C853', '#FFB300', '#9C27B0', '#00BCD4',
  '#FF3D00', '#7C4DFF', '#FF6D00', '#00E5FF', '#EEFF41',
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
