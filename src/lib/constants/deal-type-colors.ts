/**
 * Standard color palette for deal types, used across Deal Flow visualizations.
 */
export const DEAL_TYPE_COLORS: Record<string, string> = {
  buyout: '#0066FF',
  'add-on': '#00C853',
  recapitalization: '#FFB300',
  growth: '#9C27B0',
  de_novo: '#00BCD4',
  partnership: '#7C4DFF',
  other: '#566070',
}

/**
 * Pretty-print a deal_type value for display.
 */
export function formatDealType(type: string | null | undefined): string {
  if (!type) return 'Other'
  const map: Record<string, string> = {
    buyout: 'Buyout',
    'add-on': 'Add-on',
    recapitalization: 'Recapitalization',
    growth: 'Growth',
    de_novo: 'De Novo',
    partnership: 'Partnership',
    other: 'Other',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
