import { classifyPractice } from "@/lib/constants/entity-classifications";
import type { WarroomLens } from "./mode";
import { getSubzoneZipCodes, resolveScopeZipCodes } from "./scope";
import type {
  OwnershipGroup,
  RankedTarget,
  WarroomIntentFilter,
  WarroomPracticeRecord,
  WarroomPracticeSignalRecord,
  WarroomScoreComponent,
  WarroomTargetCandidate,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "./signals";

const INDEPENDENT_GROUPS: ReadonlySet<OwnershipGroup> = new Set(["independent"]);
const CORPORATE_GROUPS: ReadonlySet<OwnershipGroup> = new Set(["corporate"]);
const SPECIALIST_GROUPS: ReadonlySet<OwnershipGroup> = new Set(["specialist"]);

export interface ComponentWeights {
  buyability: number;
  retirement: number;
  entityFit: number;
  enrichment: number;
  recentChange: number;
  corporatePenalty: number;
  intelDisagreement: number;
  phantomInventory: number;
  familyDynastyPenalty: number;
  peerPercentile: number;
  marketTailwind: number;
  dealCatchment: number;
  whitespaceBoost: number;
  stealthDsoPenalty: number;
}

const DEFAULT_WEIGHTS: ComponentWeights = {
  buyability: 30,
  retirement: 25,
  entityFit: 15,
  enrichment: 10,
  recentChange: -10,
  corporatePenalty: -30,
  intelDisagreement: 10,
  phantomInventory: 10,
  familyDynastyPenalty: -12,
  peerPercentile: 12,
  marketTailwind: 8,
  dealCatchment: -10,
  whitespaceBoost: 6,
  stealthDsoPenalty: -15,
};

const LENS_WEIGHT_MULTIPLIERS: Record<WarroomLens, Partial<ComponentWeights>> = {
  consolidation: {
    corporatePenalty: -40,
    stealthDsoPenalty: -20,
    buyability: 25,
  },
  density: {
    buyability: 25,
    enrichment: 12,
    marketTailwind: 12,
  },
  buyability: {
    buyability: 40,
    retirement: 20,
    peerPercentile: 18,
  },
  retirement: {
    retirement: 40,
    buyability: 22,
    familyDynastyPenalty: -18,
    peerPercentile: 16,
  },
  pe_exposure: {
    corporatePenalty: -45,
    dealCatchment: -18,
    stealthDsoPenalty: -25,
  },
  saturation: {
    marketTailwind: 14,
    whitespaceBoost: 10,
    corporatePenalty: -35,
  },
  whitespace: {
    whitespaceBoost: 20,
    marketTailwind: 14,
    buyability: 22,
  },
  disagreement: {
    intelDisagreement: 24,
    phantomInventory: 18,
    buyability: 18,
  },
};

function mergeWeights(lens: WarroomLens): ComponentWeights {
  const overrides = LENS_WEIGHT_MULTIPLIERS[lens];
  return { ...DEFAULT_WEIGHTS, ...overrides };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buyabilityComponent(
  practice: WarroomPracticeRecord,
  weight: number
): WarroomScoreComponent {
  const raw = practice.buyability_score ?? 0;
  const normalized = clamp(raw / 100, 0, 1);
  const contribution = round1(normalized * weight);
  const reasoning = practice.buyability_score == null
    ? "No buyability score yet — neutral contribution."
    : `Buyability ${raw}/100 → ${contribution > 0 ? "+" : ""}${contribution}pt.`;
  return { label: "Buyability", weight, contribution, reasoning };
}

function retirementComponent(
  signal: WarroomPracticeSignalRecord | null,
  practice: WarroomPracticeRecord,
  weight: number
): WarroomScoreComponent {
  const practiceAge =
    practice.year_established != null
      ? new Date().getFullYear() - practice.year_established
      : null;
  const ageFactor = practiceAge != null ? clamp((practiceAge - 15) / 35, 0, 1) : 0;
  const comboScore = signal?.retirement_combo_score ?? 0;
  const comboFactor = clamp(comboScore / 100, 0, 1);
  const flagBoost = signal?.retirement_combo_flag ? 0.2 : 0;
  const normalized = clamp(Math.max(ageFactor, comboFactor) + flagBoost, 0, 1);
  const contribution = round1(normalized * weight);

  const parts: string[] = [];
  if (practiceAge != null) parts.push(`${practiceAge}y in business`);
  if (comboScore > 0) parts.push(`combo score ${comboScore}`);
  if (signal?.retirement_combo_flag) parts.push("retirement combo flagged");
  const reasoning = parts.length
    ? `${parts.join(", ")} → ${contribution > 0 ? "+" : ""}${contribution}pt.`
    : "No retirement signal yet.";

  return { label: "Retirement trajectory", weight, contribution, reasoning };
}

function entityFitComponent(
  ownership: OwnershipGroup,
  entityClassification: string | null,
  weight: number
): WarroomScoreComponent {
  let normalized = 0;
  if (INDEPENDENT_GROUPS.has(ownership)) {
    normalized = entityClassification === "solo_established" ? 1 : 0.75;
    if (entityClassification === "solo_high_volume") normalized = 0.9;
    if (entityClassification === "solo_inactive") normalized = 0.6;
    if (entityClassification === "large_group") normalized = 0.5;
    if (entityClassification === "small_group") normalized = 0.65;
    if (entityClassification === "family_practice") normalized = 0.4;
  } else if (SPECIALIST_GROUPS.has(ownership)) {
    normalized = 0.4;
  } else if (CORPORATE_GROUPS.has(ownership)) {
    normalized = -0.8;
  }
  const contribution = round1(normalized * weight);
  const reasoning = `${ownership}${entityClassification ? ` / ${entityClassification}` : ""} → ${
    contribution > 0 ? "+" : ""
  }${contribution}pt.`;
  return { label: "Entity fit", weight, contribution, reasoning };
}

function enrichmentComponent(
  practice: WarroomPracticeRecord,
  weight: number
): WarroomScoreComponent {
  const enrichedFields = [
    practice.data_axle_import_date,
    practice.year_established,
    practice.employee_count,
    practice.estimated_revenue,
    practice.latitude,
    practice.longitude,
  ].filter((value) => value != null).length;
  const normalized = clamp(enrichedFields / 6, 0, 1);
  const contribution = round1(normalized * weight);
  const reasoning =
    enrichedFields === 0
      ? "Unenriched — no Data Axle overlay yet."
      : `${enrichedFields}/6 enrichment fields filled → +${contribution}pt.`;
  return { label: "Data enrichment", weight, contribution, reasoning };
}

function recentChangeComponent(
  signal: WarroomPracticeSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!signal?.last_change_90d_flag) {
    return {
      label: "Last 90d activity",
      weight,
      contribution: 0,
      reasoning: "No recent ownership/name changes.",
    };
  }
  const contribution = round1(weight);
  return {
    label: "Last 90d activity",
    weight,
    contribution,
    reasoning: `Recent change detected (${signal.last_change_type ?? "unknown"}).`,
  };
}

function corporatePenaltyComponent(
  ownership: OwnershipGroup,
  practice: WarroomPracticeRecord,
  weight: number
): WarroomScoreComponent {
  if (ownership !== "corporate") {
    return {
      label: "Corporate ownership",
      weight,
      contribution: 0,
      reasoning: "Not corporate.",
    };
  }
  const isHighConf =
    practice.entity_classification === "dso_national" ||
    (practice.entity_classification === "dso_regional" &&
      (practice.ein || practice.parent_company || practice.franchise_name));
  const scale = isHighConf ? 1 : 0.45;
  const contribution = round1(weight * scale);
  return {
    label: "Corporate ownership",
    weight,
    contribution,
    reasoning: isHighConf
      ? "High-confidence DSO/PE ownership — effectively off the table."
      : "Phone-only DSO signal — reduced penalty.",
  };
}

function intelDisagreementComponent(
  signal: WarroomPracticeSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!signal?.intel_quant_disagreement_flag) {
    return {
      label: "Intel/Quant disagreement",
      weight,
      contribution: 0,
      reasoning: "Intel and quant signals aligned.",
    };
  }
  const contribution = round1(weight);
  return {
    label: "Intel/Quant disagreement",
    weight,
    contribution,
    reasoning: signal.intel_quant_disagreement_type === "intel_favors"
      ? "Intel research favors target despite weak quant — opportunity to validate."
      : "Quant favors target despite cautious intel — dig into the reasoning.",
  };
}

