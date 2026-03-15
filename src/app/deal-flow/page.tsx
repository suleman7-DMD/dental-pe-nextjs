import { createServerClient } from '@/lib/supabase/server'
import { getDealStats } from '@/lib/supabase/queries/deals'
import { DealFlowShell } from './_components/deal-flow-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Deal Flow | Dental PE Intelligence',
  description:
    'Real-time tracking of private equity deal activity in U.S. dentistry -- buyouts, add-ons, recapitalizations, and more.',
}

export default async function DealFlowPage() {
  const supabase = await createServerClient()
  const stats = await getDealStats(supabase)

  return (
    <DealFlowShell
      initialDeals={stats.deals}
      distinctSponsors={stats.distinctSponsors}
      distinctPlatforms={stats.distinctPlatforms}
      distinctStates={stats.distinctStates}
      distinctSpecialties={stats.distinctSpecialties}
      distinctSources={stats.distinctSources}
      distinctTypes={stats.distinctTypes}
    />
  )
}
