import type { Practice } from "@/lib/types";
import { tierToBucket } from "@/lib/census/ownership-truth";

/**
 * Compute job opportunity score for a practice (0-65 points).
 *
 * Ownership points come ONLY from the hand-reviewed census truth layer
 * (ownership_tier → headline bucket). Never from the legacy detector.
 *
 * Scoring factors:
 * - Census dentist-owned (solo owner-op T1, or dentist group/network T2-T3): +30
 * - Census unresolved (no reviewed conclusion yet): +10 — a capped
 *   "needs research" contribution, never treated as verified independence
 * - Census DSO/PE/corporate (T4-T5) or institutional (T6): +0
 * - Employees >= 10: +20, 5-9: +10
 * - Established >= 2021: +15, 2016-2020: +8
 * - Employee/year points are HALVED when data_axle_import_date is absent —
 *   without a Data Axle enrichment pass those structural fields are
 *   unverified NPPES self-report.
 *
 * The buyability_score boost was removed 2026-07: buyability is itself a
 * derived heuristic, so feeding it back in double-counted the same census
 * and structural inputs and let an unverified score inflate this one.
 */
/**
 * Overload: accepts array of practices and returns them with job_opp_score attached.
 */
export function computeJobOpportunityScore(
  practices: Practice[]
): (Practice & { job_opp_score: number })[];
/**
 * Overload: accepts a single practice and returns the score.
 */
export function computeJobOpportunityScore(practice: Practice): number;
export function computeJobOpportunityScore(
  input: Practice | Practice[]
): number | (Practice & { job_opp_score: number })[] {
  if (Array.isArray(input)) {
    return input.map((p) => ({
      ...p,
      job_opp_score: computeJobOpportunityScore(p),
    }));
  }
  const practice = input;
  let score = 0;

  // Ownership points from the census bucket
  const bucket = tierToBucket(practice.ownership_tier);
  if (bucket === "true_solo_owner_operated" || bucket === "dentist_owned_not_solo") {
    score += 30;
  } else if (bucket === "unresolved") {
    score += 10;
  }

  // Structural fields are only verified when a Data Axle enrichment pass
  // touched this row; otherwise they are NPPES self-report — half credit.
  const enriched = practice.data_axle_import_date != null;

  // Employee count
  const emp = practice.employee_count;
  let structural = 0;
  if (emp !== null && emp !== undefined) {
    if (emp >= 10) structural += 20;
    else if (emp >= 5) structural += 10;
  }

  // Year established
  const yr = practice.year_established;
  if (yr !== null && yr !== undefined) {
    if (yr >= 2021) structural += 15;
    else if (yr >= 2016) structural += 8;
  }

  score += enriched ? structural : Math.round(structural / 2);

  return score;
}

/**
 * Determine retirement risk for a practice.
 * Census dentist-owned (T1-T3) + established 30+ years ago.
 * Unresolved locations return false — we never claim retirement risk for a
 * clinic whose ownership hasn't been reviewed (they surface separately as
 * "needs research").
 */
export function isRetirementRisk(practice: Practice): boolean {
  const bucket = tierToBucket(practice.ownership_tier);
  if (bucket !== "true_solo_owner_operated" && bucket !== "dentist_owned_not_solo") {
    return false;
  }

  const yr = practice.year_established;
  if (!yr) return false;

  const currentYear = new Date().getFullYear();
  return currentYear - yr >= 30;
}

/**
 * Compute practice age in years from year_established.
 */
export function getPracticeAge(practice: Practice): number | null {
  if (!practice.year_established) return null;
  return new Date().getFullYear() - practice.year_established;
}
