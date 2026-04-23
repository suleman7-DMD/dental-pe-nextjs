import { createServerClient } from '@/lib/supabase/server'
import { getDealStats } from '@/lib/supabase/queries/deals'
import { getDealSourceFreshness } from '@/lib/supabase/queries/system'
import { DealFlowShell } from './_components/deal-flow-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Deal Flow | Dental PE Intelligence',
  description:
    'Real-time tracking of private equity deal activity in U.S. dentistry -- buyouts, add-ons, recapitalizations, and more.',
}

export default async function DealFlowPage() {
  const supabase = await createServerClient()
  const [stats, dealSources] = await Promise.all([
    getDealStats(supabase),
    getDealSourceFreshness(supabase),
  ])

  // Latest ingest timestamp across the 4 deal sources — surfaces "is data fresh"
  // directly on the page instead of forcing users to bounce to /system.
  const ingestTimestamps = Object.values(dealSources)
    .map((s) => s.lastIngestDate)
    .filter((t): t is string => t != null)
  const lastSourceCheck =
    ingestTimestamps.length > 0
      ? ingestTimestamps.reduce((a, b) => (a > b ? a : b))
      : null

  return (
    <DealFlowShell
      initialDeals={stats.deals}
      distinctSponsors={stats.distinctSponsors}
      distinctPlatforms={stats.distinctPlatforms}
      distinctStates={stats.distinctStates}
      distinctSpecialties={stats.distinctSpecialties}
      distinctSources={stats.distinctSources}
      distinctTypes={stats.distinctTypes}
      lastSourceCheck={lastSourceCheck}
    />
  )
}
