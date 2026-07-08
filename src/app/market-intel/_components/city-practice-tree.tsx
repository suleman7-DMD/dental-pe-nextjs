'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/data-display/section-header'
import { CensusBadge, formatNetworkName } from '@/components/data-display/census-badge'
import { createBrowserClient } from '@/lib/supabase/client'
import { fetchPracticeLocations } from '@/lib/supabase/queries/practice-locations'
import {
  BUCKET_META,
  SOURCE_CLASS_META,
  deriveSourceClass,
  tierToBucket,
} from '@/lib/census/ownership-truth'
import { tallyBucketCount, type ZipCensusTally } from '@/lib/census/zip-census'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'

interface CensusPractice {
  locationId: string
  practice_name: string | null
  zip: string | null
  ownership_tier: string | null
  pe_backed: boolean | null
  network_id: string | null
  census_review_status: string | null
}

interface CityGroup {
  cityName: string
  zips: string[]
  universe: number
  reviewed: number
  dsoPe: number
  unresolved: number
}

interface CityPracticeTreeProps {
  watchedZips: WatchedZip[]
  zipScores: ZipScore[]
  zipList: string[]
  tallies: ZipCensusTally[]
}

function narrowReviewStatus(value: string | null): 'held' | 'undetermined' | null {
  return value === 'held' || value === 'undetermined' ? value : null
}

