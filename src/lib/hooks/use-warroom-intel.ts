"use client"

import { useQuery } from "@tanstack/react-query"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  getPracticeIntelByNpi,
  getZipIntelByZip,
  type PracticeIntel,
  type ZipQualitativeIntel,
} from "@/lib/supabase/queries/intel"

export function usePracticeIntel(npi: string | null | undefined) {
  const supabase = getSupabaseBrowserClient()
  const enabled = typeof npi === "string" && npi.length > 0

  return useQuery<PracticeIntel | null>({
    queryKey: ["warroom", "practice-intel", npi],
    queryFn: () => getPracticeIntelByNpi(supabase, npi as string),
    enabled,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export function useZipIntel(zipCode: string | null | undefined) {
  const supabase = getSupabaseBrowserClient()
  const enabled = typeof zipCode === "string" && /^\d{5}$/.test(zipCode)

  return useQuery<ZipQualitativeIntel | null>({
    queryKey: ["warroom", "zip-intel", zipCode],
    queryFn: () => getZipIntelByZip(supabase, zipCode as string),
    enabled,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
