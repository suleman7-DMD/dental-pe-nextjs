import type { Practice } from "@/lib/types";
import { tierToBucket } from "@/lib/census/ownership-truth";

/**
 * Compute job opportunity score for a practice (0-100).
 *
 * Ownership points come ONLY from the hand-reviewed census truth layer
 * (ownership_tier → headline bucket). Never from the legacy detector.
 *
 * Scoring factors:
 * - Census dentist-owned (solo owner-op T1, or dentist group/network T2-T3): +30
 * - Census unresolved (no reviewed conclusion yet): +10 — a capped
 *   "needs research" contribution, never treated as verified independence
 * - Census DSO/PE/corporate (T4-T5) or institutional (T6): +0
 * - Buyability >= 70: +25, 50-69: +15 (legacy heuristic input — stays until
 *   the census-based buyability reframe ships; see purge list /buyability)
 * - Employees >= 10: +20, 5-9: +10
 * - Established >= 2021: +15, 2016-2020: +8
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

  // Buyability score
  const buy = practice.buyability_score;
  if (buy !== null && buy !== undefined) {
    if (buy >= 70) score += 25;
    else if (buy >= 50) score += 15;
  }

  // Employee count
  const emp = practice.employee_count;
  if (emp !== null && emp !== undefined) {
    if (emp >= 10) score += 20;
    else if (emp >= 5) score += 10;
  }

  // Year established
  const yr = practice.year_established;
  if (yr !== null && yr !== undefined) {
    if (yr >= 2021) score += 15;
    else if (yr >= 2016) score += 8;
  }

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
