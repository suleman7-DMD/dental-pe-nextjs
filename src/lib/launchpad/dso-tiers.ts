export type DsoTier = "tier1" | "tier2" | "tier3" | "avoid" | "unknown"

export const DSO_TIER_LABELS: Record<DsoTier, string> = {
  tier1: "Strong for new grads",
  tier2: "Decent with caveats",
  tier3: "Mixed — proceed with caution",
  avoid: "Avoid",
  unknown: "Unrated",
}

export const DSO_TIER_COLORS: Record<DsoTier, string> = {
  tier1: "#2D8B4E",
  tier2: "#D4920B",
  tier3: "#C47A3B",
  avoid: "#C23B3B",
  unknown: "#6B6B60",
}

export interface DsoTierEntry {
  name: string
  aliases: string[]
  tier: DsoTier
  rationale: string
  citations: { label: string; url: string }[]
  compBand: { base: string; total: string; notes?: string } | null
  structure: string | null
}

const RAW_ENTRIES: DsoTierEntry[] = [
  {
    name: "Mortenson Dental Partners",
    aliases: ["Mortenson"],
    tier: "tier1",
    rationale:
      "Publicly describes itself as employee-owned. Lower-volume clinical environments, genuine ownership culture, regional (KY/IN/TN).",
    citations: [
      { label: "Mortenson About page (employee-owned)", url: "https://www.mortensondental.com/about" },
    ],
    compBand: {
      base: "$130k–$155k",
      total: "$150k–$200k",
      notes: "Production above 28-30% of collections typical once ramped.",
    },
    structure: "Employee-owned regional group",
  },
  {
    name: "MB2 Dental Partners",
    aliases: ["MB2", "MB2 Dental"],
    tier: "tier1",
    rationale:
      "DPO (dentist-owned partnership) structure. Associates retain equity upside when partnering into locations.",
    citations: [
      { label: "MB2 Dental partnership model", url: "https://mb2dental.com/partnership" },
    ],
    compBand: {
      base: "$135k–$160k",
      total: "$175k–$280k",
      notes: "Partnership buy-in creates equity ladder. Base + % of collections.",
    },
    structure: "Dentist partnership (DPO)",
  },
  {
    name: "Dental Associates of Wisconsin",
    aliases: ["Dental Associates", "Dental Associates WI"],
    tier: "tier1",
    rationale:
      "Regional, family-operated group. Strong new-grad training program, established mentorship culture.",
    citations: [
      { label: "Dental Associates careers", url: "https://www.dentalassociates.com/careers" },
    ],
    compBand: {
      base: "$125k–$150k",
      total: "$145k–$190k",
      notes: "Structured mentorship year.",
    },
    structure: "Regional family-operated group",
  },
  {
    name: "Pacific Dental Services",
    aliases: ["PDS", "Pacific Dental"],
    tier: "tier2",
    rationale:
      "Heavy infrastructure + CE support. Watch for aggressive non-compete radius and owner-dentist track expectations.",
    citations: [
      { label: "PDS careers", url: "https://www.pacificdentalservices.com/careers/" },
    ],
    compBand: {
      base: "$120k–$150k",
      total: "$160k–$240k",
      notes: "Owner-dentist track involves equity + earnings split. Review non-compete carefully.",
    },
    structure: "Owner-dentist supported DSO",
  },
  {
    name: "Dental Care Alliance",
    aliases: ["DCA", "Dental Care Alliance"],
    tier: "tier2",
    rationale:
      "Florida-heavy but expanding Midwest. Decent base packages; production metrics can tighten post-ramp.",
    citations: [
      { label: "Dental Care Alliance", url: "https://www.dentalcarealliance.com/" },
    ],
    compBand: {
      base: "$125k–$150k",
      total: "$150k–$220k",
    },
    structure: "Regional DSO",
  },
  {
    name: "Benevis",
    aliases: ["Benevis", "Kool Smiles"],
    tier: "tier2",
    rationale:
      "Safety-net/Medicaid-focused model. High clinical volume (pro: fast reps; con: demanding). Genuine mentorship for clinicians who handle the pace.",
    citations: [
      { label: "Benevis", url: "https://www.benevis.com/" },
    ],
    compBand: {
      base: "$140k–$170k",
      total: "$180k–$250k",
      notes: "Volume-driven; production % and base both typically higher than average.",
    },
    structure: "Pediatric/safety-net DSO",
  },
  {
    name: "Community Dental Partners",
    aliases: ["Community Dental Partners", "CDP"],
    tier: "tier2",
    rationale:
      "FQHC-adjacent community model. Mission-driven with lower comp ceiling but stable. Loan forgiveness pathways available.",
    citations: [
      { label: "Community Dental Partners", url: "https://www.communitydentalpartners.com/" },
    ],
    compBand: {
      base: "$120k–$145k",
      total: "$130k–$165k",
      notes: "HRSA/NHSC loan repayment eligibility possible.",
    },
    structure: "Community/FQHC-adjacent",
  },
  {
    name: "Heartland Dental",
    aliases: ["Heartland"],
    tier: "tier3",
    rationale:
      "Largest US DSO by footprint. Production pressure is well-documented; average first-associate tenure 12–24mo. Comp packages improved post-2023 but non-compete aggressively enforced.",
    citations: [
      { label: "Heartland careers", url: "https://jobs.heartland.com/earn/" },
    ],
    compBand: {
      base: "$120k–$150k",
      total: "$150k–$230k",
      notes: "Signing bonus typical; review non-compete radius (historically 25mi / 2y).",
    },
    structure: "Large national DSO (KKR-backed)",
  },
  {
    name: "National Dental Group",
    aliases: ["NADG", "North American Dental Group"],
    tier: "tier3",
    rationale:
      "Similar trajectory to Heartland — large, PE-backed, production-focused. Regional variation in culture.",
    citations: [
      { label: "NADG", url: "https://www.nadentalgroup.com/" },
    ],
    compBand: {
      base: "$120k–$145k",
      total: "$145k–$210k",
    },
    structure: "Large PE-backed DSO",
  },
  {
    name: "Great Expressions Dental Centers",
    aliases: ["Great Expressions", "GEDC"],
    tier: "tier3",
    rationale:
      "Mixed regional variation — Michigan/SE markets generally perform better than Florida. PE ownership; check recent recap history.",
    citations: [
      { label: "Great Expressions", url: "https://www.greatexpressions.com/" },
    ],
    compBand: {
      base: "$115k–$140k",
      total: "$140k–$195k",
    },
    structure: "Regional PE-backed DSO",
  },
  {
    name: "American Dental Partners",
    aliases: ["ADI", "American Dental Partners"],
    tier: "tier3",
    rationale:
      "Rebranded multiple times — an instability signal. Compensation packages vary widely by affiliated practice.",
    citations: [
      { label: "ADI", url: "https://www.americandentalpartners.com/" },
    ],
    compBand: {
      base: "$115k–$145k",
      total: "$140k–$195k",
    },
    structure: "DSO holding co",
  },
  {
    name: "Aspen Dental",
    aliases: ["Aspen Dental", "Aspen Dental Management", "ADMI"],
    tier: "avoid",
    rationale:
      "NY AG settlement (2015) over predatory billing/financing; PBS Frontline 'Dollars and Dentists' (2012) documented consumer harm. Aggressive upsell incentives persist. Distinguish ADMI (mgmt co) from individual clinical PCs.",
    citations: [
      {
        label: "NY AG settlement (2015)",
        url: "https://ag.ny.gov/press-release/2015/attorney-general-schneiderman-announces-settlement-aspen-dental",
      },
      { label: "PBS Frontline (2012)", url: "https://www.pbs.org/wgbh/frontline/film/dollars-and-dentists/" },
    ],
    compBand: {
      base: "$140k–$180k",
      total: "$220k–$350k",
      notes: "Headline comp is high; documented patient-harm incentives and high churn offset the number.",
    },
    structure: "National DSO — avoid",
  },
  {
    name: "Sage Dental",
    aliases: ["Sage Dental"],
    tier: "avoid",
    rationale:
      "Florida-based. Multiple patient-complaint clusters + aggressive production metrics reported. Not recommended as a first associate role.",
    citations: [
      { label: "Sage Dental", url: "https://www.mysagedental.com/" },
    ],
    compBand: null,
    structure: "Regional DSO — avoid",
  },
  {
    name: "Western Dental",
    aliases: ["Western Dental", "Western Dental & Orthodontics"],
    tier: "avoid",
    rationale:
      "Repeated regulatory actions in California. Medicaid-heavy with high-volume production pressure; not suitable for mentorship-focused new grads.",
    citations: [
      { label: "Western Dental", url: "https://www.westerndental.com/" },
    ],
    compBand: null,
    structure: "Regional DSO — avoid",
  },
  {
    name: "Smile Brands",
    aliases: ["Smile Brands", "Bright Now Dental", "Bright Now! Dental", "Monarch Dental"],
    tier: "avoid",
    rationale:
      "Private-equity recapitalization cycle 2022–2024 caused comp and contract instability. Evaluate carefully; brand family includes Bright Now and Monarch.",
    citations: [
      { label: "Smile Brands", url: "https://www.smilebrands.com/" },
    ],
    compBand: null,
    structure: "PE-backed brand family — avoid",
  },
  {
    name: "Risas Dental",
    aliases: ["Risas Dental", "Risas Dental and Braces"],
    tier: "avoid",
    rationale:
      "Arizona-heavy, price-aggressive Medicaid model. Not aligned with mentorship-first first-job profile.",
    citations: [
      { label: "Risas Dental", url: "https://www.risasdental.com/" },
    ],
    compBand: null,
    structure: "Regional DSO — avoid",
  },
]

