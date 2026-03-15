'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

interface ZipScoreTableProps {
  zipScores: ZipScore[]
}

interface ZipScoreRow {
  zip_code: string
  city: string
  total_practices: number
  independent_count: number
  dso_count: number
  pe_count: number
  unknown_count: number
  consolidation_pct: number
  independent_pct: number
  unknown_pct: number
  confidence: string
  opportunity_score: number
}

export function ZipScoreTable({ zipScores }: ZipScoreTableProps) {
  if (zipScores.length === 0) return null

  // Compute derived fields from zip_scores data
  const rows = useMemo((): ZipScoreRow[] => {
    return zipScores.map(z => {
      const total = z.total_practices ?? 0
      const dso = z.dso_affiliated_count ?? 0
      const pe = z.pe_backed_count ?? 0
      const indep = z.independent_count ?? 0
      const unk = z.unknown_count ?? 0

      // Use corporate_share_pct if available (entity_classification-based, more accurate)
      const corporateFromSaturation = z.corporate_share_pct != null && z.total_gp_locations != null
        ? Math.round(z.corporate_share_pct * z.total_gp_locations)
        : null

      const consolidatedCount = corporateFromSaturation ?? (dso + pe)
      const consolPct = total > 0 ? (consolidatedCount / total) * 100 : 0
      const indepPct = total > 0 ? (indep / total) * 100 : 0
      const unkPct = total > 0 ? (unk / total) * 100 : 0

      // Opportunity score: use DB value when available, otherwise compute locally
      const oppScore = z.opportunity_score != null
        ? z.opportunity_score
        : total > 0
          ? Math.round(indepPct - consolPct + (z.buyable_practice_ratio != null ? z.buyable_practice_ratio * 50 : 0))
          : 0

      return {
        zip_code: z.zip_code,
        city: z.city ?? '\u2014',
        total_practices: total,
        independent_count: indep,
        dso_count: dso,
        pe_count: pe,
        unknown_count: unk,
        consolidation_pct: consolPct,
        independent_pct: indepPct,
        unknown_pct: unkPct,
        confidence: z.metrics_confidence ?? '',
        opportunity_score: oppScore,
      }
    })
  }, [zipScores])

  // Format a percentage value — accepts cell value (number) or full row object
  const fmtPct = (v: unknown, field: string): string => {
    if (typeof v === 'number') return `${v.toFixed(1)}%`
    if (v != null && typeof v === 'object' && field in (v as Record<string, unknown>)) {
      const n = (v as Record<string, unknown>)[field]
      if (typeof n === 'number') return `${n.toFixed(1)}%`
    }
    return '\u2014'
  }

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
      key: 'dso_count',
      header: 'DSO',
      align: 'right' as const,
    },
    {
      key: 'pe_count',
      header: 'PE',
      align: 'right' as const,
    },
    {
      key: 'unknown_count',
      header: 'Unknown',
      align: 'right' as const,
    },
    {
      key: 'consolidation_pct',
      header: 'Known Consol. %',
      align: 'right' as const,
      render: (v: unknown) => fmtPct(v, 'consolidation_pct'),
    },
    {
      key: 'independent_pct',
      header: 'Indep. %',
      align: 'right' as const,
      render: (v: unknown) => fmtPct(v, 'independent_pct'),
    },
    {
      key: 'unknown_pct',
      header: '% Unknown',
      align: 'right' as const,
      render: (v: unknown) => fmtPct(v, 'unknown_pct'),
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (v: unknown) => {
        const str = typeof v === 'string' ? v
          : (v != null && typeof v === 'object') ? String((v as Record<string, unknown>).confidence ?? '')
          : ''
        if (!str) return '\u2014'
        return str.charAt(0).toUpperCase() + str.slice(1)
      },
    },
    {
      key: 'opportunity_score',
      header: 'Opp. Score',
      align: 'right' as const,
      render: (v: unknown) => {
        if (typeof v === 'number') return String(v)
        if (v != null && typeof v === 'object') {
          const n = (v as Record<string, unknown>).opportunity_score
          if (typeof n === 'number') return String(n)
        }
        return '\u2014'
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
          data={rows as unknown as Record<string, unknown>[]}
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