function phantomInventoryComponent(
  signal: WarroomPracticeSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!signal?.phantom_inventory_flag) {
    return {
      label: "Phantom inventory",
      weight,
      contribution: 0,
      reasoning: "No phantom inventory signal.",
    };
  }
  const contribution = round1(weight);
  return {
    label: "Phantom inventory",
    weight,
    contribution,
    reasoning: "Listed but missing digital footprint — verify status before outreach.",
  };
}

function familyDynastyComponent(
  signal: WarroomPracticeSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!signal?.family_dynasty_flag) {
    return {
      label: "Family dynasty",
      weight,
      contribution: 0,
      reasoning: "No succession dynasty signal.",
    };
  }
  const contribution = round1(weight);
  return {
    label: "Family dynasty",
    weight,
    contribution,
    reasoning: "Shared last name at address → internal succession likely.",
  };
}

function peerPercentileComponent(
  signal: WarroomPracticeSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!signal) {
    return {
      label: "Peer percentile",
      weight,
      contribution: 0,
      reasoning: "No peer percentile computed.",
    };
  }
  const buyPct = signal.buyability_pctile_zip_class ?? 0;
  const retPct = signal.retirement_pctile_zip_class ?? 0;
  const normalized = clamp(Math.max(buyPct, retPct) / 100, 0, 1);
  const contribution = round1(normalized * weight);
  const peak = Math.max(buyPct, retPct);
  return {
    label: "Peer percentile",
    weight,
    contribution,
    reasoning: peak > 0
      ? `Top ${Math.round(100 - peak)}% vs. ZIP peers → +${contribution}pt.`
      : "Middle of peer pack.",
  };
}

