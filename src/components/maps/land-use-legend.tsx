'use client'

import { useEffect, useState } from 'react'
import { House, Map, Building2 } from 'lucide-react'
import { LAND_USE_GROUPS, LAND_USE_URL, type LandUseMode } from '@/lib/maps/land-use'
import type { LandUseStatus } from '@/lib/maps/land-use-layer'

const VIEWS = [
  { id: 'full', label: 'Full land use', icon: Map },
  { id: 'homes', label: 'Where people live', icon: House },
  { id: 'sites', label: 'Commercial & medical', icon: Building2 },
] as const

export function LandUseLegend({ mode, onModeChange, status, onRetry }: {
  mode: LandUseMode; onModeChange: (value: LandUseMode) => void; status: LandUseStatus; onRetry: () => void
}) {
  const [coverage, setCoverage] = useState<{ watchedZipCount: number; matchedZctaCount: number; missingZctas: string[] } | null>(null)
  const [coverageError, setCoverageError] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    fetch('/data/land-use/manifest.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('Missing manifest')
      return r.json()
    }).then(setCoverage).catch(() => { if (!abort.signal.aborted) setCoverageError(true) })
    return () => abort.abort()
  }, [])
  const groups = LAND_USE_GROUPS.filter(g => mode === 'full' ||
    (mode === 'homes' ? ['residential', 'mixed'] : ['commercial', 'medical', 'mixed']).includes(g.id))
  return <div className="space-y-3 rounded-lg border border-[#e5deed] bg-[#faf8fc] p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#81718f]">The landscape beneath the dots</div>
        <h3 className="text-sm font-semibold text-[#43384e]">{mode === 'homes' ? 'Find the residential footprint' : mode === 'sites' ? 'Explore existing business locations' : 'Understand the spaces between practices'}</h3>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-[#e5deed] bg-white p-1" role="group" aria-label="Land use view">
        {VIEWS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={mode === id}
          onClick={() => onModeChange(id)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#756287] ${mode === id ? 'bg-[#746083] text-white shadow-sm' : 'text-[#6f6477] hover:bg-[#f3eef7]'}`}>
          <Icon size={14} aria-hidden="true" />{label}
        </button>)}
      </div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Land use colors">
      {groups.map(g => <span key={g.id} className="flex items-center gap-1.5 text-xs text-[#534b59]">
        <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: g.color }} />{g.label}
      </span>)}
    </div>
    <p className="text-xs leading-relaxed text-[#6f6477]">
      {mode === 'homes' ? 'Purple marks housing; rose marks housing mixed with shops. Other uses are hidden in this view. Residential land does not measure occupancy or population density.'
        : mode === 'sites' ? 'Highlights retail, offices, mixed-use and medical land for further investigation. These are existing uses, not available properties or parcels approved for a dental practice.'
        : 'Hover or tap a colored area for its recorded use and facility name. Parks, airports, industry and campuses can help explain gaps; an empty practice map alone does not prove there are no offices.'}
    </p>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e5deed] pt-2 text-[11px] text-[#81718f]">
      <a href={LAND_USE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">CMAP 2023 inventory</a>
      <span>Observed land use · not zoning · conditions may have changed</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-[#756287]" />Tracked-area boundary</span>
      <span aria-live="polite">{status === 'loading' || status === 'idle' ? 'Loading land-use tiles…' : status === 'ready' ? 'Land-use tiles loaded' : status === 'zoomed-out' ? 'Zoom in to see land use (zoom level 7+).' : ''}</span>
    </div>
    <details className="text-[11px] text-[#81718f]">
      <summary className="cursor-pointer">Coverage & interpretation</summary>
      <p className="mt-2 leading-relaxed">Colors are clipped to Census ZIP Code Tabulation Areas (ZCTAs), statistical approximations of postal ZIPs, within CMAP’s seven-county coverage. Blank areas can be outside coverage or have no classified polygon; they do not mean zero residents. Polygons are simplified at regional zoom levels. Use population density for the estimated number of people.</p>
      {coverage && <p className="mt-1">{coverage.matchedZctaCount} of {coverage.watchedZipCount} tracked ZIPs have matching Census boundaries.
        {coverage.missingZctas.length > 0 && <> No boundary was invented for: {coverage.missingZctas.join(', ')}.</>}</p>}
      {coverageError && <p>Boundary coverage metadata is unavailable.</p>}
    </details>
    {status === 'error' && <p role="alert" className="text-xs text-[#a33d4c]">Land-use tiles are unavailable or incomplete. Blank areas do not establish land use. Practice dots remain available.
      {' '}<button type="button" className="font-semibold underline" onClick={onRetry}>Retry land-use layer</button></p>}
  </div>
}
