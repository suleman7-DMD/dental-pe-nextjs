"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Brain, ChevronDown, ChevronUp, AlertTriangle, RotateCcw } from "lucide-react"
import type {
  CompoundNarrativeRequest,
  CompoundNarrativeResponse,
  PracticeSnapshot,
  TrackScores,
} from "@/lib/launchpad/ai-types"
import type { LaunchpadTrack } from "@/lib/launchpad/signals"

interface CompoundThesisProps {
  npi: string
  signals: string[]
  scores: TrackScores
  track: LaunchpadTrack
  practice: PracticeSnapshot & { npi: string }
}

async function fetchCompoundThesis(
  request: CompoundNarrativeRequest
): Promise<CompoundNarrativeResponse> {
  const res = await fetch("/api/launchpad/compound-narrative", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as CompoundNarrativeResponse
}

export function CompoundThesis({ npi, signals, scores, track, practice }: CompoundThesisProps) {
  const [expanded, setExpanded] = useState(false)

  const concreteTrack = track === "all" ? "succession" : track

  const queryKey = ["compound-thesis", npi, concreteTrack] as const

  const { data, isFetching, isError, error, refetch } = useQuery<
    CompoundNarrativeResponse,
    Error
  >({
    queryKey,
    queryFn: () =>
      fetchCompoundThesis({
        practice,
        signals,
        scores,
        track: concreteTrack,
      }),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  })

  return (
    <div className="mt-2 border-t border-[#E8E5DE]/60 pt-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
        className="group inline-flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B6B60] group-hover:text-[#1A1A1A]">
          <Brain className="h-3.5 w-3.5 text-[#B8860B]" aria-hidden="true" />
          Show thesis
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-[#9C9C90]" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#9C9C90]" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="relative mt-2">
          {/* AI badge */}
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-[#B8860B]/30 bg-[#B8860B]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#B8860B]">
            <Brain className="h-3 w-3" aria-hidden="true" />
            AI
          </span>

          {isFetching && (
            <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
              <div className="space-y-2">
                <div className="h-3 w-4/5 animate-pulse rounded bg-[#E8E5DE]" />
                <div className="h-3 w-full animate-pulse rounded bg-[#E8E5DE]" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-[#E8E5DE]" />
              </div>
            </div>
          )}

          {isError && !isFetching && (
            <div className="flex items-start gap-1.5 rounded border border-[#C23B3B]/30 bg-[#C23B3B]/5 p-2 text-xs text-[#C23B3B]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1 pr-6">
                <p className="font-medium">Thesis unavailable</p>
                <p className="text-[11px] text-[#6B6B60]">
                  {error?.message ?? "Unknown error"}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void refetch()
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            </div>
          )}

          {data?.thesis && !isFetching && (
            <div className="rounded-md border border-[#B8860B]/20 bg-gradient-to-br from-[#FEF9E7] to-[#FFFFFF] p-3 pr-12">
              <p className="text-[12px] italic leading-relaxed text-[#6B6B60]">
                {data.thesis}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
