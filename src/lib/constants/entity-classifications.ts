/**
 * All 11 entity classification values with display labels and descriptions.
 * Matches the system defined in scrapers/dso_classifier.py.
 */

export interface EntityClassificationInfo {
  value: string;
  label: string;
  description: string;
  category: "solo" | "group" | "corporate" | "other";
}

export const ENTITY_CLASSIFICATIONS: EntityClassificationInfo[] = [
  {
    value: "solo_established",
    label: "Solo Established",
    description:
      "Single-provider practice, operating 20+ years or default for single providers with limited data",
    category: "solo",
  },
  {
    value: "solo_new",
    label: "Solo New",
    description:
      "Single-provider practice, established within last 10 years",
    category: "solo",
  },
  {
    value: "solo_inactive",
    label: "Solo Inactive",
    description:
      "Single-provider practice, missing phone and website -- likely retired or minimal activity",
    category: "solo",
  },
  {
    value: "solo_high_volume",
    label: "Solo High Volume",
    description:
      "Single-provider with 5+ employees or $800k+ revenue -- likely needs associate help",
    category: "solo",
  },
  {
    value: "family_practice",
    label: "Family Practice",
    description:
      "2+ providers at same address share a last name -- internal succession likely",
    category: "group",
  },
  {
    value: "small_group",
    label: "Small Group",
    description:
      "2-3 providers at same address, different last names, not matching known DSO",
    category: "group",
  },
  {
    value: "large_group",
    label: "Large Group",
    description:
      "4+ providers at same address, not matching known DSO brand",
    category: "group",
  },
  {
    value: "dso_regional",
    label: "DSO Regional",
    description:
      "Appears independent but shows corporate signals (parent company, shared EIN, franchise field, branch location type, generic brand + high provider count)",
    category: "corporate",
  },
  {
    value: "dso_national",
    label: "DSO National",
    description:
      "Known national/regional DSO brand (Aspen, Heartland, etc.) matched with high confidence",
    category: "corporate",
  },
  {
    value: "specialist",
    label: "Specialist",
    description:
      "Specialist practice (Ortho, Endo, Perio, OMS, Pedo) -- identified by taxonomy code or practice name keywords",
    category: "other",
  },
  {
    value: "non_clinical",
    label: "Non-Clinical",
    description:
      "Dental lab, supply company, billing entity, staffing service",
    category: "other",
  },
];

/** Quick lookup: value -> info */
export const ENTITY_CLASSIFICATION_MAP = new Map(
  ENTITY_CLASSIFICATIONS.map((ec) => [ec.value, ec])
);

/** Human-readable label for an entity classification value. */
export function getEntityClassificationLabel(value: string | null): string {
  if (!value) return "Unknown";
  return ENTITY_CLASSIFICATION_MAP.get(value)?.label ?? value;
}
