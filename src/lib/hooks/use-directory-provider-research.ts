'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { fetchAllRowsStable } from '@/lib/supabase/queries/stable-pagination'
import type { ProviderResearch, ProviderResearchMap } from '@/lib/utils/directory-evidence'

/** Lightweight existing dossiers, all pages. No new research or database writes. */
export function useDirectoryProviderResearch(enabled: boolean) {
  const supabase = getSupabaseBrowserClient()
  return useQuery({
    queryKey: ['directory-provider-research'], enabled,
    queryFn: async (): Promise<ProviderResearchMap> => {
      const rows = await fetchAllRowsStable<ProviderResearch>({
        fetchPage: (from, to) => supabase.from('practice_intel')
          .select('npi,research_date,verification_quality,verification_urls,website_url,services_listed,provider_notes')
          .in('verification_quality', ['verified', 'partial']).order('npi').range(from, to),
        keyOf: r => r.npi,
      })
      return Object.fromEntries(rows.map(r => [r.npi, r]))
    },
    staleTime: 5 * 60 * 1000, retry: 1,
  })
}
