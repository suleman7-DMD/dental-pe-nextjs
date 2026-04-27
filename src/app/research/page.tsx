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
  title: 'Research Tools | Dental PE Intelligence',
  description:
    'Deep-dive into specific PE sponsors, platforms, states, or write custom SQL queries.',
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
