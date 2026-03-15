'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { FilterBar, FilterGroup, MultiSelect } from '@/components/filters/filter-bar'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import type { Deal } from '@/lib/supabase/queries/deals'
import { DealKpis } from './deal-kpis'
import { DealVolumeTimeline } from './deal-volume-timeline'
import { SponsorPlatformCharts } from './sponsor-platform-charts'
import { StateChoropleth } from './state-choropleth'
import { SpecialtyCharts } from './specialty-charts'
import { DealsTable } from './deals-table'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'geography', label: 'Geography' },
  { key: 'deals', label: 'Deals' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface DealFlowShellProps {
  initialDeals: Deal[]
  distinctSponsors: string[]
  distinctPlatforms: string[]
  distinctStates: string[]
  distinctSpecialties: string[]
  distinctSources: string[]
  distinctTypes: string[]
}

export function DealFlowShell({
  initialDeals,
  distinctSponsors,
  distinctPlatforms,
  distinctStates,
  distinctSpecialties,
  distinctSources,
  distinctTypes,
}: DealFlowShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Tab state from URL
  const currentTab = (searchParams.get('tab') as TabKey) || 'overview'
  const setTab = useCallback(
    (tab: TabKey) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('tab', tab)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  // Filter state from URL params
  const [startDate, setStartDate] = useState(searchParams.get('start') ?? '')
  const [endDate, setEndDate] = useState(searchParams.get('end') ?? '')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    searchParams.get('types')?.split(',').filter(Boolean) ?? []
  )
  const [selectedSponsors, setSelectedSponsors] = useState<string[]>(
    searchParams.get('sponsors')?.split(',').filter(Boolean) ?? []
  )
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    searchParams.get('platforms')?.split(',').filter(Boolean) ?? []
  )
  const [selectedStates, setSelectedStates] = useState<string[]>(
    searchParams.get('states')?.split(',').filter(Boolean) ?? []
  )
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    searchParams.get('specialties')?.split(',').filter(Boolean) ?? []
  )
  const [selectedSources, setSelectedSources] = useState<string[]>(
    searchParams.get('sources')?.split(',').filter(Boolean) ?? []
  )

  // Sync filters to URL
  const updateUrl = useCallback(
    (params: Record<string, string[]>) => {
      const sp = new URLSearchParams()
      sp.set('tab', currentTab)
      for (const [key, values] of Object.entries(params)) {
        if (values.length > 0) sp.set(key, values.join(','))
      }
      if (startDate) sp.set('start', startDate)
      if (endDate) sp.set('end', endDate)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [startDate, endDate, router, pathname, currentTab]
  )

  // Apply filters
  const filteredDeals = useMemo(() => {
    let deals = initialDeals

    if (startDate) {
      deals = deals.filter(d => d.deal_date && d.deal_date >= startDate)
    }
    if (endDate) {
      deals = deals.filter(d => d.deal_date && d.deal_date <= endDate)
    }
    if (selectedTypes.length > 0) {
      deals = deals.filter(d => d.deal_type && selectedTypes.includes(d.deal_type))
    }
    if (selectedSponsors.length > 0) {
      deals = deals.filter(d => d.pe_sponsor && selectedSponsors.includes(d.pe_sponsor))
    }
    if (selectedPlatforms.length > 0) {
      deals = deals.filter(d => d.platform_company && selectedPlatforms.includes(d.platform_company))
    }
    if (selectedStates.length > 0) {
      deals = deals.filter(d => d.target_state && selectedStates.includes(d.target_state))
    }
    if (selectedSpecialties.length > 0) {
      deals = deals.filter(d => d.specialty && selectedSpecialties.includes(d.specialty))
    }
    if (selectedSources.length > 0) {
      deals = deals.filter(d => d.source && selectedSources.includes(d.source))
    }

    return deals
  }, [initialDeals, startDate, endDate, selectedTypes, selectedSponsors, selectedPlatforms, selectedStates, selectedSpecialties, selectedSources])

  const totalCount = filteredDeals.length
  const sourceCount = new Set(filteredDeals.map(d => d.source).filter(Boolean)).size

  const handleReset = useCallback(() => {
    setStartDate('')
    setEndDate('')
    setSelectedTypes([])
    setSelectedSponsors([])
    setSelectedPlatforms([])
    setSelectedStates([])
    setSelectedSpecialties([])
    setSelectedSources([])
    const sp = new URLSearchParams()
    sp.set('tab', currentTab)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }, [router, pathname, currentTab])

  const hasFilters = startDate || endDate || selectedTypes.length > 0 || selectedSponsors.length > 0 || selectedPlatforms.length > 0 || selectedStates.length > 0 || selectedSpecialties.length > 0 || selectedSources.length > 0

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dental PE Consolidation Intelligence</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">
            Real-time tracking of private equity activity in U.S. dentistry
          </p>
          <p className="text-[#9C9C90] text-xs mt-0.5">
            {totalCount.toLocaleString()} deals | {sourceCount} sources | Filtered view
          </p>
        </div>

        {/* Horizontal Filter Bar */}
        <FilterBar>
          <FilterGroup label="Date Range">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
            />
          </FilterGroup>
          <FilterGroup label="Deal Type">
            <MultiSelect
              options={distinctTypes}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              placeholder="All Types"
            />
          </FilterGroup>
          <FilterGroup label="PE Sponsor">
            <MultiSelect
              options={distinctSponsors}
              selected={selectedSponsors}
              onChange={setSelectedSponsors}
              placeholder="All Sponsors"
            />
          </FilterGroup>
          <FilterGroup label="Platform">
            <MultiSelect
              options={distinctPlatforms}
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
              placeholder="All Platforms"
            />
          </FilterGroup>
          <FilterGroup label="State">
            <MultiSelect
              options={distinctStates}
              selected={selectedStates}
              onChange={setSelectedStates}
              placeholder="All States"
            />
          </FilterGroup>
          <FilterGroup label="Specialty">
            <MultiSelect
              options={distinctSpecialties}
              selected={selectedSpecialties}
              onChange={setSelectedSpecialties}
              placeholder="All"
            />
          </FilterGroup>
          <FilterGroup label="Source">
            <MultiSelect
              options={distinctSources}
              selected={selectedSources}
              onChange={setSelectedSources}
              placeholder="All"
            />
          </FilterGroup>
          {hasFilters && (
            <button
              onClick={handleReset}
              className="self-end px-3 py-1.5 rounded-md text-[0.78rem] text-[#C23B3B] hover:bg-[#C23B3B]/10 transition-colors"
            >
              Reset
            </button>
          )}
        </FilterBar>

        {filteredDeals.length === 0 ? (
          <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-8 text-center text-[#6B6B60] text-sm">
            No deals match current filters. Adjust the filters above or run the scrapers to ingest new data.
          </div>
        ) : (
          <>
            {/* Persistent KPI Strip */}
            <DealKpis deals={filteredDeals} allDeals={initialDeals} />

            {/* Tab Bar */}
            <div className="border-b border-[#E8E5DE]">
              <nav className="flex gap-0 -mb-px">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setTab(tab.key)}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
                      currentTab === tab.key
                        ? 'text-[#B8860B] border-b-2 border-[#B8860B]'
                        : 'text-[#6B6B60] hover:text-[#1A1A1A] hover:bg-black/[0.04]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {currentTab === 'overview' && (
              <div className="space-y-6">
                <DealVolumeTimeline deals={filteredDeals} />
                <SpecialtyCharts deals={filteredDeals} />
              </div>
            )}

            {currentTab === 'sponsors' && (
              <SponsorPlatformCharts deals={filteredDeals} />
            )}

            {currentTab === 'geography' && (
              <StateChoropleth deals={filteredDeals} />
            )}

            {currentTab === 'deals' && (
              <DealsTable deals={filteredDeals} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
