import type { OwnershipGroup, WarroomIntent, WarroomIntentFilter } from "./signals";

const OWNERSHIP_GROUP_SYNONYMS: Record<string, OwnershipGroup> = {
  independent: "independent",
  indie: "independent",
  indies: "independent",
  solo: "independent",
  solos: "independent",
  family: "independent",
  corporate: "corporate",
  corp: "corporate",
  chain: "corporate",
  chains: "corporate",
  dso: "corporate",
  dsos: "corporate",
  specialist: "specialist",
  specialists: "specialist",
  specialty: "specialist",
  "non-clinical": "non_clinical",
  "nonclinical": "non_clinical",
  lab: "non_clinical",
  labs: "non_clinical",
};

const ENTITY_CLASSIFICATION_SYNONYMS: Record<string, string[]> = {
  solo: ["solo_established", "solo_new", "solo_inactive", "solo_high_volume"],
  "solo established": ["solo_established"],
  "solo new": ["solo_new"],
  "solo inactive": ["solo_inactive"],
  "solo high volume": ["solo_high_volume"],
  family: ["family_practice"],
  "family practice": ["family_practice"],
  "small group": ["small_group"],
  "large group": ["large_group"],
  "dso regional": ["dso_regional"],
  "dso national": ["dso_national"],
};

const SIGNAL_SYNONYMS: Record<string, string> = {
  "stealth dso": "stealth_dso_flag",
  "stealth-dso": "stealth_dso_flag",
  "hidden dso": "stealth_dso_flag",
  "phantom inventory": "phantom_inventory_flag",
  "revenue default": "revenue_default_flag",
  "revenue-as-presence": "revenue_default_flag",
  "family dynasty": "family_dynasty_flag",
  "family dynasties": "family_dynasty_flag",
  "internal succession": "family_dynasty_flag",
  "succession likely": "family_dynasty_flag",
  "micro cluster": "micro_cluster_flag",
  "micro-cluster": "micro_cluster_flag",
  "micro clusters": "micro_cluster_flag",
  "disagreement": "intel_quant_disagreement_flag",
  "intel disagreement": "intel_quant_disagreement_flag",
  "retirement combo": "retirement_combo_flag",
  "retirement risk": "retirement_combo_flag",
  "retiring": "retirement_combo_flag",
  "retirement": "retirement_combo_flag",
  "retires": "retirement_combo_flag",
  "retire": "retirement_combo_flag",
  "recent change": "last_change_90d_flag",
  "recent changes": "last_change_90d_flag",
  "recent movement": "last_change_90d_flag",
  "moved": "last_change_90d_flag",
  "high peer buyability": "high_peer_buyability_flag",
  "high peer retirement": "high_peer_retirement_flag",
  "white space": "zip_white_space_flag",
  "whitespace": "zip_white_space_flag",
  "compound demand": "zip_compound_demand_flag",
  "mirror pair": "zip_white_space_flag",
  "contested": "zip_contested_zone_flag",
  "contested zone": "zip_contested_zone_flag",
  "ada gap": "zip_ada_benchmark_gap_flag",
};

const SUBZONE_SYNONYMS: Record<string, string> = {
  "core": "core",
  "dupage": "core",
  "naperville": "core",
  "dupage will": "core",
  "dupage-will": "core",
  "south west suburbs": "south",
  "sw suburbs": "south",
  "sw": "south",
  "southwest suburbs": "south",
  "south suburbs": "south",
  "north": "north",
  "north shore": "north",
  "north suburbs": "north",
  "city": "city",
  "chicago city": "city",
  "chi city": "city",
  "west": "west",
  "inner west": "west",
  "west suburbs": "west",
  "far west": "far_west",
  "fox valley": "far_west",
  "aurora": "far_west",
  "elgin": "far_west",
  "far south": "far_south",
  "joliet": "far_south",
};

const SCOPE_SYNONYMS: Record<string, WarroomIntentFilter["scope"]> = {
  "chicagoland": "chicagoland",
  "all chicagoland": "chicagoland",
  "chicago area": "chicagoland",
  "west loop": "west_loop_south_loop",
  "south loop": "west_loop_south_loop",
  "west loop south loop": "west_loop_south_loop",
  "woodridge": "woodridge",
  "bolingbrook": "bolingbrook",
};

const NEGATORS = ["no", "not", "without", "exclude", "excluding", "non"];

interface ParseContext {
  rawText: string;
  normalized: string;
  filter: WarroomIntentFilter;
  chips: WarroomIntent["chips"];
  warnings: string[];
  recognized: Set<string>;
}