export const DSO_TIER_ENTRIES: DsoTierEntry[] = RAW_ENTRIES

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const ENTRY_BY_KEY = new Map<string, DsoTierEntry>()
for (const entry of DSO_TIER_ENTRIES) {
  const keys = [entry.name, ...entry.aliases].map(normalize).filter(Boolean)
  for (const key of keys) {
    if (!ENTRY_BY_KEY.has(key)) ENTRY_BY_KEY.set(key, entry)
  }
}

export function resolveDsoTierEntry(
  ...candidateNames: Array<string | null | undefined>
): DsoTierEntry | null {
  for (const candidate of candidateNames) {
    const key = normalize(candidate)
    if (!key) continue
    if (ENTRY_BY_KEY.has(key)) return ENTRY_BY_KEY.get(key) ?? null
    for (const [entryKey, entry] of ENTRY_BY_KEY) {
      if (entryKey && (key.includes(entryKey) || entryKey.includes(key))) {
        return entry
      }
    }
  }
  return null
}

export function resolveDsoTier(
  ...candidateNames: Array<string | null | undefined>
): DsoTier {
  return resolveDsoTierEntry(...candidateNames)?.tier ?? "unknown"
}

export function getDsoEntriesByTier(tier: DsoTier): DsoTierEntry[] {
  return DSO_TIER_ENTRIES.filter((entry) => entry.tier === tier)
}

export const DSO_AVOID_COUNT = getDsoEntriesByTier("avoid").length
