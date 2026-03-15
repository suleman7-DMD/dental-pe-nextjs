'use client'

import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

interface ZipScoreTableProps {
  zipScores: ZipScore[]
}

export function ZipScoreTable({ zipScores }: ZipScoreTableProps) {
  if (zipScores.length === 0) return null

  const columns = [
    { key: 'zip_code', header: 'ZIP' },
    { key: 'city', header: 'City' },
    {
      key: 'total_practices',
      header: 'Total',
      align: 'right' as const,
    },
    {
      key: 'independent_count',
      header: 'Independent',
      align: 'right' as const,
    },
    {
      key: 'dso_affiliated_count',
      header: 'DSO',
      align: 'right' as const,
    },
    {
      key: 'pe_backed_count',
      header: 'PE',
      align: 'right' as const,
    },
    {
      key: 'unknown_count',
      header: 'Unknown',
      align: 'right' as const,
    },
    {
      key: 'consolidation_pct_of_total',
      header: 'Known Consol. %',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = row.consolidation_pct_of_total as number | null
        if (v == null) return '\u2014'
        return `${v.toFixed(1)}%`
      },
    },
    {
      key: 'independent_pct_of_total',
      header: 'Indep. %',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = row.independent_pct_of_total as number | null
        if (v == null) return '\u2014'
        return `${v.toFixed(1)}%`
      },
    },
    {
      key: 'pct_unknown',
      header: '% Unknown',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = row.pct_unknown as number | null
        if (v == null) return '\u2014'
        return `${v.toFixed(1)}%`
      },
    },
    {
      key: 'data_confidence',
      header: 'Confidence',
      render: (row: Record<string, unknown>) => {
        const v = row.data_confidence as string | null
        if (!v) return '\u2014'
        return v.charAt(0).toUpperCase() + v.slice(1)
      },
    },
    {
      key: 'opportunity_score',
      header: 'Opp. Score',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = row.opportunity_score as number | null
        if (v == null) return '\u2014'
        return v.toFixed(0)
      },
    },
  ]

  return (
    <div>
      <SectionHeader
        title="ZIP Code Consolidation Detail"
        helpText="Each row = one ZIP code. Consolidation % = (DSO + PE) / total practices (conservative -- treats unknowns as not consolidated). Opportunity Score = higher means more independent practices."
      />
      <div className="mt-4">
        <DataTable
          data={zipScores as unknown as Record<string, unknown>[]}
          columns={columns}
          defaultSort="opportunity_score"
          defaultSortDir="desc"
          csvDownload
          csvFilename="zip_scores"
          rowKey={(row) => String(row.zip_code)}
        />
      </div>
    </div>
  )
}
