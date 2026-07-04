'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import { tallyBucketCount, type ZipCensusTally } from '../_lib/zip-census'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'

interface DSOPenetrationTableProps {
  zipScores: ZipScore[]
  watchedZips: WatchedZip[]
  tallies: ZipCensusTally[]
}

export function DSOPenetrationTable({ zipScores, watchedZips, tallies }: DSOPenetrationTableProps) {
  // Build city name lookup from watchedZips
  const wzCityMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const wz of watchedZips) {
      if (wz.city) map.set(wz.zip_code, wz.city)
    }
    return map
  }, [watchedZips])

  const zipScoreMap = useMemo(() => {
    const map = new Map<string, ZipScore>()
    for (const zs of zipScores) map.set(zs.zip_code, zs)
    return map
  }, [zipScores])

  // ZIPs with at least one census-documented DSO/PE location, ranked by the
  // documented floor (reviewed T4+T5 over ALL GP clinics in the ZIP).
  const rows = useMemo(() => {
    return tallies
      .map((tally) => {
        const zs = zipScoreMap.get(tally.zip)
        const universe = zs?.total_gp_locations ?? tally.rows
        const dsoPe = tallyBucketCount(tally, 'dso_pe_corporate')
        return {
          zip: tally.zip,
          city: wzCityMap.get(tally.zip) ?? zs?.city ?? '--',
          gp_locations: universe,
          reviewed: tally.reviewed,
          coverage_pct: universe > 0 ? (tally.reviewed / universe) * 100 : 0,
          dso_pe_count: dsoPe,
          floor_pct: universe > 0 ? (dsoPe / universe) * 100 : 0,
          unresolved: Math.max(universe - tally.reviewed, 0),
        }
      })
      .filter((r) => r.dso_pe_count > 0)
      .sort((a, b) => b.floor_pct - a.floor_pct)
  }, [tallies, zipScoreMap, wzCityMap])

  if (rows.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Census DSO/PE Floor by ZIP"
        helpText="ZIPs with at least one census-documented DSO/PE clinic, ranked by the documented floor: hand-reviewed stealth-DSO (T4) + branded-DSO (T5) locations as a share of ALL GP clinics in the ZIP. A floor by construction — unreviewed clinics contribute nothing, so the Unresolved column is the honest uncertainty. ZIPs absent from this table have no census-documented DSO/PE yet; that is not a claim of independence."
      />
      <div className="mt-4 rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
        <DataTable
          data={rows}
          columns={[
            { key: 'zip', header: 'ZIP' },
            { key: 'city', header: 'City' },
            {
              key: 'gp_locations',
              header: 'GP Locations',
              align: 'right' as const,
              render: (v: number | null) => v != null ? v.toLocaleString() : '--',
            },
            {
              key: 'reviewed',
              header: 'Reviewed',
              align: 'right' as const,
              render: (v: number | null) => v != null ? v.toLocaleString() : '--',
            },
            {
              key: 'coverage_pct',
              header: 'Coverage %',
              align: 'right' as const,
              render: (v: number | null) => v != null ? `${Number(v).toFixed(0)}%` : '--',
            },
            {
              key: 'dso_pe_count',
              header: 'DSO/PE (census)',
              align: 'right' as const,
              render: (v: number | null) => v != null ? v.toLocaleString() : '--',
            },
            {
              key: 'floor_pct',
              header: 'DSO/PE floor %',
              align: 'right' as const,
              render: (v: number | null) => {
                if (v == null) return '--'
                const num = Number(v)
                const color = num >= 30 ? '#C23B3B' : num >= 15 ? '#D4920B' : '#3D3D35'
                return (
                  <span style={{ color, fontWeight: 600 }}>{num.toFixed(1)}%</span>
                )
              },
            },
            {
              key: 'unresolved',
              header: 'Unresolved',
              align: 'right' as const,
              render: (v: number | null) => v != null ? (
                <span style={{ color: '#B8860B' }}>{v.toLocaleString()}</span>
              ) : '--',
            },
          ]}
          defaultSort="floor_pct"
          defaultSortDir="desc"
          csvDownload
          csvFilename="census_dso_pe_floor_by_zip"
          rowKey="zip"
        />
      </div>
    </div>
  )
}