function createInitialFilter(): WarroomIntentFilter {
  return {
    scope: null,
    zipCodes: [],
    subzones: [],
    ownershipGroups: [],
    entityClassifications: [],
    minBuyability: null,
    maxBuyability: null,
    minYearEstablished: null,
    maxYearEstablished: null,
    minEmployees: null,
    maxEmployees: null,
    requireFlags: [],
    excludeFlags: [],
    requirePeBacked: null,
    dsoNames: [],
    peSponsorNames: [],
    retirementRiskOnly: false,
    acquisitionTargetsOnly: false,
    limit: null,
  };
}

function normalizeForParse(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addChip(context: ParseContext, id: string, label: string, key: keyof WarroomIntentFilter) {
  if (context.chips.some((chip) => chip.id === id)) return;
  context.chips.push({ id, label, key });
}

function detectLimit(context: ParseContext) {
  const match = context.normalized.match(/\b(?:top|first|limit|show me|give me|find)\s+(\d{1,3})\b/);
  if (match) {
    const limit = Number(match[1]);
    if (Number.isFinite(limit) && limit > 0 && limit <= 500) {
      context.filter.limit = limit;
      context.recognized.add(match[0]);
      addChip(context, `limit:${limit}`, `Top ${limit}`, "limit");
    }
  }
  const countMatch = context.normalized.match(/\b(\d{1,3})\s+(targets|practices|deals|hits|opportunities)\b/);
  if (countMatch) {
    const limit = Number(countMatch[1]);
    if (Number.isFinite(limit) && limit > 0 && limit <= 500) {
      context.filter.limit = limit;
      context.recognized.add(countMatch[0]);
      addChip(context, `limit:${limit}`, `${limit} ${countMatch[2]}`, "limit");
    }
  }
}

function detectScope(context: ParseContext) {
  for (const [phrase, scope] of Object.entries(SCOPE_SYNONYMS)) {
    if (context.normalized.includes(phrase)) {
      context.filter.scope = scope;
      context.recognized.add(phrase);
      addChip(context, `scope:${scope}`, phrase.replace(/\b\w/g, (c) => c.toUpperCase()), "scope");
      return;
    }
  }
  for (const [phrase, subzone] of Object.entries(SUBZONE_SYNONYMS)) {
    if (context.normalized.includes(phrase)) {
      if (!context.filter.subzones.includes(subzone)) {
        context.filter.subzones.push(subzone);
      }
      context.recognized.add(phrase);
      addChip(
        context,
        `subzone:${subzone}`,
        `${phrase.replace(/\b\w/g, (c) => c.toUpperCase())} zone`,
        "subzones"
      );
    }
  }
}

function detectZipCodes(context: ParseContext) {
  const matches = context.normalized.match(/\b\d{5}\b/g);
  if (!matches) return;
  const unique = Array.from(new Set(matches));
  context.filter.zipCodes.push(...unique);
  unique.forEach((zip) => {
    context.recognized.add(zip);
    addChip(context, `zip:${zip}`, `ZIP ${zip}`, "zipCodes");
  });
}

function detectOwnership(context: ParseContext) {
  const segments = context.normalized.split(/\s+/);
  const tokens = segments;

  const negateIndexes = new Set<number>();
  tokens.forEach((token, idx) => {
    if (NEGATORS.includes(token)) negateIndexes.add(idx);
  });

  for (const [synonym, group] of Object.entries(OWNERSHIP_GROUP_SYNONYMS)) {
    const idx = tokens.indexOf(synonym);
    if (idx === -1) continue;
    const negated = negateIndexes.has(idx - 1) || negateIndexes.has(idx - 2);
    context.recognized.add(synonym);
    if (negated) {
      if (!context.filter.excludeFlags.includes(`ownership:${group}`)) {
        context.filter.excludeFlags.push(`ownership:${group}`);
      }
      addChip(context, `exclude:${group}`, `No ${synonym}`, "excludeFlags");
    } else {
      if (!context.filter.ownershipGroups.includes(group)) {
        context.filter.ownershipGroups.push(group);
      }
      addChip(context, `own:${group}`, synonym.replace(/\b\w/g, (c) => c.toUpperCase()), "ownershipGroups");
    }
  }

  for (const [phrase, classifications] of Object.entries(ENTITY_CLASSIFICATION_SYNONYMS)) {
    if (context.normalized.includes(phrase)) {
      classifications.forEach((classification) => {
        if (!context.filter.entityClassifications.includes(classification)) {
          context.filter.entityClassifications.push(classification);
        }
      });
      context.recognized.add(phrase);
      addChip(
        context,
        `ec:${classifications.join(",")}`,
        phrase.replace(/\b\w/g, (c) => c.toUpperCase()),
        "entityClassifications"
      );
    }
  }

  if (/\bno pe\b|\bno-pe\b|\bnon[-\s]?pe\b/.test(context.normalized)) {
    context.filter.requirePeBacked = false;
    context.recognized.add("no pe");
    addChip(context, "pe:exclude", "No PE", "requirePeBacked");
  } else if (/\bpe backed\b|\bpe-backed\b|\bpe exposure\b/.test(context.normalized)) {
    context.filter.requirePeBacked = true;
    context.recognized.add("pe backed");
    addChip(context, "pe:require", "PE-Backed", "requirePeBacked");
  }
}

function detectSignalFlags(context: ParseContext) {
  const lower = context.normalized;
  for (const [phrase, flag] of Object.entries(SIGNAL_SYNONYMS)) {
    if (lower.includes(phrase)) {
      const beforePhraseIdx = lower.indexOf(phrase);
      const preamble = lower.slice(Math.max(0, beforePhraseIdx - 12), beforePhraseIdx);
      const negated = NEGATORS.some((neg) => preamble.endsWith(` ${neg} `) || preamble.endsWith(` ${neg}-`));
      context.recognized.add(phrase);
      if (negated) {
        if (!context.filter.excludeFlags.includes(flag)) {
          context.filter.excludeFlags.push(flag);
        }
        addChip(context, `xflag:${flag}`, `No ${phrase}`, "excludeFlags");
      } else {
        if (!context.filter.requireFlags.includes(flag)) {
          context.filter.requireFlags.push(flag);
        }
        addChip(context, `flag:${flag}`, phrase.replace(/\b\w/g, (c) => c.toUpperCase()), "requireFlags");
      }
    }
  }
}

function detectBuyability(context: ParseContext) {
  const gteMatch = context.normalized.match(/\b(?:buyability|buyable)\s+(?:over|above|>=?|≥|at least|>)\s+(\d{1,3})\b/);
  if (gteMatch) {
    const value = Number(gteMatch[1]);
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
      context.filter.minBuyability = value;
      context.recognized.add(gteMatch[0]);
      addChip(context, `minBuy:${value}`, `Buyability ≥ ${value}`, "minBuyability");
    }
  }
  const lteMatch = context.normalized.match(/\b(?:buyability|buyable)\s+(?:under|below|<=?|≤|at most|<)\s+(\d{1,3})\b/);
  if (lteMatch) {
    const value = Number(lteMatch[1]);
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
      context.filter.maxBuyability = value;
      context.recognized.add(lteMatch[0]);
      addChip(context, `maxBuy:${value}`, `Buyability ≤ ${value}`, "maxBuyability");
    }
  }
  if (/\bhigh buyability\b/.test(context.normalized) && context.filter.minBuyability == null) {
    context.filter.minBuyability = 50;
    context.recognized.add("high buyability");
    addChip(context, "minBuy:50", "High Buyability", "minBuyability");
  }
  if (/\bacquisition targets?\b|\btargets?\b/.test(context.normalized)) {
    context.filter.acquisitionTargetsOnly = true;
    context.recognized.add("acquisition targets");
    addChip(context, "acqTarget", "Acquisition Targets", "acquisitionTargetsOnly");
  }
}

