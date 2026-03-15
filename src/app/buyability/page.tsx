import { createServerClient } from '@/lib/supabase/server'
import { getBuyabilityPractices } from '@/lib/supabase/queries/practices'
import { BuyabilityShell } from './_components/buyability-shell'

export const metadata = {
  title: 'Buyability Scanner | Dental PE Intelligence',
  description:
    'Practices scored by acquisition likelihood based on hand research and directory analysis.',
}

export default async function BuyabilityPage() {
  const supabase = await createServerClient()

  const practices = await getBuyabilityPractices(supabase)

  return <BuyabilityShell initialPractices={practices} />
}
