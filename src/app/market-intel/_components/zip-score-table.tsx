'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import { BUCKET_META } from '@/lib/census/ownership-truth'
import { tallyBucketCount, type ZipCensusTally } from '@/lib/census/zip-census'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

interface ZipScoreTableProps {
  zipScores: ZipScore[]
  tallies: ZipCensusTally[]
}

interface ZipCensusRow {
  zip_code: string
  city: string
  gp_locations: number
  reviewed: number
  coverage_pct: number
  solo_owner: number
  dentist_owned: number
  dso_pe: number
  institutional: number
  unresolved: number
  opportunity_score: number | null
  market_type: string
}

// Colored count cell: bucket color when the census has documented at least
// one location, muted otherwise so zeros don't read as claims.
function bucketCell(color: string) {
  return (v: unknown) => {
    if (typeof v !== 'number') return '—'
    if (v === 0) return <span style={{ color: '#9C9C90' }}>0</span>
    return <span style={{ color, fontWeight: 600 }}>{v.toLocaleString()}</span>
  }
}

export function ZipScoreTable({ zipScores, tallies }: ZipScoreTableProps) {
  const tallyByZip = useMemo(() => {
    const map = new Map<string, ZipCensusTally>()
    for (const t of tallies) map.set(t.zip, t)
    return map
  }, [tallies])

  // One row per scored ZIP: census bucket counts of hand-reviewed clinics,
  // with the ZIP's full GP-clinic universe as the denominator so Unresolved
  // is always explicit.
  const rows = useMemo((): ZipCensusRow[] => {
    return zipScores.map((zs) => {
      const tally = tallyByZip.get(zs.zip_code)
      const universe = zs.total_gp_locations ?? tally?.rows ?? 0
      const reviewed = tally?.reviewed ?? 0
      return {
        zip_code: zs.zip_code,
        city: zs.city ?? '—',
        gp_locations: universe,
        reviewed,
        coverage_pct: universe > 0 ? (reviewed / universe) * 100 : 0,
        solo_owner: tally ? tallyBucketCount(tally, 'true_solo_owner_operated') : 0,
        dentist_owned: tally ? tallyBucketCount(tally, 'dentist_owned_not_solo') : 0,
        dso_pe: tally ? tallyBucketCount(tally, 'dso_pe_corporate') : 0,
        institutional: tally ? tallyBucketCount(tally, 'institutional') : 0,
        unresolved: Math.max(universe - reviewed, 0),
        opportunity_score: zs.opportunity_score ?? null,
        market_type: zs.market_type ?? '',
      }
    })
  }, [zipScores, tallyByZip])

  if (zipScores.length === 0) return null

  const columns = [
    { key: 'zip_code', header: 'ZIP' },
    { key: 'city', header: 'City' },
    {
      key: 'gp_locations',
      header: 'GP Locations',
      align: 'right' as const,
      render: (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '—'),
    },
    {
      key: 'reviewed',
      header: 'Reviewed',
      align: 'right' as const,
      render: bucketCell('#2D8B4E'),
    },
    {
      key: 'coverage_pct',
      header: 'Coverage %',
      align: 'right' as const,
      render: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(0)}%` : '—'),
    },
    {
      key: 'solo_owner',
      header: BUCKET_META.true_solo_owner_operated.label,
      align: 'right' as const,
      render: bucketCell(BUCKET_META.true_solo_owner_operated.color),
    },
    {
      key: 'dentist_owned',
      header: BUCKET_META.dentist_owned_not_solo.label,
      align: 'right' as const,
      render: bucketCell(BUCKET_META.dentist_owned_not_solo.color),
    },
    {
      key: 'dso_pe',
      header: BUCKET_META.dso_pe_corporate.label,
      align: 'right' as const,
      render: bucketCell(BUCKET_META.dso_pe_corporate.color),
    },
    {
      key: 'institutional',
      header: BUCKET_META.institutional.label,
      align: 'right' as const,
      render: bucketCell(BUCKET_META.institutional.color),
    },
    {
      key: 'unresolved',
      header: BUCKET_META.unresolved.label,
      align: 'right' as const,
      render: (v: unknown) =>
        typeof v === 'number' ? (
          <span style={{ color: BUCKET_META.unresolved.color }}>{v.toLocaleString()}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'opportunity_score',
      header: 'Older Opp. Score',
      align: 'right' as const,
      render: (v: unknown) =>
        typeof v === 'number' ? <span style={{ color: '#9C9C90' }}>{String(v)}</span> : '—',
    },
    {
      key: 'market_type',
      header: 'Market Type',
      render: (v: unknown) => {
        const str = typeof v === 'string' ? v : ''
        if (!str) return '—'
        return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      },
    },
  ]

  return (
    <div>
      <SectionHeader
        title="ZIP Census Detail"
        helpText="Each row = one watched ZIP. Ownership columns count hand-reviewed conclusions only: True Independent (solo owner-operated), Dentist-Owned Group, DSO / PE, and Institutional. Needs Ownership Answer = GP clinics without a final ownership answer, shown explicitly and never filled with estimates. Older Opp. Score and Market Type come from the older automated pipeline, kept for triage convenience; they are not ownership claims."
      />
      <div className="mt-4">
        <DataTable
          data={rows as unknown as Record<string, unknown>[]}
          columns={columns}
          defaultSort="gp_locations"
          defaultSortDir="desc"
          csvDownload
          csvFilename="census_zip_detail"
          rowKey={(row) => String(row.zip_code)}
        />
      </div>
    </div>
  )
}
