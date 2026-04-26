import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../supabase/client";
import {
  extractTopPracticeSignals,
  getScopedChanges,
  getScopedDeals,
  getScopedPractices,
  getScopedPracticeSignals,
  getScopedZipScores,
  getScopedZipSignals,
  getWarroomSummary,
} from "../supabase/queries/warroom";
import { buildWarroomBriefing } from "./briefing";
import { DEFAULT_WARROOM_LENS, type WarroomLens } from "./mode";
import { rankTargets, summarizeRankedTargets } from "./ranking";
import {
  DEFAULT_WARROOM_SCOPE,
  getScopeLabel,
  normalizeWarroomDataScope,
  resolveScopeZipCodes,
  type WarroomScopeInput,
  type WarroomScopeKind,
} from "./scope";
import type {
  RankedTarget,
  WarroomIntentFilter,
  WarroomOwnershipCounts,
  WarroomPracticeRecord,
  WarroomPracticeSignalRecord,
  WarroomSitrepBundle,
  WarroomSummary,
  WarroomTargetCandidate,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "./signals";

const DEFAULT_RANK_LIMIT = 40;
const DEFAULT_TOP_SIGNAL_LIMIT = 8;

function stableScopeId(kind: WarroomScopeKind, zipCodes: string[] | null): string {
  if (zipCodes == null) return `${kind}:us`;
  if (zipCodes.length === 0) return `${kind}:empty`;
  const sorted = [...zipCodes].sort();
  const hash = sorted.length > 12 ? `${sorted.slice(0, 6).join("-")}…${sorted.slice(-3).join("-")}` : sorted.join("-");
  return `${kind}:${hash}`;
}

function buildCandidates(
  practices: WarroomPracticeRecord[],
  practiceSignals: WarroomPracticeSignalRecord[],
  zipScores: WarroomZipScoreRecord[],
  zipSignals: WarroomZipSignalRecord[]
): WarroomTargetCandidate[] {
  const signalByNpi = new Map<string, WarroomPracticeSignalRecord>();
  practiceSignals.forEach((signal) => signalByNpi.set(signal.npi, signal));

  const zipScoreByZip = new Map<string, WarroomZipScoreRecord>();
  zipScores.forEach((row) => {
    if (row.zip_code) zipScoreByZip.set(row.zip_code, row);
  });

  const zipSignalByZip = new Map<string, WarroomZipSignalRecord>();
  zipSignals.forEach((row) => zipSignalByZip.set(row.zip_code, row));

  return practices.map((practice) => ({
    practice,
    signal: signalByNpi.get(practice.npi) ?? null,
    zipSignal: practice.zip ? zipSignalByZip.get(practice.zip) ?? null : null,
    zipScore: practice.zip ? zipScoreByZip.get(practice.zip) ?? null : null,
  }));
}

async function loadSignalsSafely(
  scope: WarroomScopeInput,
  supabase: SupabaseClient
): Promise<{
  practiceSignals: WarroomPracticeSignalRecord[];
  zipSignals: WarroomZipSignalRecord[];
  error: string | null;
}> {
  try {
    // chunkSize: 50 keeps each practice_signals SELECT well under Supabase's
    // 8s statement_timeout. The default ZIP_FILTER_CHUNK_SIZE=200 was sending
    // ~10k rows × 40 columns per chunk for All Chicagoland and timing out.
    const [practiceSignals, zipSignals] = await Promise.all([
      getScopedPracticeSignals(scope, { chunkSize: 50 }, supabase),
      getScopedZipSignals(scope, {}, supabase),
    ]);
    return { practiceSignals, zipSignals, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { practiceSignals: [], zipSignals: [], error: message };
  }
}

export interface SitrepLoadOptions {
  lens?: WarroomLens;
  rankLimit?: number;
  topSignalLimit?: number;
  requireFlags?: string[];
  excludeFlags?: string[];
  excludeCorporate?: boolean;
  confidence?: "all" | "high" | "medium" | "low";
  intentFilter?: WarroomIntentFilter | null;
}

export async function getSitrepBundle(
  scope: WarroomScopeInput = DEFAULT_WARROOM_SCOPE,
  options: SitrepLoadOptions = {},
  supabaseClient?: SupabaseClient
): Promise<WarroomSitrepBundle> {
  const supabase = supabaseClient ?? getSupabaseBrowserClient();
  const lens: WarroomLens = options.lens ?? DEFAULT_WARROOM_LENS;
  const rankLimit = options.rankLimit ?? DEFAULT_RANK_LIMIT;
  const topSignalLimit = options.topSignalLimit ?? DEFAULT_TOP_SIGNAL_LIMIT;

  const dataScope = normalizeWarroomDataScope(scope);
  const zipCodes = resolveScopeZipCodes(scope);
  const scopeLabel = getScopeLabel(scope);
  const warnings: string[] = [];
  const practiceFetchLimit = zipCodes === null ? Math.max(rankLimit * 50, 5000) : undefined;
  if (practiceFetchLimit != null) {
    warnings.push(
      `US target ranking is capped to the top ${practiceFetchLimit.toLocaleString()} practices by buyability to avoid loading the full national practice table.`
    );
  }

  // Use Promise.allSettled so a single query timeout (e.g., practices table locked during
  // sync) degrades gracefully instead of killing the entire bundle. Each settled result
  // is checked individually and failures push a warning rather than throwing.
  const [
    summaryResult,
    practicesResult,
    zipScoresResult,
    recentDealsResult,
    recentChangesResult,
    signalBundleResult,
  ] = await Promise.allSettled([
    getWarroomSummary(scope, supabase),
    getScopedPractices(
      scope,
      { orderBy: "buyability_score", ascending: false, maxRows: practiceFetchLimit },
      supabase
    ),
    getScopedZipScores(scope, {}, supabase),
    getScopedDeals(scope, {}, supabase),
    getScopedChanges(scope, { maxRows: 500 }, supabase),
    loadSignalsSafely(scope, supabase),
  ]);

  function settled<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
    if (result.status === "fulfilled") return result.value;
    const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
    warnings.push(`${label} unavailable: ${msg.slice(0, 120)}`);
    return fallback;
  }

  const emptyOwnership: WarroomOwnershipCounts = {
    total: 0, independent: 0, corporate: 0, specialist: 0, nonClinical: 0,
    unknown: 0, known: 0, corporatePct: 0, independentPct: 0, unknownPct: 0,
  };
  const emptySummary: WarroomSummary = {
    scopeKind: normalizeWarroomDataScope(scope).kind,
    scopeLabel,
    zipCodes,
    generatedAt: new Date().toISOString(),
    ownership: emptyOwnership,
    enrichedPractices: 0,
    enrichedPct: 0,
    acquisitionTargets: 0,
    retirementRisk: 0,
    dealCount: 0,
    latestDealDate: null,
    zipScoreCount: 0,
    averageCorporateSharePct: null,
    changeCount: 0,
    changeCount90d: 0,
    signalCounts: null,
    corporateHighConfidence: 0,
    corporateHighConfidencePct: 0,
    avgBuyabilityScore: null,
    avgOpportunityScore: null,
  };

  const summary = settled(summaryResult, emptySummary, "Summary");
  const practices = settled(practicesResult, [] as WarroomPracticeRecord[], "Practices");
  const zipScores = settled(zipScoresResult, [] as WarroomZipScoreRecord[], "ZIP scores");
  const recentDeals = settled(recentDealsResult, [], "Recent deals");
  const recentChanges = settled(recentChangesResult, [], "Recent changes");
  const signalBundle = settled(signalBundleResult, { practiceSignals: [], zipSignals: [], error: "failed to load" }, "Signals");

  const { practiceSignals, zipSignals, error: signalsError } = signalBundle;
  const signalsAvailable = signalsError === null && (practiceSignals.length > 0 || zipSignals.length > 0);

  if (signalsError) {
    warnings.push(`Signal layer unavailable: ${signalsError}`);
  } else if (!signalsAvailable) {
    warnings.push("No practice_signals/zip_signals rows yet in scope.");
  }

  if (practices.length === 0) {
    warnings.push("No practices returned in scope — sync or scope may be empty.");
  }

  const topSignals = extractTopPracticeSignals(practiceSignals, topSignalLimit);
  const candidates = buildCandidates(practices, practiceSignals, zipScores, zipSignals);
  const rankedTargets: RankedTarget[] = rankTargets(candidates, {
    lens,
    limit: rankLimit,
    requireFlags: options.requireFlags,
    excludeFlags: options.excludeFlags,
    excludeCorporate: options.excludeCorporate,
    confidence: options.confidence,
    intentFilter: options.intentFilter,
  });

  const briefing = buildWarroomBriefing({
    summary,
    zipScores,
    zipSignals,
    recentDeals,
    recentChanges,
    topSignals,
  });

  const rankingSummary = summarizeRankedTargets(rankedTargets);
  if (rankingSummary.count === 0 && practices.length > 0) {
    warnings.push("Ranking returned zero candidates — filters or signal gaps may be too tight.");
  }

  const lastSignalComputed = practiceSignals
    .map((signal) => signal.created_at)
    .filter((value): value is string => typeof value === "string")
    .sort()
    .pop() ?? null;

  const lastZipScored = zipScores
    .map((row) => row.score_date)
    .filter((value): value is string => typeof value === "string")
    .sort()
    .pop() ?? null;

  return {
    scope: {
      id: stableScopeId(dataScope.kind, zipCodes),
      kind: dataScope.kind,
      label: scopeLabel,
      zipCodes,
      zipCount: zipCodes?.length ?? 0,
    },
    generatedAt: new Date().toISOString(),
    summary,
    zipScores,
    zipSignals,
    recentDeals,
    recentChanges,
    topSignals,
    rankedTargets,
    briefing,
    dataHealth: {
      signalsAvailable,
      signalsError,
      practicesFetched: practices.length,
      lastSignalComputed,
      lastZipScored,
      warnings,
    },
  };
}

export function summarizeBundleForLogging(bundle: WarroomSitrepBundle) {
  return {
    scope: bundle.scope.label,
    practices: bundle.summary.ownership.total,
    enrichedPct: bundle.summary.enrichedPct,
    acquisitionTargets: bundle.summary.acquisitionTargets,
    retirementRisk: bundle.summary.retirementRisk,
    corporateHighConfPct: bundle.summary.corporateHighConfidencePct,
    ranked: bundle.rankedTargets.length,
    topScore: bundle.rankedTargets[0]?.score ?? 0,
    briefingItems: bundle.briefing.length,
    signalsAvailable: bundle.dataHealth.signalsAvailable,
  };
}