function marketTailwindComponent(
  zipScore: WarroomZipScoreRecord | null,
  zipSignal: WarroomZipSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!zipScore && !zipSignal) {
    return {
      label: "Market tailwind",
      weight,
      contribution: 0,
      reasoning: "No ZIP-level market data.",
    };
  }
  const opportunity = zipScore?.opportunity_score ?? 0;
  const whiteSpace = zipSignal?.white_space_score ?? 0;
  const compound = zipSignal?.compound_demand_score ?? 0;
  const normalized = clamp(Math.max(opportunity, whiteSpace, compound) / 100, 0, 1);
  const contribution = round1(normalized * weight);
  return {
    label: "Market tailwind",
    weight,
    contribution,
    reasoning: opportunity >= whiteSpace && opportunity >= compound
      ? `ZIP opportunity score ${opportunity} → +${contribution}pt.`
      : whiteSpace >= compound
        ? `White-space score ${whiteSpace} in this ZIP.`
        : `Compound-demand signal score ${compound}.`,
  };
}

function dealCatchmentComponent(
  signal: WarroomPracticeSignalRecord | null,
  zipSignal: WarroomZipSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  const catchmentValues = [
    signal?.deal_catchment_24mo,
    zipSignal?.deal_catchment_max_24mo,
  ].filter((value): value is number => value != null);
  if (catchmentValues.length === 0) {
    return {
      label: "Deal catchment",
      weight,
      contribution: 0,
      reasoning: "Deal locations are not granular enough for a 2-mi catchment score.",
    };
  }

  const peak = Math.max(...catchmentValues);
  if (peak === 0) {
    return {
      label: "Deal catchment",
      weight,
      contribution: 0,
      reasoning: "No nearby deals in 24 months.",
    };
  }
  const normalized = clamp(peak / 10, 0, 1);
  const contribution = round1(normalized * weight);
  return {
    label: "Deal catchment",
    weight,
    contribution,
    reasoning: `${peak} nearby deals in 24mo → PE already crawling this block.`,
  };
}

function whitespaceBoostComponent(
  zipSignal: WarroomZipSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!zipSignal?.white_space_flag) {
    return {
      label: "White-space boost",
      weight,
      contribution: 0,
      reasoning: "ZIP not flagged for white space.",
    };
  }
  const contribution = round1(weight);
  return {
    label: "White-space boost",
    weight,
    contribution,
    reasoning: "High demand, low supply — underserved market signal.",
  };
}

