import { resolveDsoTier, resolveDsoTierEntry } from "./dso-tiers"
import { getPracticeDisplayName } from "./display"
import {
  isZipCommutable,
  type LaunchpadScope,
} from "./scope"
import {
  CONCRETE_LAUNCHPAD_TRACKS,
  LAUNCHPAD_SIGNALS,
  LAUNCHPAD_TIER_THRESHOLDS,
  type ConcreteLaunchpadTrack,
  type LaunchpadPracticeIntelRecord,
  type LaunchpadPracticeRecord,
  type LaunchpadRankedTarget,
  type LaunchpadRecentDealRecord,
  type LaunchpadSignalContribution,
  type LaunchpadSignalId,
  type LaunchpadTier,
  type LaunchpadTrack,
  type LaunchpadTrackScore,
  type LaunchpadZipScoreRecord,
} from "./signals"

export const TRACK_MULTIPLIERS: Record<
  ConcreteLaunchpadTrack,
  Partial<Record<LaunchpadSignalId, number>>
> = {
  succession: {
    mentor_rich_signal: 1.5,
    succession_track_signal: 2.0,
    succession_published_signal: 2.5,
    high_volume_ethical_signal: 0.5,
    boutique_solo_signal: 1.0,
    hiring_now_signal: 1.0,
    ffs_concierge_signal: 0.8,
    community_dso_signal: 0.0,
    tech_modern_signal: 0.7,
    mentor_density_zip_signal: 1.3,
    dso_avoid_warning: 1.0,
    family_dynasty_warning: 1.5,
    ghost_practice_warning: 1.0,
    recent_acquisition_warning: 1.2,
    associate_saturated_signal: 1.5,
    medicaid_mill_warning: 1.0,
    non_compete_radius_warning: 0.8,
    pe_recap_volatility_warning: 0.8,
  },
  high_volume: {
    mentor_rich_signal: 1.0,
    succession_track_signal: 0.5,
    succession_published_signal: 0.3,
    high_volume_ethical_signal: 1.5,
    boutique_solo_signal: 1.5,
    hiring_now_signal: 1.5,
    ffs_concierge_signal: 1.2,
    community_dso_signal: 0.5,
    tech_modern_signal: 1.0,
    mentor_density_zip_signal: 0.8,
    dso_avoid_warning: 1.0,
    family_dynasty_warning: 1.0,
    ghost_practice_warning: 1.0,
    recent_acquisition_warning: 1.0,
    associate_saturated_signal: 0.5,
    medicaid_mill_warning: 1.2,
    non_compete_radius_warning: 0.8,
    pe_recap_volatility_warning: 0.8,
  },
  dso: {
    mentor_rich_signal: 0.5,
    succession_track_signal: 0.0,
    succession_published_signal: 0.0,
    high_volume_ethical_signal: 0.5,
    boutique_solo_signal: 0.3,
    hiring_now_signal: 1.0,
    ffs_concierge_signal: 0.0,
    community_dso_signal: 2.0,
    tech_modern_signal: 0.8,
    mentor_density_zip_signal: 0.5,
    dso_avoid_warning: 1.5,
    family_dynasty_warning: 0.0,
    ghost_practice_warning: 1.0,
    recent_acquisition_warning: 0.8,
    associate_saturated_signal: 0.3,
    medicaid_mill_warning: 0.5,
    non_compete_radius_warning: 1.5,
    pe_recap_volatility_warning: 1.3,
  },
}

const BASE_SCORE = 50
const CONFIDENCE_FLOOR = 40
const CONFIDENCE_CAP = 70

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

const SOLO_CLASSIFICATIONS = new Set([
  "solo_established",
  "solo_new",
  "solo_inactive",
  "solo_high_volume",
])

const CORPORATE_CLASSIFICATIONS = new Set(["dso_regional", "dso_national"])

function isTruthyFlag(value: number | boolean | null | undefined): boolean {
  if (value == null) return false
  if (typeof value === "boolean") return value
  return value === 1
}

function truthyFromRawJson(raw: Record<string, unknown> | null, key: string): boolean {
  if (!raw) return false
  const value = raw[key]
  if (value == null) return false
  if (typeof value === "boolean") return value
  if (typeof value === "string") return /^(true|yes|1|active)$/i.test(value)
  if (typeof value === "number") return value === 1
  return false
}

