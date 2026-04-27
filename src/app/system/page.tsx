import { createServerClient } from '@/lib/supabase/server'
import {
  getSourceCoverage,
  getCompletenessMetrics,
  getDealSourceFreshness,
} from '@/lib/supabase/queries/system'
import type { SourceCoverage } from '@/lib/supabase/queries/system'
import { SystemShell } from './_components/system-shell'

export const revalidate = 1800
export const metadata = {
  title: 'System Health | Dental PE Intelligence',
  description:
    'Monitor data freshness, run diagnostics, and manually add data.',
}

export default async function SystemPage() {
  const supabase = await createServerClient()

  const [sourcesRaw, completeness, dealSources] = await Promise.all([
    getSourceCoverage(supabase),
    getCompletenessMetrics(supabase),
    getDealSourceFreshness(supabase),
  ])

  // Transform Record<string, SourceCoverageDetail> to SourceCoverage[].
  // Keep `daysSinceUpdate` null when there's no timestamp — StatusDot reads
  // null as "No data" (gray). Previously this coerced to 0 which rendered
  // green "Current" and hid sources that had never been ingested.
  const sources: SourceCoverage[] = Object.entries(sourcesRaw).map(
    ([source, detail]) => {
      const lastUpdated = detail.lastUpdated || ''
      const daysSinceUpdate = lastUpdated
        ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000)
        : null
      return {
        source,
        records: detail.count,
        dateRange: '',
        lastUpdated,
        daysSinceUpdate,
      }
    }
  )

  return (
    <SystemShell
      initialSources={sources}
      initialCompleteness={completeness}
      initialDealSources={dealSources}
    />
  )
}
