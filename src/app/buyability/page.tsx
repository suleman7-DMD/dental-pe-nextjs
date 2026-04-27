import { createServerClient } from '@/lib/supabase/server'
import { getBuyabilityPractices } from '@/lib/supabase/queries/practices'
import { getWatchedZips } from '@/lib/supabase/queries/watched-zips'
import { BuyabilityShell } from './_components/buyability-shell'

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: 'Buyability Scanner | Dental PE Intelligence',
  description:
    'Practices scored by acquisition likelihood based on hand research and directory analysis.',
}

export default async function BuyabilityPage() {
  try {
    const supabase = await createServerClient()
    // Restrict to watched ZIPs so the table agrees with every other page.
    // Pre-2026-04-26 this pulled 500 rows globally, ignoring scope entirely.
    const watchedZips = await getWatchedZips(supabase)
    const zips = watchedZips.map((z) => z.zip_code)
    const practices = await getBuyabilityPractices(supabase, { zips })
    return <BuyabilityShell initialPractices={practices} />
  } catch (error) {
    console.error('BuyabilityPage error:', error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAFAF7] text-[#1A1A1A]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Buyability Scanner</h1>
          <p className="text-[#6B6B60]">Data is loading. Please refresh in a moment.</p>
          <p className="text-[#707064] text-sm mt-4">
            Error: {error instanceof Error ? error.message : 'Unknown'}
          </p>
        </div>
      </div>
    )
  }
}
