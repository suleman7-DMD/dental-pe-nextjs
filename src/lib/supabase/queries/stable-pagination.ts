// Stable pagination over PostgREST .range() reads.
//
// Postgres guarantees no row order within ORDER BY ties, so paginating a
// query sorted only by a non-unique column (buyability_score, practice_name,
// change_date, ...) lets consecutive pages repeat some rows and skip others.
// Observed live: an all-Chicagoland GP fetch returned 4,439 rows but only
// 3,597 unique location_ids, which inflated every downstream coverage count.
//
// Rule: every paginated query MUST end its ORDER BY chain with a unique
// column — usually the table's primary key (location_id, id, npi, zip_code).
//
// This helper is the second line of defense: rows are deduped by `keyOf`
// while paging, so a missing tie-breaker or a concurrent insert/delete that
// shifts page boundaries can never double-count a row. Duplicates are
// dropped and logged, never silently kept.

export interface StablePageResult<T> {
  data: T[] | null
  error: unknown
}

export interface FetchAllRowsStableOptions<T> {
  /**
   * Runs one page [from, to]. The underlying query must chain a unique
   * total ORDER BY before .range().
   */
  fetchPage: (from: number, to: number) => PromiseLike<StablePageResult<T>>
  /** Unique identity per row — the primary key. */
  keyOf: (row: T) => string
  pageSize?: number
  maxRows?: number
  /** Query name used in the duplicate warning log. */
  label?: string
}

export async function fetchAllRowsStable<T>(
  options: FetchAllRowsStableOptions<T>
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000
  const rows: T[] = []
  const seen = new Set<string>()
  let duplicates = 0
  let page = 0

  while (options.maxRows == null || rows.length < options.maxRows) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await options.fetchPage(from, to)
    if (error) throw error

    const batch = data ?? []
    for (const row of batch) {
      const key = options.keyOf(row)
      if (seen.has(key)) {
        duplicates += 1
        continue
      }
      seen.add(key)
      rows.push(row)
    }
    if (batch.length < pageSize) break
    page += 1
  }

  if (duplicates > 0) {
    console.warn(
      `[stable-pagination] ${options.label ?? "query"}: dropped ${duplicates} duplicate row(s) across pages — ` +
        "the ORDER BY is not a unique total order, or rows moved during pagination."
    )
  }

  return options.maxRows != null && rows.length > options.maxRows
    ? rows.slice(0, options.maxRows)
    : rows
}
