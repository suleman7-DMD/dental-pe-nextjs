"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  InterviewPrepRequest,
  InterviewPrepResponse,
  InterviewCategory,
  PracticeSnapshot,
  IntelContext,
} from "@/lib/launchpad/ai-types"
import type { LaunchpadTrack } from "@/lib/launchpad/signals"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterviewPrepAiError {
  error: string
  status: number
}

interface InterviewPrepAiProps {
  npi: string
  practiceSnapshot: PracticeSnapshot
  signals: string[]
  intel?: IntelContext | null
  track: LaunchpadTrack
}

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

function interviewPrepKey(npi: string, track: LaunchpadTrack) {
  return ["interview-prep", npi, track] as const
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchInterviewPrep(
  npi: string,
  practiceSnapshot: PracticeSnapshot,
  signals: string[],
  intel: IntelContext | null | undefined,
  track: LaunchpadTrack
): Promise<InterviewPrepResponse> {
  const concreteTrack =
    track === "all" ? "succession" : track

  const requestBody: InterviewPrepRequest = {
    practice: {
      npi,
      name: practiceSnapshot.name,
      dba: practiceSnapshot.dba,
      entity_classification: practiceSnapshot.entity_classification,
      city: practiceSnapshot.city,
      state: practiceSnapshot.state,
      zip: practiceSnapshot.zip,
      year_established: practiceSnapshot.year_established,
      employee_count: practiceSnapshot.employee_count,
      num_providers: practiceSnapshot.num_providers,
      estimated_revenue: practiceSnapshot.estimated_revenue,
      buyability_score: practiceSnapshot.buyability_score,
      website: practiceSnapshot.website,
      affiliated_dso: practiceSnapshot.affiliated_dso,
      dso_tier: practiceSnapshot.dso_tier,
      ownership_status: practiceSnapshot.ownership_status,
      classification_confidence: practiceSnapshot.classification_confidence,
    },
    signals,
    intel: intel ?? null,
    track: concreteTrack,
  }

  const res = await fetch("/api/launchpad/interview-prep", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    const err: InterviewPrepAiError = { error: msg, status: res.status }
    throw err
  }
  return data as InterviewPrepResponse
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategorySection({ category }: { category: InterviewCategory }) {
  return (
    <section>
      <h4 className="mb-3 border-b border-[#E8E5DE] pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90]">
        {category.name}
      </h4>
      <ol className="space-y-4">
        {category.questions.map((q, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-[#B8860B]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#1A1A1A]">{q.q}</p>
              <p className="text-xs italic text-[#9C9C90]">
                <span className="not-italic font-medium text-[#6B6B60]">Listen for:</span>{" "}
                {q.listenFor}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function SkeletonQuestion() {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-4 w-6 shrink-0 animate-pulse rounded bg-[#E8E5DE]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-full animate-pulse rounded bg-[#E8E5DE]" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-[#E8E5DE]" />
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((section) => (
        <div key={section} className="space-y-4">
          <div className="h-3 w-2/5 animate-pulse rounded bg-[#E8E5DE]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonQuestion key={i} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InterviewPrepAi({
  npi,
  practiceSnapshot,
  signals,
  intel,
  track,
}: InterviewPrepAiProps) {
  const queryClient = useQueryClient()
  const cacheKey = interviewPrepKey(npi, track)

  const { data, isLoading, isError, error, refetch } = useQuery<
    InterviewPrepResponse,
    InterviewPrepAiError
  >({
    queryKey: cacheKey,
    queryFn: () => fetchInterviewPrep(npi, practiceSnapshot, signals, intel, track),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  })

  const totalQuestions = data?.categories.reduce(
    (sum, c) => sum + c.questions.length,
    0
  ) ?? 0

  function handleRegenerate() {
    queryClient.removeQueries({ queryKey: cacheKey })
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        {data ? (
          <p className="text-xs text-[#9C9C90]">
            {totalQuestions} questions · AI-generated · tailored to this practice
          </p>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-[#9C9C90]">
            <Sparkles className="h-3.5 w-3.5 text-[#B8860B]" />
            <span>Generating AI interview prep…</span>
          </div>
        )}

        {data && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-2.5 py-1",
              "text-xs font-medium text-[#6B6B60] transition-colors",
              "hover:border-[#B8860B] hover:text-[#B8860B]",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <RotateCcw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Regenerate
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <LoadingSkeleton />}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="flex items-start gap-2 rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C23B3B]" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#C23B3B]">
              Interview prep unavailable
            </p>
            <p className="text-[11px] text-[#6B6B60]">
              {error?.error ?? "Failed to generate questions — check API key and connection."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-[11px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Categories */}
      {data && !isLoading && (
        <div className="space-y-6">
          {data.categories.map((category) => (
            <CategorySection key={category.name} category={category} />
          ))}

          {/* Attribution */}
          <div className="flex items-center gap-1.5 border-t border-[#E8E5DE] pt-3">
            <Sparkles className="h-3 w-3 text-[#B8860B]" />
            <span className="text-[10px] text-[#9C9C90]">
              Powered by claude-haiku-4-5 · cached per practice + track
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