function stringFromRawJson(raw: Record<string, unknown> | null, key: string): string | null {
  if (!raw) return null
  const value = raw[key]
  return typeof value === "string" ? value : null
}

export interface SignalEvaluationContext {
  practice: LaunchpadPracticeRecord
  intel: LaunchpadPracticeIntelRecord | null
  zipScore: LaunchpadZipScoreRecord | null
  scope: LaunchpadScope
  scopeCommutableZips: Set<string>
  mentorRichCountByZip: Map<string, number>
  nowYear: number
  recentDealZips: Set<string>
  recentAcquisitionNpis: Set<string>
}

export interface ActiveSignal {
  id: LaunchpadSignalId
  reasoning: string
}

function mentorRichFires(practice: LaunchpadPracticeRecord, nowYear: number): boolean {
  const cls = practice.entity_classification
  if (!cls || !SOLO_CLASSIFICATIONS.has(cls)) return false
  if (practice.year_established == null || nowYear - practice.year_established < 25) return false
  if ((practice.num_providers ?? 1) < 1) return false
  if ((practice.employee_count ?? 0) < 2) return false
  return true
}

export function evaluateSignals(ctx: SignalEvaluationContext): ActiveSignal[] {
  const { practice, intel, zipScore, nowYear, scopeCommutableZips, mentorRichCountByZip, recentAcquisitionNpis } = ctx
  const active: ActiveSignal[] = []
  const cls = practice.entity_classification
  const age = practice.year_established != null ? nowYear - practice.year_established : null
  const dsoTier = resolveDsoTier(practice.affiliated_dso, practice.parent_company, practice.franchise_name)

  const mentorRich = mentorRichFires(practice, nowYear)
  if (mentorRich) {
    active.push({
      id: "mentor_rich_signal",
      reasoning: `Solo practitioner · ${age ?? "?"}y in business · ${practice.employee_count ?? "?"} staff`,
    })
  }

  if (
    mentorRich &&
    (practice.buyability_score ?? 0) >= 50 &&
    (practice.num_providers ?? 1) === 1
  ) {
    active.push({
      id: "succession_track_signal",
      reasoning: `Mentor-rich + buyability ${practice.buyability_score} + no associate yet — classic succession setup.`,
    })
  }

  const hiringActiveRaw = intel?.raw_json ? truthyFromRawJson(intel.raw_json, "associate_openings") : false
  if (isTruthyFlag(intel?.hiring_active ?? null) || hiringActiveRaw) {
    active.push({
      id: "hiring_now_signal",
      reasoning: "Active associate opening detected from website or AI research.",
    })
  }

  const successionIntent = stringFromRawJson(intel?.raw_json ?? null, "succession_intent")
  if (successionIntent && successionIntent.toLowerCase() === "active_seeking") {
    active.push({
      id: "succession_published_signal",
      reasoning: "AI research detected active succession-seeking language or broker listing.",
    })
  }

  const zipIncome = zipScore?.median_household_income ?? null
  const notCorporate = cls == null || !CORPORATE_CLASSIFICATIONS.has(cls)
  const highVolumeEthical =
    (practice.employee_count ?? 0) >= 5 &&
    ((practice.estimated_revenue ?? 0) >= 800_000 || (practice.num_providers ?? 0) >= 3) &&
    notCorporate &&
    (zipIncome == null || zipIncome >= 75_000)

  if (highVolumeEthical) {
    active.push({
      id: "high_volume_ethical_signal",
      reasoning: `${practice.employee_count ?? "?"} staff · ${
        practice.num_providers ?? "?"
      } providers · non-corporate · healthy income ZIP.`,
    })
  }

  const techLevel = intel?.technology_level?.toLowerCase() ?? null
  const techModern = techLevel === "high"
  if (techModern) {
    active.push({
      id: "tech_modern_signal",
      reasoning: "AI research detected CBCT / iTero / intraoral scanner — modern clinical environment.",
    })
  }

  if (
    cls === "solo_high_volume" &&
    (practice.estimated_revenue ?? 0) >= 1_000_000 &&
    techModern
  ) {
    active.push({
      id: "boutique_solo_signal",
      reasoning: "High-revenue solo practice with modern tech — premium clinical setup.",
    })
  }

  const ppoHeavy = isTruthyFlag(intel?.ppo_heavy ?? null)
  const medicaid = isTruthyFlag(intel?.accepts_medicaid ?? null)
  if (intel?.ppo_heavy === false && intel?.accepts_medicaid === false) {
    active.push({
      id: "ffs_concierge_signal",
      reasoning: "Not PPO-heavy and not Medicaid — likely FFS or concierge mix.",
    })
  }

  if (cls === "dso_national" && (dsoTier === "tier1" || dsoTier === "tier2")) {
    active.push({
      id: "community_dso_signal",
      reasoning: `${practice.affiliated_dso ?? "DSO"} is rated ${dsoTier === "tier1" ? "Tier 1" : "Tier 2"} — structured benefits + mentorship.`,
    })
  }

  if (practice.zip && scopeCommutableZips.has(practice.zip)) {
    active.push({
      id: "commutable_signal",
      reasoning: "ZIP is inside your selected living location's commute ring.",
    })
  }

  if (
    zipScore?.market_type === "growing_undersupplied" &&
    zipScore.metrics_confidence &&
    ["high", "medium"].includes(zipScore.metrics_confidence)
  ) {
    active.push({
      id: "growing_undersupplied_signal",
      reasoning: "ZIP market type is growing_undersupplied — tailwind for associate demand.",
    })
  }

  const zipMentorCount = practice.zip ? mentorRichCountByZip.get(practice.zip) ?? 0 : 0
  const zipCorpShare = zipScore?.corporate_share_pct ?? null
  if (zipMentorCount >= 3 && (zipCorpShare == null || zipCorpShare < 0.25)) {
    active.push({
      id: "mentor_density_zip_signal",
      reasoning: `${zipMentorCount} mentor-rich practices in this ZIP with low corporate share — deep fallback options.`,
    })
  }

  if (cls === "dso_national" && dsoTier === "avoid") {
    active.push({
      id: "dso_avoid_warning",
      reasoning: `${practice.affiliated_dso} is on the AVOID list (documented patient-harm or churn).`,
    })
  }

  if (cls === "dso_national" && (dsoTier === "tier3" || dsoTier === "avoid")) {
    active.push({
      id: "non_compete_radius_warning",
      reasoning: "Tier 3 / AVOID DSO — historically aggressive non-compete enforcement.",
    })
  }

  if (cls === "family_practice") {
    active.push({
      id: "family_dynasty_warning",
      reasoning: "Shared last name at address — internal succession likely.",
    })
  }

  if (cls === "solo_inactive") {
    active.push({
      id: "ghost_practice_warning",
      reasoning: "Solo-inactive — no phone AND no website. Likely dormant or retired.",
    })
  }

  if (recentAcquisitionNpis.has(practice.npi)) {
    active.push({
      id: "recent_acquisition_warning",
      reasoning: "Ownership flipped to DSO-affiliated within the last 18 months — expect contract churn.",
    })
  }

  if (cls === "large_group" && (practice.num_providers ?? 0) >= 5) {
    active.push({
      id: "associate_saturated_signal",
      reasoning: `${practice.num_providers} providers on site — mentorship time per associate is limited.`,
    })
  }

  if (
    medicaid &&
    zipIncome != null &&
    zipIncome < 45_000 &&
    intel?.google_velocity?.toLowerCase() === "high"
  ) {
    active.push({
      id: "medicaid_mill_warning",
      reasoning: "Medicaid-heavy + low-income ZIP + high review velocity — Medicaid-mill volume risk.",
    })
  }

  if (practice.affiliated_pe_sponsor) {
    active.push({
      id: "pe_recap_volatility_warning",
      reasoning: `PE-backed (${practice.affiliated_pe_sponsor}) — PE ownership introduces comp and contract volatility.`,
    })
  }

  return active
}

