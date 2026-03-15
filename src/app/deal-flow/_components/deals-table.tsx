'use client'

import { useState, useMemo } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { SearchInput } from '@/components/filters/search-input'
import { DataTable } from '@/components/data-display/data-table'
import { formatDate } from '@/lib/utils'
import { formatDealType } from '@/lib/constants/deal-type-colors'
import { ownershipColor } from '@/lib/constants/design-tokens'
import type { Deal } from '@/lib/supabase/queries/deals'

interface DealsTableProps {
  deals: Deal[]
}

const DEAL_TYPE_TAG_COLORS: Record<string, string> = {
  buyout: 'bg-[#0066FF]/20 text-[#66B2FF]',
  'add-on': 'bg-[#00C853]/20 text-[#66FF99]',
  recapitalization: 'bg-[#FFB300]/20 text-[#FFD54F]',
  growth: 'bg-[#9C27B0]/20 text-[#CE93D8]',
  de_novo: 'bg-[#00BCD4]/20 text-[#80DEEA]',
  partnership: 'bg-[#7C4DFF]/20 text-[#B39DDB]',
  other: 'bg-[#566070]/20 text-[#8892A0]',
}

export function DealsTable({ deals }: DealsTableProps) {
  const [search, setSearch] = useState('')

  const recent = useMemo(() => {
    let sorted = [...deals]
      .sort((a, b) => {
        if (!a.deal_date && !b.deal_date) return 0
        if (!a.deal_date) return 1
        if (!b.deal_date) return -1
        return b.deal_date.localeCompare(a.deal_date)
      })
      .slice(0, 100)

    if (search) {
      const lowerSearch = search.toLowerCase()
      sorted = sorted.filter(d =>
        [d.platform_company, d.pe_sponsor, d.target_name, d.target_state, d.deal_type, d.specialty, d.source]
          .some(v => v?.toLowerCase().includes(lowerSearch))
      )
    }

    return sorted
  }, [deals, search])

  const columns = [
    {
      key: 'deal_date',
      header: 'Date',
      render: (row: Record<string, unknown>) => formatDate(row.deal_date as string | null),
    },
    {
      key: 'platform_company',
      header: 'Platform',
      render: (row: Record<string, unknown>) => (
        <span className="font-medium">{(row.platform_company as string) ?? '\u2014'}</span>
      ),
    },
    {
      key: 'pe_sponsor',
      header: 'PE Sponsor',
      render: (row: Record<string, unknown>) => (
        <span className="text-[#8892A0]">{(row.pe_sponsor as string) ?? '\u2014'}</span>
      ),
    },
    { key: 'target_name', header: 'Target' },
    { key: 'target_state', header: 'State' },
    {
      key: 'deal_type',
      header: 'Type',
      render: (row: Record<string, unknown>) => {
        const type = row.deal_type as string | null
        const tagClass = DEAL_TYPE_TAG_COLORS[type ?? 'other'] ?? DEAL_TYPE_TAG_COLORS.other
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-[0.72rem] font-medium ${tagClass}`}>
            {formatDealType(type)}
          </span>
        )
      },
    },
    { key: 'specialty', header: 'Specialty' },
    {
      key: 'deal_size_mm',
      header: 'Size ($M)',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = row.deal_size_mm as number | null
        return v != null ? `$${v.toFixed(1)}M` : '\u2014'
      },
    },
    {
      key: 'source',
      header: 'Source',
      render: (row: Record<string, unknown>) => (
        <span className="text-[#566070] text-[0.75rem]">{(row.source as string) ?? '\u2014'}</span>
      ),
    },
  ]

  return (
    <div>
      <SectionHeader
        title="Recent Deal Activity"
        helpText="The 100 most recent deals matching your filters. Use the search box to find specific companies. Column headers are sortable. Download exports to CSV."
      />
      <div className="mt-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search deals (company name, state, keyword)..."
          className="max-w-md"
        />
        <DataTable
          data={recent as unknown as Record<string, unknown>[]}
          columns={columns}
          defaultSort="deal_date"
          defaultSortDir="desc"
          csvDownload
          csvFilename="deals_export"
          emptyMessage="No deals match your search."
          rowKey={(row, i) => `${row.deal_date}-${row.target_name}-${i}`}
        />
      </div>
    </div>
  )
}
