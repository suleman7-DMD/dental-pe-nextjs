"use client"

import { useQuery } from "@tanstack/react-query"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  fetchJobHuntVerificationMap,
  type JobHuntVerificationRecord,
} from "@/lib/supabase/queries/job-hunt-verification"

/**
 * The full job-hunt verification layer keyed by location_id. The table only
 * holds hand-verified rows, so every client consumer (directory, map, drawer)
 * shares this one cached fetch. Returns {} while loading — lanes then fall
 * back to their base (unverified) state, never to a wrong verified state.
 */
export function useJobHuntVerificationMap(): Record<string, JobHuntVerificationRecord> {
  const supabase = getSupabaseBrowserClient()
  const { data } = useQuery({
    queryKey: ["job-hunt-verification-map"],
    queryFn: () => fetchJobHuntVerificationMap(supabase),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  return data ?? {}
}
