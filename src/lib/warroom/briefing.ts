import type {
  WarroomBriefingItem,
  WarroomChangeRecord,
  WarroomDealRecord,
  WarroomPracticeSignalRecord,
  WarroomSignalCounts,
  WarroomSummary,
  WarroomZipScoreRecord,
  WarroomZipSignalRecord,
} from "./signals";

export interface BriefingInputs {
  summary: WarroomSummary;
  zipScores: WarroomZipScoreRecord[];
  zipSignals: WarroomZipSignalRecord[];
  recentDeals: WarroomDealRecord[];
  recentChanges: WarroomChangeRecord[];
  topSignals: {
    stealthClusters: WarroomPracticeSignalRecord[];
    phantomInventory: WarroomPracticeSignalRecord[];
    retirementCombo: WarroomPracticeSignalRecord[];
    familyDynasties: WarroomPracticeSignalRecord[];
    microClusters: WarroomPracticeSignalRecord[];
  };
}

const DEAL_WINDOW_DAYS = 90;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number | null): string {
  if (value == null) return "--";
  return `${round1(value)}%`;
}

function isWithinWindow(dateString: string | null, days: number): boolean {
  if (!dateString) return false;
  const ts = Date.parse(dateString);
  if (Number.isNaN(ts)) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return ts >= cutoff;
}

function addCorporateConsolidationItem(items: WarroomBriefingItem[], summary: WarroomSummary) {
  const pct = round1(summary.corporateHighConfidencePct ?? 0);
  const total = summary.ownership.total;
  if (total === 0) return;
  const severity: WarroomBriefingItem["severity"] =
    pct >= 5 ? "critical" : pct >= 2.5 ? "high" : "medium";

  items.push({
    id: "corporate-consolidation",
    severity,
    title: `${pct}% high-confidence corporate in ${summary.scopeLabel}`,
    detail:
      `${summary.corporateHighConfidence.toLocaleString()} verified DSO/PE-owned locations out of ${total.toLocaleString()} practices. ` +
      `Broader corporate signals (including phone-only): ${formatPercent(summary.ownership.corporatePct)}.`,
    lens: "consolidation",
    metric: { label: "Corporate share", value: `${pct}`, unit: "%" },
  });
}

function addRetirementRiskItem(items: WarroomBriefingItem[], summary: WarroomSummary) {
  if (summary.retirementRisk === 0) return;
  const pct = round1((summary.retirementRisk / Math.max(summary.ownership.total, 1)) * 100);
  const severity: WarroomBriefingItem["severity"] =
    summary.retirementRisk >= 40 ? "high" : summary.retirementRisk >= 10 ? "medium" : "info";

  items.push({
    id: "retirement-risk",
    severity,
    title: `${summary.retirementRisk} retirement-risk targets`,
    detail: `Independent practices established before 1995 (~${pct}% of the scope). Pair with the retirement lens in Hunt mode to rank succession opportunities.`,
    lens: "retirement",
    action: {
      label: "Switch to Hunt · Retirement",
      intentHint: "retirement risk top 25",
    },
    metric: { label: "Retirement risk", value: summary.retirementRisk, unit: "practices" },
  });
}

function addAcquisitionTargetItem(items: WarroomBriefingItem[], summary: WarroomSummary) {
  if (summary.acquisitionTargets === 0) return;
  items.push({
    id: "acquisition-targets",
    severity: summary.acquisitionTargets >= 20 ? "high" : "medium",
    title: `${summary.acquisitionTargets} acquisition-ready practices`,
    detail: `Buyability score ≥ 50 in ${summary.scopeLabel}. Use "top 25 buyability ≥ 60" in the command bar to rank them.`,
    lens: "buyability",
    action: {
      label: "Show ranked list",
      intentHint: "top 25 acquisition targets",
    },
    metric: { label: "Acquisition ready", value: summary.acquisitionTargets, unit: "practices" },
  });
}

function addStealthDsoItem(
  items: WarroomBriefingItem[],
  signals: WarroomSignalCounts | null,
  stealthClusters: WarroomPracticeSignalRecord[]
) {
  if (!signals || signals.stealthDsoClusters === 0) return;
  const topCluster = stealthClusters[0];
  items.push({
    id: "stealth-dso",
    severity: signals.stealthDsoClusters >= 10 ? "high" : "medium",
    title: `${signals.stealthDsoClusters} stealth-DSO clusters detected`,
    detail: topCluster
      ? `${signals.stealthDsoPractices} practices flagged as pre-affiliated. Largest cluster: ${
          topCluster.stealth_dso_cluster_id ?? "unknown"
        } (${topCluster.stealth_dso_cluster_size ?? 0} locations in ${
          topCluster.stealth_dso_zip_count ?? 1
        } ZIPs).`
      : `${signals.stealthDsoPractices} practices show hidden-cluster signals.`,
    lens: "consolidation",
    action: {
      label: "Surface stealth clusters",
      intentHint: "stealth dso top 20",
    },
    metric: { label: "Stealth clusters", value: signals.stealthDsoClusters, unit: "clusters" },
  });
}

function addPhantomInventoryItem(
  items: WarroomBriefingItem[],
  signals: WarroomSignalCounts | null
) {
  if (!signals || signals.phantomInventoryPractices === 0) return;
  items.push({
    id: "phantom-inventory",
    severity: signals.phantomInventoryPractices >= 30 ? "high" : "medium",
    title: `${signals.phantomInventoryPractices} phantom-inventory practices`,
    detail: `NPPES listed but missing digital footprint (no website + low review presence). Likely retired or semi-active — confirm before outreach.`,
    lens: "buyability",
    action: {
      label: "Review phantom list",
      intentHint: "phantom inventory top 25",
    },
    metric: { label: "Phantom", value: signals.phantomInventoryPractices, unit: "practices" },
  });
}