function applyTrackMultipliers(
  active: ActiveSignal[],
  track: ConcreteLaunchpadTrack
): LaunchpadSignalContribution[] {
  const multipliers = TRACK_MULTIPLIERS[track]
  return active.map((activeSignal) => {
    const definition = LAUNCHPAD_SIGNALS[activeSignal.id]
    const multiplier = multipliers[activeSignal.id] ?? 1.0
    const contribution = round1(definition.baseWeight * multiplier)
    return {
      signalId: activeSignal.id,
      label: definition.label,
      category: definition.category,
      baseWeight: definition.baseWeight,
      multiplier,
      contribution,
      reasoning: activeSignal.reasoning,
    }
  })
}

export function tierFromScore(score: number): LaunchpadTier {
  if (score >= LAUNCHPAD_TIER_THRESHOLDS.best_fit.min) return "best_fit"
  if (score >= LAUNCHPAD_TIER_THRESHOLDS.strong.min) return "strong"
  if (score >= LAUNCHPAD_TIER_THRESHOLDS.maybe.min) return "maybe"
  if (score >= LAUNCHPAD_TIER_THRESHOLDS.low.min) return "low"
  return "avoid"
}

function hasThinData(
  practice: LaunchpadPracticeRecord,
  intel: LaunchpadPracticeIntelRecord | null
): boolean {
  if (intel == null) return true
  if ((practice.classification_confidence ?? 0) < CONFIDENCE_FLOOR) return true
  return false
}

