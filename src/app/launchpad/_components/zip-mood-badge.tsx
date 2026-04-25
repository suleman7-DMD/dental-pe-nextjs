"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ZipMoodRequest,
  ZipMoodResponse,
  ZipContext,
} from "@/lib/launchpad/ai-types"

interface ZipMoodBadgeProps {
  zipCode: string
  zipContext: ZipContext
  zipIntel?: unknown
  practiceStats?: {
    total: number
    mentor_rich_count?: number | null
    dso_density?: number | null
    independent_pct?: number | null
  }
}

const CONFIDENCE_DOT: Record<ZipMoodResponse["confidence"], string> = {
  high: "bg-[#2D8B4E]",
  medium: "bg-[#D4920B]",
  low: "bg-[#C23B3B]",
}

const CONFIDENCE_LABEL: Record<ZipMoodResponse["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
}

async function fetchZipMood(request: ZipMoodRequest): Promise<ZipMoodResponse> {
  const res = await fetch("/api/launchpad/zip-mood", {
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
  return data as ZipMoodResponse
}

export function ZipMoodBadge({
  zipCode,
  zipContext,
  zipIntel,
  practiceStats,
}: ZipMoodBadgeProps) {
  const { data, isFetching, isError, error } = useQuery<ZipMoodResponse, Error>({
    queryKey: ["zip-mood", zipCode] as const,
    queryFn: () =>
      fetchZipMood({
        zip_code: zipCode,
        zip_context: zipContext,
        zip_intel: zipIntel,
        practice_stats: practiceStats,
      }),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  })

  if (isFetching) {
    return (
      <div className="h-5 w-48 animate-pulse rounded-full bg-[#E8E5DE]" aria-label="Loading ZIP mood" />
    )
  }

  if (isError) {
    return (
      <span
        className="group relative inline-flex items-center gap-1 rounded-full border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-2 py-0.5 text-[11px] text-[#C23B3B]"
        title={error?.message ?? "Could not load ZIP mood"}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">ZIP mood unavailable: {error?.message}</span>
        <span aria-hidden="true">Mood unavailable</span>
      </span>
    )
  }

  if (!data) return null

  return (
    <div
      className="inline-flex max-w-[280px] items-start gap-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-2.5 py-1.5"
      title={CONFIDENCE_LABEL[data.confidence]}
    >
      <span
        className={cn(
          "mt-1 h-2 w-2 shrink-0 rounded-full",
          CONFIDENCE_DOT[data.confidence]
        )}
        aria-label={CONFIDENCE_LABEL[data.confidence]}
      />
      <p className="text-[11px] leading-snug text-[#6B6B60]">{data.mood}</p>
    </div>
  )
}