export function CityPracticeTree({ watchedZips, zipScores, zipList, tallies }: CityPracticeTreeProps) {
  const [practices, setPractices] = useState<CensusPractice[]>([])
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
    const all: CensusPractice[] = (await fetchPracticeLocations(supabase, {
      zips: zipList,
      gpOnly: true,
      orderBy: 'practice_name',
      ascending: true,
    })).map((row) => ({
      locationId: row.location_id,
      practice_name: row.practice_name,
      zip: row.zip,
      ownership_tier: row.ownership_tier,
      pe_backed: row.pe_backed,
      network_id: row.network_id,
      census_review_status: row.census_review_status,
    }))

    setPractices(all)
    setLoaded(true)
    setLoading(false)
  }, [zipList, loaded, loading])

  const zipScoreMap = useMemo(() => {
    const map = new Map<string, ZipScore>()
    for (const zs of zipScores) map.set(zs.zip_code, zs)
    return map
  }, [zipScores])

  const tallyByZip = useMemo(() => {
    const map = new Map<string, ZipCensusTally>()
    for (const t of tallies) map.set(t.zip, t)
    return map
  }, [tallies])

  // City-level census rollups.
  // Before practices are loaded, the server-built per-ZIP tallies supply the
  // numbers; after load, per-row census fields do — same truth layer either way.
  const cityGroups = useMemo((): CityGroup[] => {
    return sortedCityNames.map(cityName => {
      const zips = cityZips[cityName]

      if (!loaded) {
        let universe = 0
        let reviewed = 0
        let dsoPe = 0
        for (const zip of zips) {
          const tally = tallyByZip.get(zip)
          universe += zipScoreMap.get(zip)?.total_gp_locations ?? tally?.rows ?? 0
          reviewed += tally?.reviewed ?? 0
          dsoPe += tally ? tallyBucketCount(tally, 'dso_pe_corporate') : 0
        }
        return {
          cityName,
          zips: [...zips].sort(),
          universe,
          reviewed,
          dsoPe,
          unresolved: Math.max(universe - reviewed, 0),
        }
      }

      const zipSet = new Set(zips)
      const cityPractices = practices.filter(p => p.zip && zipSet.has(p.zip))
      const universe = cityPractices.length
      const reviewed = cityPractices.filter(
        p => deriveSourceClass(p.ownership_tier, narrowReviewStatus(p.census_review_status)) === 'census_reviewed'
      ).length
      const dsoPe = cityPractices.filter(
        p => tierToBucket(p.ownership_tier) === 'dso_pe_corporate'
      ).length
      return {
        cityName,
        zips: [...zips].sort(),
        universe,
        reviewed,
        dsoPe,
        unresolved: Math.max(universe - reviewed, 0),
      }
    })
  }, [sortedCityNames, cityZips, practices, loaded, zipScoreMap, tallyByZip])

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
        helpText="Address-deduped general dental practices grouped by city and ZIP. Ownership chips are hand-reviewed census conclusions; every location without one stays an explicit open item (held, undetermined, or not yet reviewed) — never estimated. Practice names link to the full census dossier."
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
                  {cg.universe} GP offices across {cg.zips.length} ZIP{cg.zips.length > 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span className="text-[#2D8B4E]">{cg.reviewed} reviewed</span>
                  <span style={{ color: BUCKET_META.dso_pe_corporate.color }}>{cg.dsoPe} DSO/PE</span>
                  <span style={{ color: BUCKET_META.unresolved.color }}>{cg.unresolved} unresolved</span>
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
                      {cg.universe > 0 && (
                        <div className="grid grid-cols-4 gap-3 px-4 py-3 bg-[#FAFAF7]/50">
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#1A1A1A]">{cg.universe}</div>
                            <div className="text-[0.7rem] text-[#6B6B60]">GP Offices</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-mono font-semibold text-[#2D8B4E]">{cg.reviewed}</div>
                            <div className="text-[0.7rem] text-[#6B6B60]">Census-Reviewed</div>
                          </div>
                          <div className="text-center">
                            <div
                              className="text-lg font-mono font-semibold"
                              style={{ color: BUCKET_META.dso_pe_corporate.color }}
                            >
                              {cg.dsoPe}
                            </div>
                            <div className="text-[0.7rem] text-[#6B6B60]">DSO/PE (census)</div>
                          </div>
                          <div className="text-center">
                            <div
                              className="text-lg font-mono font-semibold"
                              style={{ color: BUCKET_META.unresolved.color }}
                            >
                              {cg.unresolved}
                            </div>
                            <div className="text-[0.7rem] text-[#6B6B60]">Needs Answer</div>
                          </div>
                        </div>
                      )}

                      {/* ZIP sub-expanders */}
                      {cg.zips.map(zip => {
                        const zipPractices = practices.filter(p => p.zip === zip)
                        const zipIsExpanded = expandedZips.has(zip)
                        const tally = tallyByZip.get(zip)
                        // Use tally/zip_scores counts before practices are loaded
                        const zipPracticeCount = loaded
                          ? zipPractices.length
                          : (zipScoreMap.get(zip)?.total_gp_locations ?? tally?.rows ?? 0)
                        const zipReviewed = loaded
                          ? zipPractices.filter(
                              p => deriveSourceClass(p.ownership_tier, narrowReviewStatus(p.census_review_status)) === 'census_reviewed'
                            ).length
                          : (tally?.reviewed ?? 0)

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
                                {zipPracticeCount} GP offices &middot; {zipReviewed} census-reviewed
                              </span>
                            </button>

                            {zipIsExpanded && (
                              <div className="px-6 pb-3">
                                {zipPractices.length === 0 ? (
                                  <div className="text-sm text-[#6B6B60] py-2">No GP offices in this ZIP.</div>
                                ) : (
                                  <table className="w-full text-[0.78rem]">
                                    <thead>
                                      <tr className="border-b border-[#E8E5DE]">
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Practice Name</th>
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Ownership (census)</th>
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Network</th>
                                        <th className="text-left py-1.5 px-2 text-[#6B6B60] font-medium">Review State</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {zipPractices.map(p => {
                                        const sourceClass = deriveSourceClass(
                                          p.ownership_tier,
                                          narrowReviewStatus(p.census_review_status)
                                        )
                                        return (
                                          <tr key={p.locationId} className="border-b border-[#E8E5DE]/30 hover:bg-[#F7F7F4]">
                                            <td className="py-1.5 px-2">
                                              <Link
                                                href={`/practice/${encodeURIComponent(p.locationId)}`}
                                                className="text-[#1A1A1A] hover:text-[#8B6508] hover:underline underline-offset-2"
                                              >
                                                {p.practice_name ?? '—'}
                                              </Link>
                                            </td>
                                            <td className="py-1.5 px-2">
                                              <CensusBadge tier={p.ownership_tier} peBacked={p.pe_backed} compact />
                                            </td>
                                            <td className="py-1.5 px-2 text-[#6B6B60]">
                                              {formatNetworkName(p.network_id) ?? '—'}
                                            </td>
                                            <td className="py-1.5 px-2">
                                              <span
                                                className="text-[#6B6B60]"
                                                title={SOURCE_CLASS_META[sourceClass].description}
                                              >
                                                {SOURCE_CLASS_META[sourceClass].label}
                                              </span>
                                            </td>
                                          </tr>
                                        )
                                      })}
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