export function scoreForTrack(
  active: ActiveSignal[],
  track: ConcreteLaunchpadTrack,
  practice: LaunchpadPracticeRecord,
  intel: LaunchpadPracticeIntelRecord | null
): LaunchpadTrackScore {
  const contributions = applyTrackMultipliers(active, track)
  const totalContribution = contributions.reduce((sum, c) => sum + c.contribution, 0)
  const raw = BASE_SCORE + totalContribution
  let final = clamp(raw, 0, 100)
  let capped = false
  if (hasThinData(practice, intel) && final > CONFIDENCE_CAP) {
    final = CONFIDENCE_CAP
    capped = true
  }
  return {
    track,
    rawScore: round1(raw),
    score: round1(final),
    tier: tierFromScore(final),
    contributions,
    confidenceCapped: capped,
  }
}

export interface RankContext {
  practices: LaunchpadPracticeRecord[]
  intelByNpi: Map<string, LaunchpadPracticeIntelRecord>
  zipScoreByZip: Map<string, LaunchpadZipScoreRecord>
  recentAcquisitionNpis: Set<string>
  recentDeals: LaunchpadRecentDealRecord[]
  scope: LaunchpadScope
  track: LaunchpadTrack
  nowYear?: number
}

function buildHeadline(
  practice: LaunchpadPracticeRecord,
  bestTrack: ConcreteLaunchpadTrack,
  bestScore: number,
  active: ActiveSignal[]
): string {
  const name = getPracticeDisplayName(practice)
  const location = [practice.city, practice.state].filter(Boolean).join(", ")
  const opportunityNames = active
    .filter((s) => LAUNCHPAD_SIGNALS[s.id].category === "opportunity")
    .slice(0, 2)
    .map((s) => LAUNCHPAD_SIGNALS[s.id].shortLabel)
  const warningCount = active.filter((s) => LAUNCHPAD_SIGNALS[s.id].category === "warning").length
  const signalChips = opportunityNames.join(" · ") || "signals thin"
  const warningSuffix = warningCount > 0 ? ` · ${warningCount} warning${warningCount > 1 ? "s" : ""}` : ""
  const trackLabel =
    bestTrack === "succession"
      ? "Succession"
      : bestTrack === "high_volume"
        ? "High-volume"
        : "DSO"
  return [
    name,
    location || null,
    `${Math.round(bestScore)} · ${trackLabel}`,
    `${signalChips}${warningSuffix}`,
  ]
    .filter(Boolean)
    .join(" — ")
}

