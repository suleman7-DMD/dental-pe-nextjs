import { createServerClient } from '@/lib/supabase/server'
import {
  getDistinctSponsors,
  getDistinctPlatforms,
  getDistinctStates,
} from '@/lib/supabase/queries/deals'
import { ResearchShell } from './_components/research-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: 'Evidence | Chicagoland Census',
  description:
    'Sponsor, platform, market, and SQL evidence used to support ownership-tree claims.',
}

export default async function ResearchPage() {
  const supabase = await createServerClient()

  const [sponsors, platforms, states] = await Promise.all([
    getDistinctSponsors(supabase),
    getDistinctPlatforms(supabase),
    getDistinctStates(supabase),
  ])

  return (
    <ResearchShell
      sponsors={sponsors}
      platforms={platforms}
      states={states}
    />
  )
}
