"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getLaunchpadBundle } from "@/lib/supabase/queries/launchpad"
import { DEFAULT_LAUNCHPAD_SCOPE, type LaunchpadScope } from "@/lib/launchpad/scope"
import { DEFAULT_LAUNCHPAD_TRACK, type LaunchpadBundle, type LaunchpadTrack } from "@/lib/launchpad/signals"

export interface UseLaunchpadDataOptions {
  scope: LaunchpadScope
  track: LaunchpadTrack
  initialBundle?: LaunchpadBundle | null
}

export function useLaunchpadData(opts: UseLaunchpadDataOptions) {
  const supabase = getSupabaseBrowserClient()

  const isDefaultKey =
    opts.scope === DEFAULT_LAUNCHPAD_SCOPE && opts.track === DEFAULT_LAUNCHPAD_TRACK

  return useQuery({
    queryKey: ["launchpad", opts.scope, opts.track],
    queryFn: () =>
      getLaunchpadBundle({ scope: opts.scope, track: opts.track, supabase }),
    initialData: isDefaultKey && opts.initialBundle != null ? opts.initialBundle : undefined,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
