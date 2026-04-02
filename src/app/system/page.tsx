import { createServerClient } from '@/lib/supabase/server'
import { getSourceCoverage, getCompletenessMetrics } from '@/lib/supabase/queries/system'
import type { SourceCoverage } from '@/lib/supabase/queries/system'
import { SystemShell } from './_components/system-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'System Health | Dental PE Intelligence',
  description:
    'Monitor data freshness, run diagnostics, and manually add data.',
}

export default async function SystemPage() {
  const supabase = await createServerClient()

  const [sourcesRaw, completeness] = await Promise.all([
    getSourceCoverage(supabase),
    getCompletenessMetrics(supabase),
  ])

  // Transform Record<string, SourceCoverageDetail> to SourceCoverage[]
  const sources: SourceCoverage[] = Object.entries(sourcesRaw).map(
    ([source, detail]) => {
      const lastUpdated = detail.lastUpdated || '';
      const daysSinceUpdate = lastUpdated
        ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000)
        : 0;
      return {
        source,
        records: detail.count,
        dateRange: '',
        lastUpdated,
        daysSinceUpdate,
      };
    }
  )

  return (
    <SystemShell
      initialSources={sources}
      initialCompleteness={completeness}
    />
  )
}
