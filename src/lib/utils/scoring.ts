import type { Practice } from "@/lib/supabase/types";

/**
 * Compute job opportunity score for a practice (0-100).
 * Ported from dashboard/app.py compute_job_opportunity_score().
 *
 * Scoring factors:
 * - Independent status: +30
 * - Unknown status: +10
 * - Buyability >= 70: +25, 50-69: +15
 * - Employees >= 10: +20, 5-9: +10
 * - Established >= 2021: +15, 2016-2020: +8
 */
/**
 * Overload: accepts array of practices and returns them with job_opportunity_score attached.
 */
export function computeJobOpportunityScore(
  practices: Practice[]
): (Practice & { job_opportunity_score: number })[];
/**
 * Overload: accepts a single practice and returns the score.
 */
export function computeJobOpportunityScore(practice: Practice): number;
export function computeJobOpportunityScore(
  input: Practice | Practice[]
): number | (Practice & { job_opportunity_score: number })[] {
  if (Array.isArray(input)) {
    return input.map((p) => ({
      ...p,
      job_opportunity_score: computeJobOpportunityScore(p),
    }));
  }
  const practice = input;
  let score = 0;

  // Ownership status
  const status = (practice.ownership_status ?? "unknown").trim().toLowerCase();
  if (status === "independent" || status === "likely_independent") {
    score += 30;
  } else if (status === "unknown" || status === "") {
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
 * Independent + established 30+ years ago.
 */
export function isRetirementRisk(practice: Practice): boolean {
  const status = (practice.ownership_status ?? "unknown").trim().toLowerCase();
  if (status !== "independent" && status !== "likely_independent") return false;

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
