'use client'

import { useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'

interface DSOPenetrationTableProps {
  zipScores: ZipScore[]
  watchedZips: WatchedZip[]
}

export function DSOPenetrationTable({ zipScores, watchedZips }: DSOPenetrationTableProps) {
  // Build city name lookup from watchedZips
  const wzCityMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const wz of watchedZips) {
      if (wz.city) map.set(wz.zip_code, wz.city)
    }
    return map
  }, [watchedZips])

  // Build DSO penetration rows from zip_scores — only ZIPs with corporate_share_pct > 0
  const dsoPenetration = useMemo(() => {
    if (!zipScores || zipScores.length === 0) return []
    return [...zipScores]
      .filter((zs) => zs.corporate_share_pct != null && zs.corporate_share_pct > 0)
      .sort((a, b) => (b.corporate_share_pct ?? 0) - (a.corporate_share_pct ?? 0))
      .map((zs) => ({
        zip: zs.zip_code,
        city: wzCityMap.get(zs.zip_code) ?? zs.city ?? '--',
        practices: zs.total_gp_locations ?? 0,
        corporate_share_pct: (zs.corporate_share_pct ?? 0) * 100,
      }))
  }, [zipScores, wzCityMap])

  if (dsoPenetration.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="DSO Penetration by ZIP"
        helpText="ZIP codes ranked by corporate share percentage. Corporate share = percentage of GP office locations classified as DSO-affiliated (dso_regional or dso_national). City names from watched ZIP records."
      />
      <div className="mt-4 rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
        <DataTable
          data={dsoPenetration}
          columns={[
            { key: 'zip', header: 'ZIP' },
            { key: 'city', header: 'City' },
            {
              key: 'practices',
              header: 'GP Locations',
              align: 'right' as const,
              render: (v: number | null) => v != null ? v.toLocaleString() : '--',
            },
            {
              key: 'corporate_share_pct',
              header: 'Corporate Share %',
              align: 'right' as const,
              render: (v: number | null) => {
                if (v == null) return '--'
                const num = Number(v)
                const color = num >= 30 ? '#C23B3B' : num >= 15 ? '#D4920B' : '#2D8B4E'
                return (
                  <span style={{ color, fontWeight: 600 }}>{num.toFixed(1)}%</span>
                )
              },
            },
          ]}
          defaultSort="corporate_share_pct"
          defaultSortDir="desc"
          csvDownload
          csvFilename="dso_penetration_by_zip"
          rowKey="zip"
        />
      </div>
    </div>
  )
}