function stealthDsoComponent(
  signal: WarroomPracticeSignalRecord | null,
  weight: number
): WarroomScoreComponent {
  if (!signal?.stealth_dso_flag) {
    return {
      label: "Stealth DSO signal",
      weight,
      contribution: 0,
      reasoning: "No hidden-cluster signal.",
    };
  }
  const contribution = round1(weight);
  return {
    label: "Stealth DSO signal",
    weight,
    contribution,
    reasoning: `Cluster ${signal.stealth_dso_cluster_id ?? "?"} (${signal.stealth_dso_cluster_size ?? 0} locations) — possibly pre-affiliated.`,
  };
}

function collectFlags(signal: WarroomPracticeSignalRecord | null, zipSignal: WarroomZipSignalRecord | null): string[] {
  const flags: string[] = [];
  const add = (...values: string[]) => flags.push(...values);

  if (signal?.stealth_dso_flag) add("stealth_dso", "stealth_dso_flag");
  if (signal?.phantom_inventory_flag) add("phantom_inventory", "phantom_inventory_flag");
  if (signal?.revenue_default_flag) add("revenue_default", "revenue_default_flag");
  if (signal?.family_dynasty_flag) add("family_dynasty", "family_dynasty_flag");
  if (signal?.micro_cluster_flag) add("micro_cluster", "micro_cluster_flag");
  if (signal?.intel_quant_disagreement_flag) add("intel_quant_disagreement", "intel_quant_disagreement_flag");
  if (signal?.retirement_combo_flag) add("retirement_combo", "retirement_combo_flag");
  if (signal?.last_change_90d_flag) add("last_change_90d", "last_change_90d_flag");
  if (signal?.high_peer_buyability_flag) add("high_peer_buyability", "high_peer_buyability_flag");
  if (signal?.high_peer_retirement_flag) add("high_peer_retirement", "high_peer_retirement_flag");
  if (zipSignal?.white_space_flag) add("zip_white_space", "zip_white_space_flag");
  if (zipSignal?.compound_demand_flag) add("zip_compound_demand", "zip_compound_demand_flag");
  if (zipSignal?.contested_zone_flag) add("zip_contested_zone", "zip_contested_zone_flag");
  if (zipSignal?.ada_benchmark_gap_flag) add("zip_ada_benchmark_gap", "zip_ada_benchmark_gap_flag");
  if (zipSignal?.mirror_pair_flag) add("zip_mirror_pair", "zip_mirror_pair_flag");
  return flags;
}

function buildHeadline(
  practice: WarroomPracticeRecord,
  ownership: OwnershipGroup,
  flags: string[],
  score: number
): string {
  const segments: string[] = [];
  const name = practice.practice_name ?? practice.doing_business_as ?? `NPI ${practice.npi}`;
  segments.push(name);
  if (practice.city && practice.state) segments.push(`${practice.city}, ${practice.state}`);
  const age =
    practice.year_established != null
      ? `${new Date().getFullYear() - practice.year_established}y old`
      : null;
  const topFlag = flags[0]?.replace(/_/g, " ");
  const tail = [age, topFlag, `score ${Math.round(score)}`].filter(Boolean).join(" · ");
  return ownership === "corporate"
    ? `${segments.join(" — ")} [corporate] · ${tail}`
    : `${segments.join(" — ")} · ${tail}`;
}

export function tierFromScore(score: number): RankedTarget["tier"] {
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "cool";
  return "cold";
}

const TIER_RANK: Record<RankedTarget["tier"], number> = {
  hot: 3,
  warm: 2,
  cool: 1,
  cold: 0,
};