function addFamilyDynastyItem(
  items: WarroomBriefingItem[],
  signals: WarroomSignalCounts | null
) {
  if (!signals || signals.familyDynastyPractices === 0) return;
  items.push({
    id: "family-dynasty",
    severity: "medium",
    title: `${signals.familyDynastyPractices} family dynasties`,
    detail: `Shared last names at address → internal succession likely. Exclude with "no family practices" in Hunt to avoid wasted outreach.`,
    lens: "retirement",
    action: {
      label: "Exclude dynasties",
      intentHint: "top 25 acquisition targets no family practices",
    },
    metric: { label: "Dynasties", value: signals.familyDynastyPractices, unit: "practices" },
  });
}

function addAdaGapItem(items: WarroomBriefingItem[], signals: WarroomSignalCounts | null) {
  if (!signals || signals.adaGapZips === 0) return;
  items.push({
    id: "ada-gap",
    severity: "info",
    title: `${signals.adaGapZips} ZIPs exceed ADA benchmark`,
    detail: `Local DSO penetration is already above the state-level ADA benchmark — corridor may be near saturation.`,
    lens: "consolidation",
  });
}

function addRecentDealItem(items: WarroomBriefingItem[], recentDeals: WarroomDealRecord[]) {
  const windowed = recentDeals.filter((deal) => isWithinWindow(deal.deal_date, DEAL_WINDOW_DAYS));
  if (windowed.length === 0) return;
  const latest = windowed[0];
  items.push({
    id: "recent-deal-activity",
    severity: windowed.length >= 3 ? "high" : "medium",
    title: `${windowed.length} PE deals in last ${DEAL_WINDOW_DAYS} days`,
    detail: latest.target_name
      ? `Latest: ${latest.target_name} (${latest.target_city ?? ""}${
          latest.target_state ? `, ${latest.target_state}` : ""
        }) — ${latest.platform_company ?? latest.pe_sponsor ?? "Unknown sponsor"} on ${latest.deal_date}.`
      : `Latest deal logged ${latest.deal_date}.`,
    lens: "consolidation",
  });
}

function addChangeActivityItem(items: WarroomBriefingItem[], summary: WarroomSummary) {
  if (summary.changeCount90d === 0) return;
  items.push({
    id: "change-activity",
    severity: summary.changeCount90d >= 30 ? "high" : "medium",
    title: `${summary.changeCount90d} ownership/name changes in 90d`,
    detail: `Each change is a potential acquisition breadcrumb — filter by recent change in Hunt mode to focus on post-event targets.`,
    lens: "consolidation",
    action: {
      label: "Filter Hunt by recent",
      intentHint: "recent changes top 25",
    },
  });
}

function addDataQualityItem(items: WarroomBriefingItem[], summary: WarroomSummary) {
  const unknownPct = summary.ownership.unknownPct ?? 0;
  if (unknownPct >= 30) {
    items.push({
      id: "data-quality-unknown",
      severity: "critical",
      title: `${round1(unknownPct)}% unclassified ownership`,
      detail: `Over ${round1(unknownPct)}% of ${summary.scopeLabel} practices have no entity_classification. Consolidation KPIs may under-report until classification completes.`,
      lens: "consolidation",
    });
  } else if (summary.signalCounts === null) {
    items.push({
      id: "data-quality-signals",
      severity: "info",
      title: "Signals layer syncing",
      detail: `Hidden-gold signals aren't fully loaded in Supabase yet. Hunt mode will fall back to quantitative scoring until the sync completes.`,
    });
  }
}

function addMarketHeadlineItem(items: WarroomBriefingItem[], summary: WarroomSummary) {
  if (summary.zipScoreCount === 0) return;
  const avg = summary.avgOpportunityScore;
  const corp = summary.averageCorporateSharePct;
  const details: string[] = [];
  if (avg != null) details.push(`avg opportunity ${avg}/100`);
  if (corp != null) details.push(`avg corporate share ${corp}%`);
  items.push({
    id: "market-headline",
    severity: "info",
    title: `${summary.scopeLabel} at a glance`,
    detail: details.length
      ? `${summary.zipScoreCount} scored ZIPs · ${details.join(" · ")}.`
      : `${summary.zipScoreCount} scored ZIPs in scope.`,
    metric: avg != null ? { label: "Avg opportunity", value: avg, unit: "/100" } : undefined,
  });
}

export function buildWarroomBriefing(inputs: BriefingInputs): WarroomBriefingItem[] {
  const items: WarroomBriefingItem[] = [];
  const { summary, recentDeals, topSignals } = inputs;

  addDataQualityItem(items, summary);
  addCorporateConsolidationItem(items, summary);
  addRetirementRiskItem(items, summary);
  addAcquisitionTargetItem(items, summary);
  addStealthDsoItem(items, summary.signalCounts, topSignals.stealthClusters);
  addPhantomInventoryItem(items, summary.signalCounts);
  addFamilyDynastyItem(items, summary.signalCounts);
  addAdaGapItem(items, summary.signalCounts);
  addRecentDealItem(items, recentDeals);
  addChangeActivityItem(items, summary);
  addMarketHeadlineItem(items, summary);

  const severityOrder: Record<WarroomBriefingItem["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    info: 3,
  };
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return items;
}
