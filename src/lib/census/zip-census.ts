/**
 * zip-census.ts — per-ZIP census ownership tallies.
 *
 * Pages (/market-intel, /warroom) aggregate census truth by ZIP and ship ONLY
 * these compact tallies to the client (never detector fields, never full rows).
 * Bucket/tier semantics come exclusively from the ownership-truth contract —
 * this module counts; it never re-interprets `ownership_tier`.
 */

import {
  HEADLINE_BUCKETS,
  OWNERSHIP_TIERS,
  deriveSourceClass,
  tierToBucket,
  type BucketSummary,
  type HeadlineBucket,
  type OwnershipTier,
} from '@/lib/census/ownership-truth'

/** Minimal row shape needed to tally census truth by ZIP. */
export interface ZipCensusSourceRow {
  zip: string | null
  ownership_tier: string | null
  pe_backed: boolean | null
  census_review_status: string | null
}

export interface ZipCensusTally {
  zip: string
  /** Tracked GP location rows in this ZIP (practice_locations, GP scope). */
  rows: number
  /** Rows with a hand-reviewed ownership_tier (census conclusions). */
  reviewed: number
  /** Census-confirmed PE backing among reviewed rows. */
  peBacked: number
  /** Reviewed-but-held rows — inside Unresolved, never a conclusion. */
  held: number
  /** Researched-but-undetermined rows — inside Unresolved. */
  undetermined: number
  /** Reviewed rows per census tier. */
  tiers: Record<OwnershipTier, number>
}

function emptyTiers(): Record<OwnershipTier, number> {
  const tiers = {} as Record<OwnershipTier, number>
  for (const tier of OWNERSHIP_TIERS) tiers[tier] = 0
  return tiers
}

function narrowReviewStatus(value: string | null): 'held' | 'undetermined' | null {
  return value === 'held' || value === 'undetermined' ? value : null
}

export function buildZipCensusTallies(rows: ZipCensusSourceRow[]): ZipCensusTally[] {
  const byZip = new Map<string, ZipCensusTally>()

  for (const row of rows) {
    const zip = row.zip?.trim()
    if (!zip) continue
    let tally = byZip.get(zip)
    if (!tally) {
      tally = { zip, rows: 0, reviewed: 0, peBacked: 0, held: 0, undetermined: 0, tiers: emptyTiers() }
      byZip.set(zip, tally)
    }

    tally.rows += 1
    const sourceClass = deriveSourceClass(row.ownership_tier, narrowReviewStatus(row.census_review_status))
    if (sourceClass === 'census_reviewed') {
      tally.reviewed += 1
      tally.tiers[row.ownership_tier as OwnershipTier] += 1
      if (row.pe_backed === true) tally.peBacked += 1
    } else if (sourceClass === 'held') {
      tally.held += 1
    } else if (sourceClass === 'undetermined') {
      tally.undetermined += 1
    }
  }

  return Array.from(byZip.values()).sort((a, b) => a.zip.localeCompare(b.zip))
}

/** Sum reviewed rows in a tally that belong to a given headline bucket. */
export function tallyBucketCount(tally: ZipCensusTally, bucket: HeadlineBucket): number {
  let count = 0
  for (const tier of OWNERSHIP_TIERS) {
    if (tierToBucket(tier) === bucket) count += tally.tiers[tier]
  }
  return count
}

/** Per-tier totals across a set of tallies (for the tier breakdown view). */
export function sumTierCounts(tallies: ZipCensusTally[]): Record<OwnershipTier, number> {
  const totals = emptyTiers()
  for (const tally of tallies) {
    for (const tier of OWNERSHIP_TIERS) totals[tier] += tally.tiers[tier]
  }
  return totals
}

/**
 * Build the contract-shaped five-bucket summary from tallies + the scope's
 * live GP universe. Mirrors `summarizeBuckets` exactly (same fields, same
 * denominators); bucket membership still comes from `tierToBucket`.
 */
export function summarizeTallies(tallies: ZipCensusTally[], universe: number): BucketSummary {
  const counts: Record<HeadlineBucket, number> = {
    true_solo_owner_operated: 0,
    dentist_owned_not_solo: 0,
    dso_pe_corporate: 0,
    institutional: 0,
    unresolved: 0,
  }
  let reviewed = 0
  let peBacked = 0

  for (const tally of tallies) {
    reviewed += tally.reviewed
    peBacked += tally.peBacked
    for (const tier of OWNERSHIP_TIERS) {
      counts[tierToBucket(tier)] += tally.tiers[tier]
    }
  }

  counts.unresolved = Math.max(universe - reviewed, 0)

  const pct = (numerator: number, denominator: number) =>
    denominator > 0 ? (numerator / denominator) * 100 : 0

  const pctOfUniverse = {} as Record<HeadlineBucket, number>
  const pctOfReviewed = {} as Record<HeadlineBucket, number>
  for (const bucket of HEADLINE_BUCKETS) {
    pctOfUniverse[bucket] = pct(counts[bucket], universe)
    pctOfReviewed[bucket] = bucket === 'unresolved' ? 0 : pct(counts[bucket], reviewed)
  }

  return {
    universe,
    reviewed,
    coveragePct: pct(reviewed, universe),
    counts,
    pctOfUniverse,
    pctOfReviewed,
    peBacked,
    notSoloOwnerOperatedPctOfReviewed: pct(reviewed - counts.true_solo_owner_operated, reviewed),
    dsoPePctOfReviewed: pct(counts.dso_pe_corporate, reviewed),
    dsoPePctOfUniverse: pct(counts.dso_pe_corporate, universe),
  }
}

export interface SourceClassCounts {
  censusReviewed: number
  held: number
  undetermined: number
  /** universe − reviewed − held − undetermined, clamped at 0. */
  notYetReviewed: number
}

/** Source-class ledger for a scope: who answered, who's open, who's untouched. */
export function countSourceClasses(tallies: ZipCensusTally[], universe: number): SourceClassCounts {
  let censusReviewed = 0
  let held = 0
  let undetermined = 0
  for (const tally of tallies) {
    censusReviewed += tally.reviewed
    held += tally.held
    undetermined += tally.undetermined
  }
  return {
    censusReviewed,
    held,
    undetermined,
    notYetReviewed: Math.max(universe - censusReviewed - held - undetermined, 0),
  }
}
