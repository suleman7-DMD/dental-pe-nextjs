"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  LAUNCHPAD_SIGNALS,
  type LaunchpadRankedTarget,
  type LaunchpadTrack,
} from "@/lib/launchpad/signals"
import { resolveDsoTierEntry, DSO_TIER_LABELS } from "@/lib/launchpad/dso-tiers"

export interface NarrativeResponse {
  narrative: string
  model: string
  npi: string
  track: string
}

export interface NarrativeError {
  error: string
  status: number
}

function buildRequestBody(target: LaunchpadRankedTarget, track: LaunchpadTrack) {
  const { practice, zipScore, trackScores, commutable } = target

  const active: Array<{ id: string; label: string }> = target.activeSignalIds
    .map((id) => {
      const def = LAUNCHPAD_SIGNALS[id]
      return def ? { id: id as string, label: def.label } : null
    })
    .filter((x): x is { id: string; label: string } => x !== null)

  const warnings: Array<{ id: string; label: string }> = target.warningSignalIds
    .map((id) => {
      const def = LAUNCHPAD_SIGNALS[id]
      return def ? { id: id as string, label: def.label } : null
    })
    .filter((x): x is { id: string; label: string } => x !== null)

  const dsoEntry = practice.affiliated_dso
    ? resolveDsoTierEntry(
        practice.affiliated_dso,
        practice.parent_company,
        practice.franchise_name
      )
    : null

  return {
    npi: target.npi,
    track,
    practice: {
      name: practice.practice_name ?? practice.doing_business_as ?? `NPI ${target.npi}`,
      dba: practice.doing_business_as,
      entity_classification: practice.entity_classification,
      city: practice.city,
      state: practice.state,
      zip: practice.zip,
      year_established: practice.year_established,
      employee_count: practice.employee_count,
      num_providers: practice.num_providers,
      buyability_score: practice.buyability_score,
      website: practice.website,
      affiliated_dso: practice.affiliated_dso,
      dso_tier: dsoEntry ? DSO_TIER_LABELS[dsoEntry.tier] : null,
    },
    scores: {
      display: Math.round(target.displayScore),
      display_tier: target.displayTier,
      best_track: target.bestTrack,
      succession: Math.round(trackScores.succession.score),
      high_volume: Math.round(trackScores.high_volume.score),
      dso: Math.round(trackScores.dso.score),
      confidence_capped: trackScores[target.bestTrack].confidenceCapped,
    },
    signals: { active, warnings },
    zip_context: {
      metro: zipScore?.metro_area ?? null,
      market_type: zipScore?.market_type ?? null,
      corporate_share_pct: zipScore?.corporate_share_pct ?? null,
      dld_gp_per_10k: zipScore?.dld_gp_per_10k ?? null,
      commutable,
      metrics_confidence: zipScore?.metrics_confidence ?? null,
    },
  }
}

async function fetchNarrative(
  target: LaunchpadRankedTarget,
  track: LaunchpadTrack
): Promise<NarrativeResponse> {
  const body = buildRequestBody(target, track)
  const res = await fetch("/api/launchpad/narrative", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    const err: NarrativeError = { error: msg, status: res.status }
    throw err
  }
  return data as NarrativeResponse
}

export function narrativeCacheKey(npi: string, track: LaunchpadTrack) {
  return ["launchpad-narrative", npi, track] as const
}

export function useLaunchpadNarrative() {
  const queryClient = useQueryClient()

  return useMutation<
    NarrativeResponse,
    NarrativeError,
    { target: LaunchpadRankedTarget; track: LaunchpadTrack }
  >({
    mutationFn: ({ target, track }) => fetchNarrative(target, track),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        narrativeCacheKey(vars.target.npi, vars.track),
        data
      )
    },
  })
}

export function useCachedNarrative(
  npi: string | null,
  track: LaunchpadTrack
): NarrativeResponse | null {
  const queryClient = useQueryClient()
  if (!npi) return null
  const cached = queryClient.getQueryData<NarrativeResponse>(
    narrativeCacheKey(npi, track)
  )
  return cached ?? null
}
