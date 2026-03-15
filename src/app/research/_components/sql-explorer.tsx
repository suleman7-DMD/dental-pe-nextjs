'use client'

import { useState, useCallback } from 'react'
import { Play, Download, AlertTriangle } from 'lucide-react'
import { SQL_PRESETS_ROW1, SQL_PRESETS_ROW2 } from '@/lib/constants/sql-presets'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function SqlExplorer() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const executeQuery = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      setError('Enter a query first.')
      return
    }

    if (!q.toUpperCase().startsWith('SELECT')) {
      setError('Only SELECT queries are allowed for safety.')
      return
    }

    const forbidden = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC']
    const upper = q.toUpperCase()
    for (const kw of forbidden) {
      if (upper.includes(kw)) {
        setError(`Query contains forbidden keyword: ${kw}. Only SELECT queries are allowed.`)
        return
      }
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/sql-explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Query execution failed.')
        return
      }

      setResult(data)
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [query])

  const handlePreset = useCallback((presetQuery: string) => {
    setQuery(presetQuery)
    setError(null)
    setResult(null)
  }, [])

  const handleDownload = useCallback(() => {
    if (!result) return
    const csv = [
      result.columns.join(','),
      ...result.rows.map((row) =>
        result.columns.map((col) => {
          const val = row[col]
          return `"${String(val ?? '').replace(/"/g, '""')}"`
        }).join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-sm text-[#94A3B8]">
        <span className="text-[#F8FAFC] font-medium">SQL Explorer</span> -- query the database
        directly. Tables available: deals, practices, watched_zips, practice_changes, dso_locations,
        zip_scores, ada_hpi_benchmarks. Only SELECT queries are allowed. Click preset buttons for
        example queries.
      </p>

      {/* Preset buttons - Row 1 */}
      <div className="flex flex-wrap gap-2">
        {SQL_PRESETS_ROW1.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset.query)}
            className="rounded-md border border-[#1E293B] bg-[#0F1629] px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334155] transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Preset buttons - Row 2 */}
      <div className="flex flex-wrap gap-2">
        {SQL_PRESETS_ROW2.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset.query)}
            className="rounded-md border border-[#1E293B] bg-[#0F1629] px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334155] transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Query input */}
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter SQL SELECT query..."
        className="w-full h-[150px] rounded-md border border-[#1E293B] bg-[#0F1629] text-[#F8FAFC] px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#3B82F6] placeholder:text-[#475569]"
      />

      {/* Execute button */}
      <div className="flex items-center gap-3">
        <button
          onClick={executeQuery}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Execute
        </button>

        {result && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#0F1629] px-3 py-2 text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334155] transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Success message */}
      {result && (
        <div className="text-sm text-green-400">
          {result.rowCount.toLocaleString()} rows returned
        </div>
      )}

      {/* Results table */}
      {result && result.rows.length > 0 && (
        <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0F1629]">
                <tr className="border-b border-[#1E293B] text-[#94A3B8]">
                  {result.columns.map((col) => (
                    <th key={col} className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/20"
                  >
                    {result.columns.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-2 text-[#F8FAFC] max-w-[300px] truncate text-xs"
                        title={String(row[col] ?? '')}
                      >
                        {row[col] != null ? String(row[col]) : '--'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-[#1E293B] text-xs text-[#94A3B8]">
            {result.rowCount.toLocaleString()} rows
          </div>
        </div>
      )}
    </div>
  )
}
