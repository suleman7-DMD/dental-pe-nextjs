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

/** Check if an entity_classification value represents an independent practice. */
export function isIndependentClassification(ec: string | null | undefined): boolean {
  if (!ec) return false;
  const v = ec.trim().toLowerCase();
  return (
    v === "solo_established" ||
    v === "solo_new" ||
    v === "solo_inactive" ||
    v === "solo_high_volume" ||
    v === "family_practice" ||
    v === "small_group" ||
    v === "large_group"
  );
}

/** Check if an entity_classification value represents a corporate/consolidated practice. */
export function isCorporateClassification(ec: string | null | undefined): boolean {
  if (!ec) return false;
  const v = ec.trim().toLowerCase();
  return v === "dso_regional" || v === "dso_national";
}

/** DSO/specialty names that should be filtered out of Top DSOs charts. */
export const DSO_FILTER_KEYWORDS = [
  'general dentistry',
  'oral surgery',
  'orthodontics',
  'periodontics',
  'endodontics',
  'pediatric dentistry',
  'prosthodontics',
  'dental hygiene',
];

/** Classify a practice using entity_classification with ownership_status fallback. */
export function classifyPractice(
  entityClassification: string | null | undefined,
  ownershipStatus: string | null | undefined
): "independent" | "corporate" | "specialist" | "non_clinical" | "unknown" {
  const ec = (entityClassification ?? "").trim().toLowerCase();
  if (isCorporateClassification(ec)) return "corporate";
  if (isIndependentClassification(ec)) return "independent";
  if (ec === "specialist") return "specialist";
  if (ec === "non_clinical") return "non_clinical";

  // Fallback to ownership_status when entity_classification is empty
  if (ec) return "unknown"; // ec is set but unrecognized
  const s = (ownershipStatus ?? "unknown").trim().toLowerCase();
  if (s === "dso_affiliated" || s === "pe_backed") return "corporate";
  if (s === "independent" || s === "likely_independent") return "independent";
  return "unknown";
}