function tierMeetsFloor(
  tier: RankedTarget["tier"],
  floor: WarroomIntentFilter["minTier"]
): boolean {
  if (!floor) return true;
  return TIER_RANK[tier] >= TIER_RANK[floor];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textMatchesAny(
  values: Array<string | null | undefined>,
  needles: string[]
): boolean {
  if (needles.length === 0) return true;
  const haystack = values.map(normalizeText).filter(Boolean);
  if (haystack.length === 0) return false;
  return needles.some((needle) => {
    const normalizedNeedle = normalizeText(needle);
    return Boolean(normalizedNeedle) && haystack.some((value) => value.includes(normalizedNeedle));
  });
}

function hasPeBacking(practice: WarroomPracticeRecord): boolean {
  const status = normalizeText(practice.ownership_status).replace(/\s+/g, "_");
  return status === "pe_backed" || Boolean(practice.affiliated_pe_sponsor);
}

function valueInRange(
  value: number | null,
  min: number | null,
  max: number | null
): boolean {
  if (min == null && max == null) return true;
  if (value == null) return false;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function practiceInZipSet(
  practice: WarroomPracticeRecord,
  zipCodes: string[] | null
): boolean {
  if (!zipCodes || zipCodes.length === 0) return true;
  return Boolean(practice.zip && new Set(zipCodes).has(practice.zip));
}

function matchesIntentScope(
  practice: WarroomPracticeRecord,
  filter: WarroomIntentFilter
): boolean {
  if (filter.scope) {
    const scopeZips = resolveScopeZipCodes(filter.scope);
    if (!practiceInZipSet(practice, scopeZips)) return false;
  }

  if (filter.zipCodes.length > 0) {
    if (!practice.zip || !filter.zipCodes.includes(practice.zip)) return false;
  }

  if (filter.subzones.length > 0) {
    const subzoneZips = new Set(filter.subzones.flatMap((subzone) => getSubzoneZipCodes(subzone)));
    if (subzoneZips.size === 0) return false;
    if (!practice.zip || !subzoneZips.has(practice.zip)) return false;
  }

  return true;
}

function candidateMatchesIntentFilter(
  candidate: WarroomTargetCandidate,
  ownership: OwnershipGroup,
  flags: string[],
  filter: WarroomIntentFilter | null | undefined
): boolean {
  if (!filter) return true;

  const { practice, signal } = candidate;

  if (!matchesIntentScope(practice, filter)) return false;

  if (filter.ownershipGroups.length > 0 && !filter.ownershipGroups.includes(ownership)) {
    return false;
  }

  if (
    filter.entityClassifications.length > 0 &&
    (!practice.entity_classification ||
      !filter.entityClassifications.includes(practice.entity_classification))
  ) {
    return false;
  }

  if (!valueInRange(practice.buyability_score, filter.minBuyability, filter.maxBuyability)) {
    return false;
  }

  if (!valueInRange(practice.year_established, filter.minYearEstablished, filter.maxYearEstablished)) {
    return false;
  }

  if (!valueInRange(practice.employee_count, filter.minEmployees, filter.maxEmployees)) {
    return false;
  }

  if (filter.requirePeBacked != null && hasPeBacking(practice) !== filter.requirePeBacked) {
    return false;
  }

  if (
    !textMatchesAny(
      [
        practice.affiliated_dso,
        practice.parent_company,
        practice.franchise_name,
        practice.practice_name,
        practice.doing_business_as,
      ],
      filter.dsoNames
    )
  ) {
    return false;
  }

  if (!textMatchesAny([practice.affiliated_pe_sponsor, practice.parent_company], filter.peSponsorNames)) {
    return false;
  }

  if (filter.retirementRiskOnly && !signal?.retirement_combo_flag && !flags.includes("retirement_combo_flag")) {
    return false;
  }

  if (filter.acquisitionTargetsOnly) {
    const score = practice.buyability_score ?? 0;
    if (ownership !== "independent" || score < 50) return false;
  }

  return true;
}

export interface RankTargetsOptions {
  lens?: WarroomLens;
  weights?: Partial<ComponentWeights>;
  excludeCorporate?: boolean;
  requireFlags?: string[];
  excludeFlags?: string[];
  confidence?: "all" | "high" | "medium" | "low";
  intentFilter?: WarroomIntentFilter | null;
  limit?: number;
}

function matchesConfidenceFilter(
  value: number | null,
  confidence: RankTargetsOptions["confidence"]
): boolean {
  if (!confidence || confidence === "all") return true;
  if (confidence === "high") return (value ?? 0) >= 80;
  if (confidence === "medium") return (value ?? 0) >= 50 && (value ?? 0) < 80;
  return value == null || value < 50;
}

export function rankTargets(
  candidates: WarroomTargetCandidate[],
  options: RankTargetsOptions = {}
): RankedTarget[] {
  const lens: WarroomLens = options.lens ?? "buyability";
  const baseWeights = mergeWeights(lens);
  const weights: ComponentWeights = { ...baseWeights, ...options.weights };
  const requireFlagSet = new Set(options.requireFlags ?? []);
  const excludeFlagSet = new Set(options.excludeFlags ?? []);

  const ranked = candidates
    .map<RankedTarget | null>((candidate) => {
      const { practice, signal, zipScore, zipSignal } = candidate;
      const ownership = classifyPractice(practice.entity_classification, practice.ownership_status);
      const flags = collectFlags(signal, zipSignal);
      const matchFlags = [...flags, `ownership:${ownership}`];

      if (options.excludeCorporate && ownership === "corporate") return null;
      if (!matchesConfidenceFilter(practice.classification_confidence, options.confidence)) return null;
      if (!candidateMatchesIntentFilter(candidate, ownership, flags, options.intentFilter)) return null;

      for (const required of requireFlagSet) {
        if (!matchFlags.includes(required)) return null;
      }
      for (const excluded of excludeFlagSet) {
        if (matchFlags.includes(excluded)) return null;
      }

      const components: WarroomScoreComponent[] = [
        buyabilityComponent(practice, weights.buyability),
        retirementComponent(signal, practice, weights.retirement),
        entityFitComponent(ownership, practice.entity_classification, weights.entityFit),
        enrichmentComponent(practice, weights.enrichment),
        recentChangeComponent(signal, weights.recentChange),
        corporatePenaltyComponent(ownership, practice, weights.corporatePenalty),
        intelDisagreementComponent(signal, weights.intelDisagreement),
        phantomInventoryComponent(signal, weights.phantomInventory),
        familyDynastyComponent(signal, weights.familyDynastyPenalty),
        peerPercentileComponent(signal, weights.peerPercentile),
        marketTailwindComponent(zipScore, zipSignal, weights.marketTailwind),
        dealCatchmentComponent(signal, zipSignal, weights.dealCatchment),
        whitespaceBoostComponent(zipSignal, weights.whitespaceBoost),
        stealthDsoComponent(signal, weights.stealthDsoPenalty),
      ];

      const raw = components.reduce((sum, component) => sum + component.contribution, 0);
      const score = clamp(raw + 50, 0, 100);
      const tier = tierFromScore(score);

      if (!tierMeetsFloor(tier, options.intentFilter?.minTier ?? null)) return null;

      return {
        npi: practice.npi,
        practiceName: practice.practice_name ?? practice.doing_business_as ?? `NPI ${practice.npi}`,
        city: practice.city,
        zip: practice.zip,
        ownershipGroup: ownership,
        entityClassification: practice.entity_classification,
        buyabilityScore: practice.buyability_score,
        yearEstablished: practice.year_established,
        employeeCount: practice.employee_count,
        numProviders: practice.num_providers,
        estimatedRevenue: practice.estimated_revenue,
        latitude: practice.latitude,
        longitude: practice.longitude,
        score: round1(score),
        rank: 0,
        tier,
        flagCount: flags.filter((flag) => flag.endsWith("_flag")).length,
        flags,
        components,
        headline: buildHeadline(practice, ownership, flags, score),
        candidate,
      };
    })
    .filter((target): target is RankedTarget => target !== null)
    .sort((a, b) => b.score - a.score);

  const sliced = options.limit ? ranked.slice(0, options.limit) : ranked;
  return sliced.map((target, index) => ({ ...target, rank: index + 1 }));
}

export function summarizeRankedTargets(targets: RankedTarget[]) {
  const tiers: Record<RankedTarget["tier"], number> = { hot: 0, warm: 0, cool: 0, cold: 0 };
  let totalScore = 0;
  targets.forEach((target) => {
    tiers[target.tier] += 1;
    totalScore += target.score;
  });
  return {
    count: targets.length,
    avgScore: targets.length ? round1(totalScore / targets.length) : 0,
    tiers,
    topScore: targets[0]?.score ?? 0,
  };
}
