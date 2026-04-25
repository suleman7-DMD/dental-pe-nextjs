"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getPracticeIntelAvailability } from "@/lib/supabase/queries/intel"

export function useWarroomIntelAvailability(npis: string[]) {
  const supabase = getSupabaseBrowserClient()
  const sortedKey = useMemo(() => {
    if (npis.length === 0) return ""
    return [...npis].sort().join(",")
  }, [npis])

  const query = useQuery<Set<string>>({
    queryKey: ["warroom", "practice-intel-availability", sortedKey],
    queryFn: () => getPracticeIntelAvailability(supabase, npis),
    enabled: npis.length > 0,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  return {
    availability: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
