'use client'

import { useState, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { HeadlineKpiCard } from '@/components/data-display/headline-kpi-card'
import { SectionHeader } from '@/components/data-display/section-header'
import { formatRelativeTime } from '@/lib/utils/formatting'
import { censusHeadlineStats } from '@/lib/census/headline-stats'
import {
  ADA_ANCHOR_UNIT_CAVEAT,
  ADA_IL_PER_DENTIST_DSO_PCT,
  BUCKET_META,
  HEADLINE_BUCKETS,
  SOURCE_CLASS_META,
  TIER_CODE,
  TIER_META,
} from '@/lib/census/ownership-truth'
import { CensusBucketSummaryCard } from '@/components/data-display/census-bucket-summary'
import {
  countSourceClasses,
  summarizeTallies,
  sumTierCounts,
  type ZipCensusTally,
} from '@/lib/census/zip-census'
import type { ZipScore } from '@/lib/supabase/queries/zip-scores'
import type { WatchedZip } from '@/lib/supabase/queries/watched-zips'
import { WarroomCrossLink } from '@/components/layout/warroom-cross-link'
import { DSOPenetrationTable } from './dso-penetration-table'

// Lazy-load heavy components (maps, large tables with sub-queries)
const ConsolidationMap = dynamic(() => import('./consolidation-map').then(m => ({ default: m.ConsolidationMap })), {
  loading: () => <div className="h-[400px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse flex items-center justify-center text-[#707064] text-sm">Loading map...</div>,
  ssr: false,
})
const ZipScoreTable = dynamic(() => import('./zip-score-table').then(m => ({ default: m.ZipScoreTable })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})
const CityPracticeTree = dynamic(() => import('./city-practice-tree').then(m => ({ default: m.CityPracticeTree })), {
  loading: () => <div className="h-[300px] rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] animate-pulse" />,
})

interface MarketIntelShellProps {
  initialZipScores: ZipScore[]
  initialWatchedZips: WatchedZip[]
  metroAreas: string[]
  freshness: {
    totalPractices: number
    daEnriched: number
    lastUpdated: string | null
  }
  /** Per-ZIP census tallies — the only ownership aggregate this page receives. */
  zipCensusTallies: ZipCensusTally[]
}

const TABS = [
  { id: 'consolidation', label: 'Consolidation' },
  { id: 'zip-analysis', label: 'ZIP Analysis' },
  { id: 'ownership', label: 'Ownership Tiers' },
] as const

type TabId = (typeof TABS)[number]['id']
const ALL_CHICAGO_SCOPE = 'Chicagoland'

function MarketIntelShellInner({
  initialZipScores,
  initialWatchedZips,
  metroAreas,
  freshness,
  zipCensusTallies,
}: MarketIntelShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = (searchParams.get('tab') ?? 'consolidation') as TabId
  const setActiveTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'consolidation') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const newSearch = params.toString()
    const url = newSearch ? `${pathname}?${newSearch}` : pathname
    router.push(url, { scroll: false })
  }

  const [selectedMetro, setSelectedMetro] = useState<string>(ALL_CHICAGO_SCOPE)
  const allMetros = useMemo(
    () => [ALL_CHICAGO_SCOPE, ...metroAreas.filter((m) => m !== ALL_CHICAGO_SCOPE)],
    [metroAreas]
  )

  // Filter zip scores and watched zips by selected metro
  const zipScores = useMemo(() => {
    if (selectedMetro === ALL_CHICAGO_SCOPE) return initialZipScores
    return initialZipScores.filter(z => z.metro_area === selectedMetro)
  }, [initialZipScores, selectedMetro])

  const watchedZips = useMemo(() => {
    if (selectedMetro === ALL_CHICAGO_SCOPE) return initialWatchedZips
    return initialWatchedZips.filter(z => z.metro_area === selectedMetro)
  }, [initialWatchedZips, selectedMetro])

  const zipList = useMemo(() => watchedZips.map(z => z.zip_code), [watchedZips])

  // Census tallies for the selected scope. The full-Chicagoland scope keeps
  // every tallied ZIP; a metro scope keeps the metro's watched ZIPs.
  const scopedTallies = useMemo(() => {
    if (selectedMetro === ALL_CHICAGO_SCOPE) return zipCensusTallies
    const zipSet = new Set(zipList)
    return zipCensusTallies.filter(t => zipSet.has(t.zip))
  }, [zipCensusTallies, zipList, selectedMetro])

  // Five-bucket census summary for the scope. Universe = live GP-location
  // denominator from zip_scores (falls back to tracked census rows).
  const bucketSummary = useMemo(() => {
    const gpUniverse = zipScores
      .map((z) => z.total_gp_locations)
      .filter((v): v is number => v != null && !isNaN(v))
      .reduce((a, b) => a + b, 0)
    const universe = gpUniverse > 0
      ? gpUniverse
      : scopedTallies.reduce((sum, t) => sum + t.rows, 0)
    return summarizeTallies(scopedTallies, universe)
  }, [zipScores, scopedTallies])

  const sourceClasses = useMemo(
    () => countSourceClasses(scopedTallies, bucketSummary.universe),
    [scopedTallies, bucketSummary.universe]
  )

  const tierCounts = useMemo(() => sumTierCounts(scopedTallies), [scopedTallies])

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ownership & Coverage</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">
            The hand-reviewed ownership census, read honestly: five buckets, explicit
            unresolved coverage, and owner-network patterns by ZIP. The legacy detector
            methodology lives in{' '}
            <Link href="/data-breakdown" className="text-[#8B6508] underline underline-offset-2 hover:text-[#B8860B]">
              Methodology
            </Link>.
          </p>
        </div>

        <WarroomCrossLink
          context="See consolidation, targets, and signals together — with scope, lens, and intent in one command surface."
          hrefSuffix="?mode=hunt&lens=consolidation"
        />

        {/* Data freshness bar */}
        <div className="rounded-lg border border-[#D4D0C8] bg-gradient-to-r from-[#F7F7F4] to-[#F5F5F0] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[#6B6B60] text-[0.82rem] font-medium">
            <strong
              className="text-[#1A1A1A]"
              title="Address-deduped Chicagoland GP clinic locations in the 269 watched Illinois ZIPs. Specialists, non-clinical rows, org-only NPIs, and da_unverified artifacts are excluded."
            >
              {freshness.totalPractices.toLocaleString()}
            </strong>{' '}
            GP clinic locations &nbsp;&middot;&nbsp;{' '}
            <strong className="text-[#1A1A1A]">{freshness.daEnriched.toLocaleString()}</strong>{' '}
            Data Axle enriched GP locations
            {freshness.lastUpdated && (
              <>
                {' '}&nbsp;&middot;&nbsp;{' '}
                Updated {formatRelativeTime(freshness.lastUpdated)}
              </>
            )}
          </span>
        </div>

        {/* Market selector */}
        <div className="flex items-center gap-3">
          <label className="text-[0.78rem] text-[#6B6B60] uppercase tracking-wider font-medium">
            Market
          </label>
          <select
            value={selectedMetro}
            onChange={e => setSelectedMetro(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#E8E5DE] bg-[#FFFFFF] text-[0.82rem] text-[#1A1A1A] focus:outline-none focus:border-[#B8860B] transition-colors"
          >
            {allMetros.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Census headline (always visible above tabs) */}
        <div id="kpis" className="space-y-3">
          {/* The five-bucket census strip IS the ownership headline — all five
              buckets always render, Unresolved included. */}
          <CensusBucketSummaryCard summary={bucketSummary} scopeLabel={selectedMetro} />

          {/* Canonical headline cards — same labels/formulas as Home and the
              Directory, all defined once in lib/census/headline-stats. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {censusHeadlineStats(bucketSummary).map((stat) => (
              <HeadlineKpiCard key={stat.key} stat={stat} />
            ))}
          </div>

          <p className="text-[#707064] text-xs">
            Within Not Reviewed Yet ({bucketSummary.counts.unresolved.toLocaleString()}):{' '}
            {sourceClasses.held.toLocaleString()} held for adjudication &middot;{' '}
            {sourceClasses.undetermined.toLocaleString()} undetermined after research &middot;{' '}
            {sourceClasses.notYetReviewed.toLocaleString()} not yet reviewed.
            Every number above is a census conclusion or an explicit open item — nothing is estimated.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="border-b border-[#E8E5DE]">
          <nav className="flex gap-0" aria-label="Market Intel tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-[#B8860B] text-[#B8860B]'
                    : 'border-transparent text-[#6B6B60] hover:text-[#1A1A1A] hover:border-[#D4D0C8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'consolidation' && (
          <div className="space-y-6">
            {/* Census DSO/PE floor table */}
            <DSOPenetrationTable
              zipScores={zipScores}
              watchedZips={watchedZips}
              tallies={scopedTallies}
            />

            {/* Census consolidation map */}
            <ConsolidationMap
              zipScores={zipScores}
              selectedMetro={selectedMetro}
              tallies={scopedTallies}
            />
          </div>
        )}

        {activeTab === 'zip-analysis' && (
          <div className="space-y-6">
            {/* Census detail per ZIP */}
            <ZipScoreTable zipScores={zipScores} tallies={scopedTallies} />

            {/* Practice detail tree — census rollups + per-location census rows */}
            <CityPracticeTree
              watchedZips={watchedZips}
              zipScores={zipScores}
              zipList={zipList}
              tallies={scopedTallies}
            />
          </div>
        )}

        {activeTab === 'ownership' && (
          <div className="space-y-6">
            <div>
              <SectionHeader
                title="Census Ownership Tiers"
                helpText="ownership_tier is the only ownership truth layer — assigned by hand review with cited evidence, one location at a time. Tiers roll up to the five headline groups; anything without a reviewed tier stays marked Not Reviewed Yet."
              />

              <div className="mt-4 space-y-4">
                {/* Four reviewed buckets, each listing its member tiers */}
                {HEADLINE_BUCKETS.filter(b => b !== 'unresolved').map(bucket => {
                  const meta = BUCKET_META[bucket]
                  const bucketCount = bucketSummary.counts[bucket]
                  return (
                    <div key={bucket} className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <h3 className="text-sm font-semibold text-[#1A1A1A]">{meta.label}</h3>
                        <span className="text-xs text-[#6B6B60]">
                          {bucketCount.toLocaleString()} reviewed locations
                          {bucketSummary.reviewed > 0 && (
                            <> ({bucketSummary.pctOfReviewed[bucket].toFixed(1)}% of reviewed)</>
                          )}
                        </span>
                        {bucket === 'dso_pe_corporate' && (
                          <span
                            className="text-[11px] text-[#8B6508] ml-auto"
                            title={ADA_ANCHOR_UNIT_CAVEAT}
                          >
                            ADA anchor {ADA_IL_PER_DENTIST_DSO_PCT}% (IL dentists, per-dentist unit)
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-[#E8E5DE]">
                        {meta.tiers.map(tier => (
                          <div key={tier} className="px-4 py-3 flex items-start gap-3">
                            <code className="text-xs font-mono bg-[#F7F7F4] px-2 py-0.5 rounded text-[#6B6B60] whitespace-nowrap mt-0.5">
                              {TIER_CODE[tier]}
                            </code>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-[#1A1A1A]">{TIER_META[tier].label}</div>
                              <div className="text-xs text-[#6B6B60] mt-0.5">{TIER_META[tier].description}</div>
                            </div>
                            <span className="text-sm font-mono font-semibold text-[#3D3D35] whitespace-nowrap mt-0.5">
                              {tierCounts[tier].toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Unresolved — always visible, broken out by source class */}
                <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full opacity-55"
                      style={{ backgroundColor: BUCKET_META.unresolved.color }}
                    />
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">{BUCKET_META.unresolved.label}</h3>
                    <span className="text-xs text-[#6B6B60]">
                      {bucketSummary.counts.unresolved.toLocaleString()} locations without a census conclusion
                    </span>
                  </div>
                  <div className="divide-y divide-[#E8E5DE]">
                    {([
                      { key: 'held', count: sourceClasses.held },
                      { key: 'undetermined', count: sourceClasses.undetermined },
                      { key: 'unreviewed', count: sourceClasses.notYetReviewed },
                    ] as const).map(({ key, count }) => (
                      <div key={key} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[#1A1A1A]">{SOURCE_CLASS_META[key].label}</div>
                          <div className="text-xs text-[#6B6B60] mt-0.5">{SOURCE_CLASS_META[key].description}</div>
                        </div>
                        <span className="text-sm font-mono font-semibold text-[#3D3D35] whitespace-nowrap mt-0.5">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How the census works */}
                <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
                    How a location gets a tier
                  </h3>
                  <div className="space-y-2 text-xs text-[#3D3D35]">
                    <p>
                      Every tier is a hand-reviewed conclusion: a reviewer researches the location,
                      records an evidence basis (state business registrations, practice websites,
                      NPI cross-references, DSO location pages), cites source URLs, and assigns a
                      confidence level. Locations that share an owner or group are linked to the
                      same named network, so related offices show up together.
                    </p>
                    <p>
                      Locations the census could not settle stay visible as open items: held for
                      adjudication when a blocker needs a second look, undetermined when the
                      evidence was too thin. Nothing is backfilled with estimates.
                    </p>
                    <p>
                      The older automated detector is no longer an
                      ownership answer anywhere on this page. Its methodology, the confirmed-floor
                      story, and the ADA anchor comparison live in{' '}
                      <Link href="/data-breakdown" className="text-[#8B6508] underline underline-offset-2 hover:text-[#B8860B]">
                        Methodology
                      </Link>
                      ; raw detector fields remain inspectable in raw-audit surfaces, always labeled
                      &ldquo;{SOURCE_CLASS_META.legacy_detector.label}&rdquo;.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function MarketIntelShell(props: MarketIntelShellProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] font-sans">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Ownership &amp; Coverage</h1>
          <p className="text-[#6B6B60] mt-1 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <MarketIntelShellInner {...props} />
    </Suspense>
  )
}
