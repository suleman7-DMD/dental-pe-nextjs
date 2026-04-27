'use client'

import { useState, useMemo, useCallback } from 'react'
import { SectionHeader } from '@/components/data-display/section-header'
import { StatusBadge } from '@/components/data-display/status-badge'
import { createBrowserClient } from '@/lib/supabase/client'
import { fetchPracticeLocations } from '@/lib/supabase/queries/practice-locations'
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
    const all: Practice[] = (await fetchPracticeLocations(supabase, {
      zips: zipList,
      orderBy: 'practice_name',
      ascending: true,
    })).map((row) => ({
      npi: row.primary_npi ?? row.location_id,
      practice_name: row.practice_name,
      ownership_status: row.ownership_status,
      affiliated_dso: row.affiliated_dso,
      affiliated_pe_sponsor: row.affiliated_pe_sponsor,
      entity_type: null,
      entity_classification: row.entity_classification,
      zip: row.zip,
    }))

    setPractices(all)
    setLoaded(true)
    setLoading(false)
  }, [zipList, loaded, loading])

  // Build zip_code -> ZipScore lookup for initial totals before practices are loaded
  const zipScoreMap = useMemo(() => {
    const map = new Map<string, ZipScore>()
    for (const zs of zipScores) {
      map.set(zs.zip_code, zs)
    }
    return map
  }, [zipScores])

  // Compute city-level stats
  // Before practices are loaded, use zip_scores for totals (avoids "0 practices" bug).
  // After practices are loaded, use practice-level computation for accuracy.
  const cityGroups = useMemo((): CityGroup[] => {
    return sortedCityNames.map(cityName => {
      const zips = cityZips[cityName]

      if (!loaded) {
        // Use zip_scores data for initial totals.
        let total = 0
        let independent = 0
        let dso = 0
        let pe = 0
        for (const zip of zips) {
          const zs = zipScoreMap.get(zip)
          if (zs) {
            const zipTotal = zs.total_practices
              ?? ((zs.total_gp_locations ?? 0) + (zs.total_specialist_locations ?? 0))
            total += zipTotal
            // Corporate count: prefer saturation metric (corporate_share_pct * GP locations)
            const corpFromSat = zs.corporate_share_pct != null && zs.total_gp_locations != null
              ? Math.round(zs.corporate_share_pct * zs.total_gp_locations)
              : null
            const corpCount = corpFromSat ?? ((zs.dso_affiliated_count ?? 0) + (zs.pe_backed_count ?? 0))
            dso += corpCount
            // Independent count: prefer DB value, else estimate from total minus corporate minus specialist
            const specCount = zs.total_specialist_locations ?? 0
            const indepFromDb = zs.independent_count != null && zs.independent_count > 0
              ? zs.independent_count
              : Math.max(0, zipTotal - corpCount - specCount)
            independent += indepFromDb
            pe += 0  // PE is folded into corporate count from saturation metrics
          }
        }
        return {
          cityName,
          zips: [...zips].sort(),
          total,
          independent,
          dso,
          pe,
        }
      }

      // Practices have been loaded — use practice-level computation
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
          if (p.ownership_status === 'pe_backed') return false  // PE takes priority
          if (p.entity_classification) return isCorporateClassification(p.entity_classification)
          return p.ownership_status === 'dso_affiliated'
        }).length,
        pe: cityPractices.filter(p => {
          const os = (p.ownership_status ?? '').trim().toLowerCase()
          return os === 'pe_backed'
        }).length,
      }
    })
  }, [sortedCityNames, cityZips, practices, loaded, zipScoreMap])

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
            <div key={cg.cityName} className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
              {/* City header */}
              <button
                onClick={() => toggleCity(cg.cityName)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F7F4] transition-colors"
              >
                <svg
                  className={`w-4 h-4 text-[#707064] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium text-[#1A1A1A]">{cg.cityName}</span>
                <span className="text-xs text-[#6B6B60]">
                  {cg.total} practices across {cg.zips.length} ZIP{cg.zips.length > 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span className="text-[#2D8B4E]">{cg.independent} indep.</span>
                  <span className="text-[#D4920B]">{cg.dso} DSO</span>
                  <span className="text-[#C23B3B]">{cg.pe} PE</span>
                </div>
              </button>

              {/* Expanded city content */}
              {isExpanded && (
                <div className="border-t border-[#E8E5DE]">
                  {loading ? (
                    <div className="px-6 py-4 text-center text-[#6B6B60] text-sm animate-pulse">
                      Loading practices...
                    </div>
                  ) : (
                    <>
                      {/* City mini KPIs */}
                      {cg.total > 0 && (
                        <div className="grid grid-cols-4 gap-3 px-4 py-3 bg-[#FAFAF7]/50">
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#1A1A1A]">{cg.total}</div>
                            <div className="text-[0.7rem] text-[#6B6B60]">Total</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#2D8B4E]">{cg.independent}</div>
                            <div className="text-[0.7rem] text-[#6B6B60]">Independent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#D4920B]">{cg.dso + cg.pe}</div>
                            <div className="text-[0.7rem] text-[#6B6B60]">DSO + PE</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#1A1A1A]">
                              {cg.total > 0 ? `${(((cg.dso + cg.pe) / cg.total) * 100).toFixed(0)}%` : '0%'}
                            </div>
                            <div className="text-[0.7rem] text-[#6B6B60]">Known Consol. (of total)</div>
                          </div>
                        </div>
                      )}

                      {/* ZIP sub-expanders */}
                      {cg.zips.map(zip => {
                        const zipPractices = practices.filter(p => p.zip === zip)
                        const zipIsExpanded = expandedZips.has(zip)
                        const zipScore = zipScores.find(z => z.zip_code === zip)
                        const scoreTag = zipScore?.opportunity_score != null
                          ? ` | Score: ${zipScore.opportunity_score}`
                          : ''
                        // Use zip_scores count before practices are loaded
                        const zipPracticeCount = loaded
                          ? zipPractices.length
                          : (zipScore?.total_practices
                              ?? ((zipScore?.total_gp_locations ?? 0) + (zipScore?.total_specialist_locations ?? 0)))

                        return (
                          <div key={zip} className="border-t border-[#E8E5DE]/50">
                            <button
                              onClick={() => toggleZip(zip)}
                              className="w-full flex items-center gap-3 px-6 py-2.5 text-left hover:bg-[#F7F7F4] transition-colors"
                            >
                              <svg
                                className={`w-3.5 h-3.5 text-[#707064] transition-transform flex-shrink-0 ${zipIsExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-[0.82rem] text-[#1A1A1A]">{zip}</span>
                              <span className="text-xs text-[#6B6B60]">
                                {zipPracticeCount} practices{scoreTag}
                              </span>
                            </button>

                            {zipIsExpanded && (
                              <div className="px-6 pb-3">
                                {zipPractices.length === 0 ? (
                                  <div className="text-sm text-[#6B6B60] py-2">No practices in this ZIP.</div>
                                ) : (
                                  <table className="w-full text-[0.78rem]">
                                    <thead>
                                      <tr className="border-b border-[#E8E5DE]">
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Practice Name</th>
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Status</th>
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">DSO</th>
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Entity Type</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {zipPractices.map(p => (
                                        <tr key={p.npi} className="border-b border-[#E8E5DE]/30 hover:bg-[#F7F7F4]">
                                          <td className="py-1.5 px-2 text-[#1A1A1A]">{p.practice_name ?? '\u2014'}</td>
                                          <td className="py-1.5 px-2">
                                            <StatusBadge status={p.entity_classification ?? p.ownership_status} />
                                          </td>
                                          <td className="py-1.5 px-2 text-[#6B6B60]">
                                            {p.affiliated_dso ?? p.affiliated_pe_sponsor ?? '\u2014'}
                                          </td>
                                          <td className="py-1.5 px-2 text-[#6B6B60]">{p.entity_type ?? '\u2014'}</td>
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
