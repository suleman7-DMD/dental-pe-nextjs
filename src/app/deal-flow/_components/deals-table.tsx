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
  buyout: 'bg-[#B8860B]/15 text-[#8B6914]',
  'add-on': 'bg-[#2D8B4E]/15 text-[#1E6B3A]',
  recapitalization: 'bg-[#D4920B]/15 text-[#A67308]',
  growth: 'bg-[#7C3AED]/15 text-[#5B21B6]',
  de_novo: 'bg-[#0891B2]/15 text-[#0E7490]',
  partnership: 'bg-[#6D28D9]/15 text-[#5B21B6]',
  other: 'bg-[#9C9C90]/15 text-[#6B6B60]',
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
      render: (val: unknown) => formatDate(val as string | null),
    },
    {
      key: 'platform_company',
      header: 'Platform',
      render: (val: unknown) => {
        const v = val as string | null
        return <span className="font-medium">{v ?? '\u2014'}</span>
      },
    },
    {
      key: 'pe_sponsor',
      header: 'PE Sponsor',
      render: (val: unknown) => {
        const v = val as string | null
        return <span className="text-[#6B6B60]">{v ?? '\u2014'}</span>
      },
    },
    { key: 'target_name', header: 'Target' },
    { key: 'target_state', header: 'State' },
    {
      key: 'deal_type',
      header: 'Type',
      render: (val: unknown) => {
        const type = val as string | null
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
      render: (val: unknown) => {
        const v = val as number | null
        return v != null ? `$${v.toFixed(1)}M` : '\u2014'
      },
    },
    {
      key: 'source',
      header: 'Source',
      render: (val: unknown) => {
        const v = val as string | null
        return <span className="text-[#9C9C90] text-[0.75rem]">{v ?? '\u2014'}</span>
      },
    },
  ]

  return (
    <div>
      <SectionHeader
        title="Recent Deal Activity"
        helpText="All deals matching your filters, sorted by date. Use the search box to find specific companies. Column headers are sortable. Download exports to CSV."
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