function detectYearEstablished(context: ParseContext) {
  const overMatch = context.normalized.match(/\b(?:over|more than|older than|above)\s+(\d{1,3})\s+years?(?:\s+old)?\b/);
  if (overMatch) {
    const years = Number(overMatch[1]);
    if (Number.isFinite(years) && years >= 1 && years <= 200) {
      const currentYear = new Date().getFullYear();
      context.filter.maxYearEstablished = currentYear - years;
      context.recognized.add(overMatch[0]);
      addChip(context, `age>${years}`, `${years}+ yrs old`, "maxYearEstablished");
    }
  }
  const beforeMatch = context.normalized.match(/\b(?:established|founded|opened)\s+(?:before|prior to)\s+(\d{4})\b/);
  if (beforeMatch) {
    const year = Number(beforeMatch[1]);
    if (year >= 1900 && year <= 2100) {
      context.filter.maxYearEstablished = year;
      context.recognized.add(beforeMatch[0]);
      addChip(context, `year<${year}`, `Before ${year}`, "maxYearEstablished");
    }
  }
  if (/\bretirement[-\s]?risk\b/.test(context.normalized)) {
    context.filter.retirementRiskOnly = true;
    context.recognized.add("retirement risk");
    addChip(context, "retire", "Retirement Risk", "retirementRiskOnly");
  }
}

