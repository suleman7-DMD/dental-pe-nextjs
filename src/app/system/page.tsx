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

  // Transform Record<string, number> to SourceCoverage[]
  const sources: SourceCoverage[] = Object.entries(sourcesRaw).map(
    ([source, records]) => ({
      source,
      records,
      dateRange: '',
      lastUpdated: '',
      daysSinceUpdate: 0,
    })
  )

  return (
    <SystemShell
      initialSources={sources}
      initialCompleteness={completeness}
    />
  )
}
