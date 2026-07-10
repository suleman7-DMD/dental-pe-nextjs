import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAllRowsStable,
  type StablePageResult,
} from '@/lib/supabase/queries/stable-pagination'

interface Row {
  location_id: string
}

function pagesFrom(batches: Row[][]) {
  let call = 0
  return {
    fetchPage: (_from: number, _to: number): Promise<StablePageResult<Row>> => {
      const batch = batches[call] ?? []
      call += 1
      return Promise.resolve({ data: batch, error: null })
    },
    calls: () => call,
  }
}

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ location_id: id }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchAllRowsStable', () => {
  it('concatenates clean pages and stops on a short page', async () => {
    const source = pagesFrom([rows('a', 'b', 'c'), rows('d')])
    const result = await fetchAllRowsStable({
      fetchPage: source.fetchPage,
      keyOf: (r) => r.location_id,
      pageSize: 3,
    })
    expect(result.map((r) => r.location_id)).toEqual(['a', 'b', 'c', 'd'])
    expect(source.calls()).toBe(2)
  })

  it('drops duplicate keys across page boundaries and warns — the P0 bug shape', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Page 2 re-serves 'c' (unstable ORDER BY tie) and skips nothing else.
    const source = pagesFrom([rows('a', 'b', 'c'), rows('c', 'd', 'e'), rows('f')])
    const result = await fetchAllRowsStable({
      fetchPage: source.fetchPage,
      keyOf: (r) => r.location_id,
      pageSize: 3,
      label: 'gp-locations',
    })
    expect(result.map((r) => r.location_id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    // Never silently kept: unique count === returned count.
    expect(new Set(result.map((r) => r.location_id)).size).toBe(result.length)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('gp-locations')
    expect(String(warn.mock.calls[0][0])).toContain('1 duplicate')
  })

  it('does not warn when every page is unique', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const source = pagesFrom([rows('a', 'b'), rows('c')])
    await fetchAllRowsStable({
      fetchPage: source.fetchPage,
      keyOf: (r) => r.location_id,
      pageSize: 2,
    })
    expect(warn).not.toHaveBeenCalled()
  })

  it('respects maxRows and stops paging once reached', async () => {
    const source = pagesFrom([rows('a', 'b'), rows('c', 'd'), rows('e', 'f')])
    const result = await fetchAllRowsStable({
      fetchPage: source.fetchPage,
      keyOf: (r) => r.location_id,
      pageSize: 2,
      maxRows: 3,
    })
    expect(result.map((r) => r.location_id)).toEqual(['a', 'b', 'c'])
    expect(source.calls()).toBe(2)
  })

  it('throws on a page error instead of returning partial data', async () => {
    await expect(
      fetchAllRowsStable<Row>({
        fetchPage: () => Promise.resolve({ data: null, error: new Error('boom') }),
        keyOf: (r) => r.location_id,
      })
    ).rejects.toThrow('boom')
  })
})
