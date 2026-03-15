'use client'

import { useState, useEffect } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { DataTable } from '@/components/data-display/data-table'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { PracticeChange } from '@/lib/supabase/queries/practice-changes'

interface RecentChangesProps {
  zipList: string[]
}

export function RecentChanges({ zipList }: RecentChangesProps) {
  const [changes, setChanges] = useState<PracticeChange[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (zipList.length === 0 || loaded) return
    setLoading(true)

    const fetchChanges = async () => {
      const supabase = createBrowserClient()

      // Fetch recent practice_changes
      const { data: rawChanges } = await supabase
        .from('practice_changes')
        .select('change_date, field_changed, old_value, new_value, change_type, npi')
        .order('change_date', { ascending: false })
        .limit(200)

      if (!rawChanges || rawChanges.length === 0) {
        setLoaded(true)
        setLoading(false)
        return
      }

      // Get unique NPIs
      const npis = [...new Set(rawChanges.map(c => c.npi))]

      // Fetch practice info for those NPIs that are in our watched ZIPs
      const chunkSize = 500
      const practiceMap = new Map<string, { practice_name: string | null; city: string | null; zip: string | null }>()

      for (let i = 0; i < npis.length; i += chunkSize) {
        const chunk = npis.slice(i, i + chunkSize)
        const { data: practices } = await supabase
          .from('practices')
          .select('npi, practice_name, city, zip')
          .in('npi', chunk)
          .in('zip', zipList)

        if (practices) {
          for (const p of practices) {
            practiceMap.set(p.npi, p)
          }
        }
      }

      const zipSet = new Set(zipList)
      const results: PracticeChange[] = []

      for (const c of rawChanges) {
        const p = practiceMap.get(c.npi)
        if (p && p.zip && zipSet.has(p.zip)) {
          results.push({
            change_date: c.change_date,
            practice_name: p.practice_name,
            city: p.city,
            zip: p.zip,
            field_changed: c.field_changed,
            old_value: c.old_value,
            new_value: c.new_value,
            change_type: c.change_type,
          })
        }
        if (results.length >= 50) break
      }

      setChanges(results)
      setLoaded(true)
      setLoading(false)
    }

    fetchChanges()
  }, [zipList, loaded])

  // Reset loaded state when zipList changes
  useEffect(() => {
    setLoaded(false)
    setChanges([])
  }, [zipList])

  const columns = [
    {
      key: 'change_date',
      header: 'Date',
      render: (row: Record<string, unknown>) => formatDate(row.change_date as string | null),
    },
    { key: 'practice_name', header: 'Practice' },
    { key: 'city', header: 'City' },
    { key: 'zip', header: 'ZIP' },
    { key: 'field_changed', header: 'Field Changed' },
    {
      key: 'old_value',
      header: 'Old Value',
      render: (row: Record<string, unknown>) => {
        const v = row.old_value as string | null
        return v ? (
          <span className="text-[#EF4444]">{v}</span>
        ) : '\u2014'
      },
    },
    {
      key: 'new_value',
      header: 'New Value',
      render: (row: Record<string, unknown>) => {
        const v = row.new_value as string | null
        return v ? (
          <span className="text-[#22C55E]">{v}</span>
        ) : '\u2014'
      },
    },
    { key: 'change_type', header: 'Type' },
  ]

  return (
    <div>
      <SectionHeader
        title="Recent Practice Changes"
        helpText="Detected ownership changes in your watched ZIPs -- when a practice switches from independent to DSO, gets a new name, or changes status. Automatically detected by comparing NPPES data snapshots."
      />
      <div className="mt-4">
        {loading ? (
          <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8] text-sm animate-pulse">
            Loading practice changes...
          </div>
        ) : (
          <DataTable
            data={changes as unknown as Record<string, unknown>[]}
            columns={columns}
            defaultSort="change_date"
            defaultSortDir="desc"
            emptyMessage="No practice changes detected yet in these ZIPs. Changes appear when NPPES data is refreshed monthly."
            rowKey={(row, i) => `${row.change_date}-${row.practice_name}-${i}`}
          />
        )}
      </div>
    </div>
  )
}
