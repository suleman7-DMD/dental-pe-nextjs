"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { AlertTriangle, Copy, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  narrativeCacheKey,
  useLaunchpadNarrative,
  type NarrativeResponse,
} from "@/lib/hooks/use-launchpad-narrative"
import type { LaunchpadRankedTarget, LaunchpadTrack } from "@/lib/launchpad/signals"

interface NarrativeCardProps {
  target: LaunchpadRankedTarget
  track: LaunchpadTrack
}

export function NarrativeCard({ target, track }: NarrativeCardProps) {
  const queryClient = useQueryClient()
  const cached = queryClient.getQueryData<NarrativeResponse>(
    narrativeCacheKey(target.npi, track)
  )
  const mutation = useLaunchpadNarrative()
  const [copied, setCopied] = useState(false)

  const narrative = mutation.data?.narrative ?? cached?.narrative ?? null
  const isLoading = mutation.isPending
  const errorMsg = mutation.isError ? mutation.error.error : null

  const onGenerate = () => {
    mutation.mutate({ target, track })
  }

  const onRegenerate = () => {
    queryClient.removeQueries({ queryKey: narrativeCacheKey(target.npi, track) })
    mutation.reset()
    mutation.mutate({ target, track })
  }

  const onCopy = async () => {
    if (!narrative) return
    try {
      await navigator.clipboard.writeText(narrative)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <section
      className="rounded-md border border-[#B8860B]/30 bg-gradient-to-br from-[#FEF9E7] to-[#FFFFFF] p-3"
      aria-label="AI narrative"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#B8860B]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B8860B]">
            Why this practice for you?
          </span>
        </div>
        {narrative && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 text-[10px] text-[#6B6B60] transition-colors hover:border-[#B8860B]/40 hover:text-[#B8860B]"
              aria-label="Copy narrative"
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded border border-[#E8E5DE] bg-[#FFFFFF] px-1.5 py-0.5 text-[10px] text-[#6B6B60] transition-colors hover:border-[#B8860B]/40 hover:text-[#B8860B] disabled:opacity-50"
              aria-label="Regenerate narrative"
            >
              <RotateCcw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              Regenerate
            </button>
          </div>
        )}
      </div>

      {!narrative && !errorMsg && !isLoading && (
        <div className="space-y-2">
          <p className="text-xs text-[#6B6B60]">
            Generate a short, candid take on this practice tuned to your active track — includes one
            concrete next step. Uses Claude Haiku.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#B8860B] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#A67509]"
          >
            <Sparkles className="h-3 w-3" />
            Generate narrative
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-3">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#B8860B]/30 border-t-[#B8860B]" />
          <span className="text-xs text-[#6B6B60]">Drafting your narrative…</span>
        </div>
      )}

      {errorMsg && !isLoading && (
        <div className="flex items-start gap-1.5 rounded border border-[#C23B3B]/30 bg-[#C23B3B]/5 p-2 text-xs text-[#C23B3B]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">Narrative unavailable</p>
            <p className="text-[11px] text-[#6B6B60]">{errorMsg}</p>
            <button
              type="button"
              onClick={onGenerate}
              className="text-[11px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {narrative && !isLoading && (
        <div className="space-y-2 text-sm leading-relaxed text-[#1A1A1A]">
          {narrative.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para.trim()}</p>
          ))}
        </div>
      )}
    </section>
  )
}
