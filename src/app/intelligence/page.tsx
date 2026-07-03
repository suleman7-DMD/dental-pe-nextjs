import { createServerClient } from '@/lib/supabase/server'
import { getZipIntel, getPracticeIntel, getIntelStats } from '@/lib/supabase/queries/intel'
import { IntelligenceShell } from './_components/intelligence-shell'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = {
  title: 'Research Notes | Chicagoland Directory',
  description:
    'ZIP and practice dossiers for liveness, job-hunt context, and acquisition research.',
}

export default async function IntelligencePage() {
  const supabase = await createServerClient()

  const [zipIntel, practiceIntel, stats, { count: watchedZipCount }] = await Promise.all([
    getZipIntel(supabase),
    getPracticeIntel(supabase),
    getIntelStats(supabase),
    supabase
      .from('watched_zips')
      .select('zip_code', { count: 'exact', head: true })
      .eq('state', 'IL'),
  ])

  return (
    <IntelligenceShell
      initialZipIntel={zipIntel}
      initialPracticeIntel={practiceIntel}
      stats={stats}
      watchedZipCount={watchedZipCount ?? 0}
    />
  )
}
