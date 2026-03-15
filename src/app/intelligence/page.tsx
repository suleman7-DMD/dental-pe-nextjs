import { createServerClient } from '@/lib/supabase/server'
import { getZipIntel, getPracticeIntel, getIntelStats } from '@/lib/supabase/queries/intel'
import { IntelligenceShell } from './_components/intelligence-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Intelligence | Dental PE Intelligence',
  description:
    'AI-powered qualitative research — ZIP-level market signals, practice-level due diligence, and acquisition readiness scoring.',
}

export default async function IntelligencePage() {
  const supabase = createServerClient()

  const [zipIntel, practiceIntel, stats] = await Promise.all([
    getZipIntel(supabase),
    getPracticeIntel(supabase),
    getIntelStats(supabase),
  ])

  const { count: watchedZipCount } = await supabase
    .from('watched_zips')
    .select('*', { count: 'exact', head: true })

  return (
    <IntelligenceShell
      initialZipIntel={zipIntel}
      initialPracticeIntel={practiceIntel}
      stats={stats}
      watchedZipCount={watchedZipCount ?? 0}
    />
  )
}
