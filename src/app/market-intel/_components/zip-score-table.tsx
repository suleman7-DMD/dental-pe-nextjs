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
  gp_locations: number
  corporate_count: number
  independent_count: number
  consolidation_pct: number
  independent_pct: number
  unknown_pct: number
  confidence: string
  opportunity_score: number
  market_type: string
}

export function ZipScoreTable({ zipScores }: ZipScoreTableProps) {
  // Compute derived fields from zip_scores data.
  // Primary data source: saturation metric columns (corporate_share_pct, total_gp_locations,
  // metrics_confidence, opportunity_score). Falls back to legacy count columns only when
  // saturation metrics are unavailable.
  const rows = useMemo((): ZipScoreRow[] => {
    return zipScores.map(z => {
      // Total practices — prefer total_practices, fall back to sum of GP + specialist locations
      const total = z.total_practices ?? ((z.total_gp_locations ?? 0) + (z.total_specialist_locations ?? 0))
      const gpLoc = z.total_gp_locations ?? total

      // Corporate count from saturation metrics (entity_classification-based)
      const corporateFromSaturation = z.corporate_share_pct != null && z.total_gp_locations != null
        ? Math.round(z.corporate_share_pct * z.total_gp_locations)
        : null
      // Legacy fallback
      const corporateFromLegacy = (z.dso_affiliated_count ?? 0) + (z.pe_backed_count ?? 0)
      const corporateCount = corporateFromSaturation ?? corporateFromLegacy

      // Independent count — use legacy if available, otherwise estimate from GP locations minus corporate
      const indepCount = z.independent_count != null && z.independent_count > 0
        ? z.independent_count
        : Math.max(0, gpLoc - corporateCount)

      // Consolidation % — use corporate_share_pct directly (already a 0-1 fraction)
      const consolPct = z.corporate_share_pct != null
        ? z.corporate_share_pct * 100
        : total > 0
          ? (corporateCount / total) * 100
          : 0

      // Independent % — compute from total minus corporate and specialists
      const specialistCount = z.total_specialist_locations ?? 0
      const nonClinicalEtc = total - corporateCount - indepCount - specialistCount
      const indepPct = total > 0 ? (indepCount / total) * 100 : 0
      // Unknown/other % (specialist + non-clinical + unclassified)
      const unkPct = total > 0 ? (Math.max(0, nonClinicalEtc + specialistCount) / total) * 100 : 0

      // Opportunity score — use DB value directly
      const oppScore = z.opportunity_score ?? 0

      // Confidence — use metrics_confidence from saturation metrics
      const confidence = z.metrics_confidence ?? z.data_confidence ?? ''

      // Market type
      const marketType = z.market_type ?? ''

      return {
        zip_code: z.zip_code,
        city: z.city ?? '\u2014',
        total_practices: total,
        gp_locations: gpLoc,
        corporate_count: corporateCount,
        independent_count: indepCount,
        consolidation_pct: consolPct,
        independent_pct: indepPct,
        unknown_pct: unkPct,
        confidence,
        opportunity_score: oppScore,
        market_type: marketType,
      }
    })
  }, [zipScores])

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
      key: 'gp_locations',
      header: 'GP Locations',
      align: 'right' as const,
    },
    {
      key: 'corporate_count',
      header: 'Corporate',
      align: 'right' as const,
    },
    {
      key: 'independent_count',
      header: 'Independent',
      align: 'right' as const,
    },
    {
      key: 'consolidation_pct',
      header: 'Known Consol. %',
      align: 'right' as const,
      render: (v: unknown) => {
        if (typeof v === 'number') return `${v.toFixed(1)}%`
        return '\u2014'
      },
    },
    {
      key: 'independent_pct',
      header: 'Indep. %',
      align: 'right' as const,
      render: (v: unknown) => {
        if (typeof v === 'number') return `${v.toFixed(1)}%`
        return '\u2014'
      },
    },
    {
      key: 'unknown_pct',
      header: '% Other',
      align: 'right' as const,
      render: (v: unknown) => {
        if (typeof v === 'number') return `${v.toFixed(1)}%`
        return '\u2014'
      },
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (v: unknown) => {
        const str = typeof v === 'string' ? v : ''
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
        return '\u2014'
      },
    },
    {
      key: 'market_type',
      header: 'Market Type',
      render: (v: unknown) => {
        const str = typeof v === 'string' ? v : ''
        if (!str) return '\u2014'
        return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      },
    },
  ]

  return (
    <div>
      <SectionHeader
        title="ZIP Code Consolidation Detail"
        helpText="Each row = one ZIP code. Consolidation % = corporate_share_pct from entity_classification-based saturation metrics. Confidence = metrics_confidence (high/medium/low). Opportunity Score from pipeline."
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
