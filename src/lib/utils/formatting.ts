import { OWNERSHIP_STATUS_COLORS, ENTITY_CLASSIFICATION_COLORS } from "@/lib/constants/colors";

/** Format a number as USD currency. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a number as USD currency in millions. */
export function formatCurrencyMM(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `$${value.toFixed(1)}M`;
}

/** Format as percentage with optional decimal places. */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(decimals)}%`;
}

/** Format large numbers with commas. */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "--";
  return new Intl.NumberFormat("en-US").format(num);
}

/** Format a compact number (1.2K, 3.4M, etc). */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format an EBITDA multiple. */
export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(1)}x`;
}

/** Format a date string to locale display. */
export function formatDate(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return "--";
  try {
    // Date-only strings (YYYY-MM-DD) are parsed as UTC by JS.
    // Use UTC display to avoid timezone shift (Mar 1 → Feb 28 in EST).
    const d = new Date(value);
    const opts = options ?? { year: "numeric", month: "short", day: "numeric" };
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    return d.toLocaleDateString("en-US", {
      ...opts,
      ...(isDateOnly ? { timeZone: "UTC" } : {}),
    });
  } catch {
    return value;
  }
}

/** Format relative time ("3 days ago", etc). */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "--";
  try {
    const d = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return value;
  }
}

/** Get display info for an ownership status. */
export function formatStatus(status: string | null | undefined): {
  label: string;
  color: string;
  dotClass: string;
} {
  const s = (status ?? "unknown").trim().toLowerCase();

  const map: Record<
    string,
    { label: string; color: string; dotClass: string }
  > = {
    // --- Legacy ownership_status values ---
    independent: {
      label: "Independent",
      color: OWNERSHIP_STATUS_COLORS.independent,
      dotClass: "bg-blue-600",
    },
    likely_independent: {
      label: "Likely Independent",
      color: OWNERSHIP_STATUS_COLORS.likely_independent,
      dotClass: "bg-blue-600",
    },
    dso_affiliated: {
      label: "DSO Affiliated",
      color: OWNERSHIP_STATUS_COLORS.dso_affiliated,
      dotClass: "bg-amber-500",
    },
    pe_backed: {
      label: "PE-Backed",
      color: OWNERSHIP_STATUS_COLORS.pe_backed,
      dotClass: "bg-red-500",
    },
    unknown: {
      label: "Unknown",
      color: OWNERSHIP_STATUS_COLORS.unknown,
      dotClass: "bg-gray-500",
    },
    // --- Entity classification values (11 types) ---
    solo_established: {
      label: "Solo Established",
      color: ENTITY_CLASSIFICATION_COLORS.solo_established,
      dotClass: "bg-green-600",
    },
    solo_new: {
      label: "Solo New",
      color: ENTITY_CLASSIFICATION_COLORS.solo_new,
      dotClass: "bg-green-500",
    },
    solo_inactive: {
      label: "Solo Inactive",
      color: ENTITY_CLASSIFICATION_COLORS.solo_inactive,
      dotClass: "bg-gray-400",
    },
    solo_high_volume: {
      label: "Solo High Volume",
      color: ENTITY_CLASSIFICATION_COLORS.solo_high_volume,
      dotClass: "bg-green-700",
    },
    family_practice: {
      label: "Family Practice",
      color: ENTITY_CLASSIFICATION_COLORS.family_practice,
      dotClass: "bg-amber-500",
    },
    small_group: {
      label: "Small Group",
      color: ENTITY_CLASSIFICATION_COLORS.small_group,
      dotClass: "bg-blue-600",
    },
    large_group: {
      label: "Large Group",
      color: ENTITY_CLASSIFICATION_COLORS.large_group,
      dotClass: "bg-blue-700",
    },
    dso_regional: {
      label: "Regional DSO",
      color: ENTITY_CLASSIFICATION_COLORS.dso_regional,
      dotClass: "bg-orange-500",
    },
    dso_national: {
      label: "National DSO",
      color: ENTITY_CLASSIFICATION_COLORS.dso_national,
      dotClass: "bg-red-500",
    },
    specialist: {
      label: "Specialist",
      color: ENTITY_CLASSIFICATION_COLORS.specialist,
      dotClass: "bg-purple-500",
    },
    non_clinical: {
      label: "Non-Clinical",
      color: ENTITY_CLASSIFICATION_COLORS.non_clinical,
      dotClass: "bg-gray-400",
    },
  };

  return (
    map[s] ?? {
      label: status ?? "Unknown",
      color: "#566070",
      dotClass: "bg-gray-500",
    }
  );
}

/** Get just the human-readable label for an ownership status (for DataTable renders). */
export function formatStatusLabel(status: string | null | undefined): string {
  return formatStatus(status).label;
}

/**
 * Compute consolidation display values using total_practices as denominator.
 * CRITICAL: Uses total practices, never classified_count (per CLAUDE.md rules).
 */
export function computeConsolidationDisplay(totals: {
  independent: number;
  dso_affiliated: number;
  pe_backed: number;
  unknown: number;
  total: number;
}) {
  const { independent, dso_affiliated, pe_backed, unknown, total } = totals;
  const consolidated = dso_affiliated + pe_backed;

  return {
    consolidated,
    consolidatedPct: total > 0 ? (consolidated / total) * 100 : 0,
    independentPct: total > 0 ? (independent / total) * 100 : 0,
    unknownPct: total > 0 ? (unknown / total) * 100 : 0,
    showUnknownWarning: total > 0 && unknown / total > 0.3,
    total,
    label:
      total > 0 && unknown / total > 0.3
        ? "Known Consolidated"
        : "Consolidated",
  };
}