export function rankTargets(ctx: RankContext): LaunchpadRankedTarget[] {
  const nowYear = ctx.nowYear ?? new Date().getFullYear()
  const scopeCommutableZips = new Set(
    ctx.practices
      .map((p) => p.zip)
      .filter((zip): zip is string => Boolean(zip))
      .filter((zip) => isZipCommutable(ctx.scope, zip))
  )

  const mentorRichCountByZip = new Map<string, number>()
  for (const practice of ctx.practices) {
    if (!practice.zip) continue
    if (!mentorRichFires(practice, nowYear)) continue
    mentorRichCountByZip.set(practice.zip, (mentorRichCountByZip.get(practice.zip) ?? 0) + 1)
  }

  const recentDealZips = new Set(
    ctx.recentDeals.map((deal) => deal.target_zip).filter((zip): zip is string => Boolean(zip))
  )

  const ranked: LaunchpadRankedTarget[] = ctx.practices.map((practice) => {
    const intel = ctx.intelByNpi.get(practice.npi) ?? null
    const zipScore = practice.zip ? ctx.zipScoreByZip.get(practice.zip) ?? null : null

    const evalCtx: SignalEvaluationContext = {
      practice,
      intel,
      zipScore,
      scope: ctx.scope,
      scopeCommutableZips,
      mentorRichCountByZip,
      nowYear,
      recentDealZips,
      recentAcquisitionNpis: ctx.recentAcquisitionNpis,
    }

    const active = evaluateSignals(evalCtx)

    const trackScores: Record<ConcreteLaunchpadTrack, LaunchpadTrackScore> = {
      succession: scoreForTrack(active, "succession", practice, intel),
      high_volume: scoreForTrack(active, "high_volume", practice, intel),
      dso: scoreForTrack(active, "dso", practice, intel),
    }

    let bestTrack: ConcreteLaunchpadTrack = "succession"
    let bestScore = -Infinity
    for (const track of CONCRETE_LAUNCHPAD_TRACKS) {
      if (trackScores[track].score > bestScore) {
        bestScore = trackScores[track].score
        bestTrack = track
      }
    }
    if (bestScore === -Infinity) bestScore = 0

    const displayTrack: ConcreteLaunchpadTrack =
      ctx.track === "all" || ctx.track === bestTrack
        ? bestTrack
        : (ctx.track as ConcreteLaunchpadTrack)
    const displayTrackScore = trackScores[displayTrack]

    const activeSignalIds = active.map((a) => a.id)
    const warningSignalIds = activeSignalIds.filter(
      (id) => LAUNCHPAD_SIGNALS[id].category === "warning"
    )
    const dsoEntry = resolveDsoTierEntry(
      practice.affiliated_dso,
      practice.parent_company,
      practice.franchise_name
    )

    return {
      npi: practice.npi,
      practice,
      intel,
      zipScore,
      commutable: scopeCommutableZips.has(practice.zip ?? ""),
      dsoTier: dsoEntry?.tier ?? null,
      bestTrack,
      bestScore,
      bestTier: tierFromScore(bestScore),
      displayScore: displayTrackScore.score,
      displayTier: displayTrackScore.tier,
      trackScores,
      activeSignalIds,
      warningSignalIds,
      headline: buildHeadline(practice, bestTrack, bestScore, active),
      rank: 0,
    }
  })

  const sortedRanked = [...ranked].sort((a, b) => {
    if (ctx.track === "all") return b.bestScore - a.bestScore
    return b.displayScore - a.displayScore
  })

  return sortedRanked.map((target, index) => ({ ...target, rank: index + 1 }))
}

export function summarizeRankedTargets(
  targets: LaunchpadRankedTarget[],
  track: LaunchpadTrack
): {
  bestFit: number
  strong: number
  maybe: number
  low: number
  avoid: number
  mentorRich: number
  hiringNow: number
  avoidList: number
} {
  let bestFit = 0
  let strong = 0
  let maybe = 0
  let low = 0
  let avoid = 0
  let mentorRich = 0
  let hiringNow = 0
  let avoidList = 0

  for (const target of targets) {
    const scoreSource = track === "all" ? target.bestTier : target.displayTier
    switch (scoreSource) {
      case "best_fit":
        bestFit += 1
        break
      case "strong":
        strong += 1
        break
      case "maybe":
        maybe += 1
        break
      case "low":
        low += 1
        break
      case "avoid":
        avoid += 1
        break
    }
    if (target.activeSignalIds.includes("mentor_rich_signal")) mentorRich += 1
    if (target.activeSignalIds.includes("hiring_now_signal")) hiringNow += 1
    if (target.activeSignalIds.includes("dso_avoid_warning")) avoidList += 1
  }

  return { bestFit, strong, maybe, low, avoid, mentorRich, hiringNow, avoidList }
}
