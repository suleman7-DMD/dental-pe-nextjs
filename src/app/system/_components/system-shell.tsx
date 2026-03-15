'use client'

import { SectionHeader } from '@/components/data-display/section-header'
import { DataCoverage } from './data-coverage'
import { FreshnessIndicators } from './freshness-indicators'
import { CompletenessBars } from './completeness-bars'
import { PipelineLogViewer } from './pipeline-log-viewer'
import { ManualEntryForms } from './manual-entry-forms'
import type { SourceCoverage, CompletenessMetric } from '@/lib/supabase/queries/system'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface SystemShellProps {
  initialSources: SourceCoverage[]
  initialCompleteness: CompletenessMetric[]
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function SystemShell({ initialSources, initialCompleteness }: SystemShellProps) {
  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      <div className="px-6 py-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#F8FAFC]">
            System Health
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1 max-w-3xl">
            Monitor data freshness, run diagnostics, and manually add data. Green = data is fresh
            (updated within 7 days). Yellow = stale (7-30 days). Red = outdated (30+ days).
          </p>
        </div>

        {/* Data Source Coverage */}
        <section>
          <SectionHeader
            title="Data Source Coverage"
            description="Each row shows a data source and its freshness. PESP = PE research firm scraper. GDN = dental news scraper. PitchBook = PE deal database. NPPES = CMS national provider registry. ADSO = American Dental Support Organizations member scraper. ADA HPI = official benchmark data."
          />
          <DataCoverage sources={initialSources} />
        </section>

        {/* Data Freshness Timestamps */}
        <section>
          <SectionHeader
            title="Data Freshness Timestamps"
            description="When each major data source was last imported or refreshed."
          />
          <FreshnessIndicators sources={initialSources} />
        </section>

        {/* Data Completeness */}
        <section>
          <SectionHeader
            title="Data Completeness"
            description="How complete your data is across key fields. Green = 80%+ filled. Yellow = 50-80%. Red = under 50%. Deals with PE sponsor = % of deals where we know the PE firm. Practices classified = % where ownership is known."
          />
          <CompletenessBars metrics={initialCompleteness} />
        </section>

        {/* Pipeline Activity Log */}
        <section>
          <SectionHeader
            title="Pipeline Activity Log"
            description="Timestamped record of every automated scraper and pipeline run. Shows what ran, what changed, and whether it succeeded. Events are logged by each scraper in the refresh pipeline."
          />
          <PipelineLogViewer />
        </section>

        {/* Manual Data Entry */}
        <section>
          <SectionHeader
            title="Manual Data Entry"
            description="Manually add deals from press releases, update practice ownership when you learn new info, or add new ZIP codes to monitor. All manual entries are tracked with source='manual'."
          />
          <ManualEntryForms />
        </section>
      </div>
    </div>
  )
}
