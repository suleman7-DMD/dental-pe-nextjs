import { createServerClient } from '@/lib/supabase/server'
import { getBuyabilityPractices } from '@/lib/supabase/queries/practices'
import { BuyabilityShell } from './_components/buyability-shell'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Buyability Scanner | Dental PE Intelligence',
  description:
    'Practices scored by acquisition likelihood based on hand research and directory analysis.',
}

export default async function BuyabilityPage() {
  try {
    const supabase = await createServerClient()
    const practices = await getBuyabilityPractices(supabase)
    return <BuyabilityShell initialPractices={practices} />
  } catch (error) {
    console.error('BuyabilityPage error:', error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0F1E] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Buyability Scanner</h1>
          <p className="text-gray-400">Data is loading. Please refresh in a moment.</p>
          <p className="text-gray-600 text-sm mt-4">
            Error: {error instanceof Error ? error.message : 'Unknown'}
          </p>
        </div>
      </div>
    )
  }
}