function detectEmployees(context: ParseContext) {
  const plusMatch = context.normalized.match(/\b(\d{1,3})\+?\s+(?:staff|employees|people)\b/);
  if (plusMatch) {
    const value = Number(plusMatch[1]);
    if (Number.isFinite(value)) {
      context.filter.minEmployees = value;
      context.recognized.add(plusMatch[0]);
      addChip(context, `emp:${value}`, `${value}+ staff`, "minEmployees");
    }
  }
}

function detectDsoAndPe(context: ParseContext) {
  const dsoMatch = context.normalized.match(/(?:aspen|heartland|pacific|smile brands|dental care alliance|western dental|gentle dental|affordable care|dental partners|mid atlantic dental|great expressions|100% dental|allcare dental|mortenson|tend|tag)/);
  if (dsoMatch) {
    const name = dsoMatch[0].replace(/\b\w/g, (c) => c.toUpperCase());
    if (!context.filter.dsoNames.includes(name)) {
      context.filter.dsoNames.push(name);
    }
    context.recognized.add(dsoMatch[0]);
    addChip(context, `dso:${name}`, name, "dsoNames");
  }
}

export function parseIntent(rawText: string): WarroomIntent {
  const normalized = normalizeForParse(rawText);
  const context: ParseContext = {
    rawText,
    normalized,
    filter: createInitialFilter(),
    chips: [],
    warnings: [],
    recognized: new Set<string>(),
  };

  if (!normalized) {
    return {
      rawText,
      normalized,
      filter: context.filter,
      chips: [],
      warnings: [],
      recognizedTokens: [],
    };
  }

  detectLimit(context);
  detectScope(context);
  detectZipCodes(context);
  detectOwnership(context);
  detectSignalFlags(context);
  detectBuyability(context);
  detectYearEstablished(context);
  detectEmployees(context);
  detectDsoAndPe(context);

  const chipCount = context.chips.length;
  if (chipCount === 0 && normalized.length > 4) {
    context.warnings.push(
      "No filters recognized. Try phrasing like \"10 acquisition targets in SW suburbs with retirement risk and no PE exposure\"."
    );
  }

  return {
    rawText,
    normalized,
    filter: context.filter,
    chips: context.chips,
    warnings: context.warnings,
    recognizedTokens: Array.from(context.recognized),
  };
}

export function emptyIntent(): WarroomIntent {
  return {
    rawText: "",
    normalized: "",
    filter: createInitialFilter(),
    chips: [],
    warnings: [],
    recognizedTokens: [],
  };
}

export function intentHasFilters(intent: WarroomIntent): boolean {
  const f = intent.filter;
  return (
    f.scope != null ||
    f.zipCodes.length > 0 ||
    f.subzones.length > 0 ||
    f.ownershipGroups.length > 0 ||
    f.entityClassifications.length > 0 ||
    f.requireFlags.length > 0 ||
    f.excludeFlags.length > 0 ||
    f.minBuyability != null ||
    f.maxBuyability != null ||
    f.minYearEstablished != null ||
    f.maxYearEstablished != null ||
    f.minEmployees != null ||
    f.maxEmployees != null ||
    f.requirePeBacked != null ||
    f.dsoNames.length > 0 ||
    f.peSponsorNames.length > 0 ||
    f.retirementRiskOnly ||
    f.acquisitionTargetsOnly ||
    f.limit != null
  );
}

export const INTENT_PRESETS: { id: string; label: string; query: string }[] = [
  {
    id: "succession-sw",
    label: "SW succession plays",
    query: "10 acquisition targets in SW suburbs with retirement risk and no PE exposure",
  },
  {
    id: "stealth-dso",
    label: "Stealth DSO scan",
    query: "practices with stealth DSO signals in Chicagoland",
  },
  {
    id: "family-dynasties",
    label: "Family dynasties",
    query: "family dynasty practices with buyability over 50",
  },
  {
    id: "whitespace",
    label: "White-space ZIPs",
    query: "white space zips with high buyability in Chicagoland",
  },
  {
    id: "contested",
    label: "Contested zones",
    query: "contested zones with recent movement",
  },
  {
    id: "solo-retirement",
    label: "Solo dentists near retirement",
    query: "solo practices over 25 years old with retirement risk in Woodridge",
  },
];
