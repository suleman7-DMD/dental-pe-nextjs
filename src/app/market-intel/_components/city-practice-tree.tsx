'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { StatusBadge } from '@/components/data-display/status-badge'
import { createBrowserClient } from '@/lib/supabase/client'
import { isIndependentClassification, isCorporateClassification } from '@/lib/constants/entity-classifications'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

interface Practice {
  npi: string
  practice_name: string | null
  ownership_status: string | null
  affiliated_dso: string | null
  affiliated_pe_sponsor: string | null
  entity_type: string | null
  entity_classification: string | null
  zip: string | null
}

interface CityGroup {
  cityName: string
  zips: string[]
  total: number
  independent: number
  dso: number
  pe: number
}

interface CityPracticeTreeProps {
  watchedZips: WatchedZip[]
  zipScores: ZipScore[]
  zipList: string[]
}

export function CityPracticeTree({ watchedZips, zipScores, zipList }: CityPracticeTreeProps) {
  const [practices, setPractices] = useState<Practice[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const [expandedZips, setExpandedZips] = useState<Set<string>>(new Set())

  // Build city -> ZIP mapping
  const cityZips = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const wz of watchedZips) {
      const city = wz.city ?? 'Unknown'
      if (!map[city]) map[city] = []
      map[city].push(wz.zip_code)
    }
    return map
  }, [watchedZips])

  const sortedCityNames = useMemo(() => Object.keys(cityZips).sort(), [cityZips])

  // Lazy load practices on first expand — paginate to avoid Supabase 1000-row limit
  const loadPractices = useCallback(async () => {
    if (loaded || loading || zipList.length === 0) return
    setLoading(true)

    const supabase = createBrowserClient()
    const chunkSize = 100
    const pageSize = 1000
    const all: Practice[] = []

    for (let i = 0; i < zipList.length; i += chunkSize) {
      const chunk = zipList.slice(i, i + chunkSize)
      let offset = 0
      let hasMore = true
      while (hasMore) {
        const { data } = await supabase
          .from('practices')
          .select('npi, practice_name, entity_type, ownership_status, entity_classification, affiliated_dso, affiliated_pe_sponsor, zip')
          .in('zip', chunk)
          .range(offset, offset + pageSize - 1)

        if (data && data.length > 0) {
          all.push(...(data as Practice[]))
          offset += data.length
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }
    }

    setPractices(all)
    setLoaded(true)
    setLoading(false)
  }, [zipList, loaded, loading])

  // Compute city-level stats
  const cityGroups = useMemo((): CityGroup[] => {
    return sortedCityNames.map(cityName => {
      const zips = cityZips[cityName]
      const cityPractices = practices.filter(p => p.zip && zips.includes(p.zip))
      return {
        cityName,
        zips: [...zips].sort(),
        total: cityPractices.length,
        independent: cityPractices.filter(p => {
          if (p.entity_classification) return isIndependentClassification(p.entity_classification)
          return p.ownership_status === 'independent' || p.ownership_status === 'likely_independent'
        }).length,
        dso: cityPractices.filter(p => {
          if (p.entity_classification) return isCorporateClassification(p.entity_classification)
          return p.ownership_status === 'dso_affiliated'
        }).length,
        pe: cityPractices.filter(p => {
          if (p.entity_classification) return false
          return p.ownership_status === 'pe_backed'
        }).length,
      }
    })
  }, [sortedCityNames, cityZips, practices])

  const toggleCity = useCallback(
    (city: string) => {
      // Lazy load practices when first city is expanded
      if (!loaded) loadPractices()

      setExpandedCities(prev => {
        const next = new Set(prev)
        if (next.has(city)) {
          next.delete(city)
        } else {
          next.add(city)
        }
        return next
      })
    },
    [loaded, loadPractices]
  )

  const toggleZip = useCallback((zip: string) => {
    setExpandedZips(prev => {
      const next = new Set(prev)
      if (next.has(zip)) {
        next.delete(zip)
      } else {
        next.add(zip)
      }
      return next
    })
  }, [])

  if (zipList.length === 0) return null

  return (
    <div>
      <SectionHeader
        title="Practice Detail by City"
        helpText="Practices grouped by city, then by ZIP code. Expand a city to see its ZIP codes, then expand a ZIP to see every practice. Green = independent, Yellow = DSO-affiliated, Red = PE-backed."
      />

      <div className="mt-4 space-y-1">
        {cityGroups.map(cg => {
          const isExpanded = expandedCities.has(cg.cityName)

          return (
            <div key={cg.cityName} className="rounded-lg border border-[#1E293B] bg-[#0F1629] overflow-hidden">
              {/* City header */}
              <button
                onClick={() => toggleCity(cg.cityName)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1A2035] transition-colors"
              >
                <svg
                  className={`w-4 h-4 text-[#64748B] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium text-[#F8FAFC]">{cg.cityName}</span>
                <span className="text-xs text-[#94A3B8]">
                  {cg.total} practices across {cg.zips.length} ZIP{cg.zips.length > 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span className="text-[#22C55E]">{cg.independent} indep.</span>
                  <span className="text-[#F59E0B]">{cg.dso} DSO</span>
                  <span className="text-[#EF4444]">{cg.pe} PE</span>
                </div>
              </button>

              {/* Expanded city content */}
              {isExpanded && (
                <div className="border-t border-[#1E293B]">
                  {loading ? (
                    <div className="px-6 py-4 text-center text-[#94A3B8] text-sm animate-pulse">
                      Loading practices...
                    </div>
                  ) : (
                    <>
                      {/* City mini KPIs */}
                      {cg.total > 0 && (
                        <div className="grid grid-cols-4 gap-3 px-4 py-3 bg-[#0A0F1E]/50">
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#F8FAFC]">{cg.total}</div>
                            <div className="text-[0.7rem] text-[#94A3B8]">Total</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#22C55E]">{cg.independent}</div>
                            <div className="text-[0.7rem] text-[#94A3B8]">Independent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#F59E0B]">{cg.dso + cg.pe}</div>
                            <div className="text-[0.7rem] text-[#94A3B8]">DSO + PE</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#F8FAFC]">
                              {cg.total > 0 ? `${(((cg.dso + cg.pe) / cg.total) * 100).toFixed(0)}%` : '0%'}
                            </div>
                            <div className="text-[0.7rem] text-[#94A3B8]">Known Consol. (of total)</div>
                          </div>
                        </div>
                      )}

                      {/* ZIP sub-expanders */}
                      {cg.zips.map(zip => {
                        const zipPractices = practices.filter(p => p.zip === zip)
                        const zipIsExpanded = expandedZips.has(zip)
                        const zipScore = zipScores.find(z => z.zip_code === zip)
                        const scoreTag = zipScore?.opportunity_score != null
                          ? ` | Score: ${zipScore.opportunity_score.toFixed(0)}`
                          : ''

                        return (
                          <div key={zip} className="border-t border-[#1E293B]/50">
                            <button
                              onClick={() => toggleZip(zip)}
                              className="w-full flex items-center gap-3 px-6 py-2.5 text-left hover:bg-[#1A2035] transition-colors"
                            >
                              <svg
                                className={`w-3.5 h-3.5 text-[#64748B] transition-transform flex-shrink-0 ${zipIsExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-[0.82rem] text-[#F8FAFC]">{zip}</span>
                              <span className="text-xs text-[#94A3B8]">
                                {zipPractices.length} practices{scoreTag}
                              </span>
                            </button>

                            {zipIsExpanded && (
                              <div className="px-6 pb-3">
                                {zipPractices.length === 0 ? (
                                  <div className="text-sm text-[#94A3B8] py-2">No practices in this ZIP.</div>
                                ) : (
                                  <table className="w-full text-[0.78rem]">
                                    <thead>
                                      <tr className="border-b border-[#1E293B]">
                                        <th className="text-left py-1.5 px-2 text-[#94A3B8] font-medium">Practice Name</th>
                                        <th className="text-left py-1.5 px-2 text-[#94A3B8] font-medium">Status</th>
                                        <th className="text-left py-1.5 px-2 text-[#94A3B8] font-medium">DSO</th>
                                        <th className="text-left py-1.5 px-2 text-[#94A3B8] font-medium">Entity Type</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {zipPractices.map(p => (
                                        <tr key={p.npi} className="border-b border-[#1E293B]/30 hover:bg-[#1A2035]">
                                          <td className="py-1.5 px-2 text-[#F8FAFC]">{p.practice_name ?? '\u2014'}</td>
                                          <td className="py-1.5 px-2">
                                            <StatusBadge status={p.ownership_status} />
                                          </td>
                                          <td className="py-1.5 px-2 text-[#94A3B8]">
                                            {p.affiliated_dso ?? p.affiliated_pe_sponsor ?? '\u2014'}
                                          </td>
                                          <td className="py-1.5 px-2 text-[#94A3B8]">{p.entity_type ?? '\u2014'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
