"use client"

import { useState, useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Brain,
  CheckSquare,
  Square,
  AlertTriangle,
  Star,
  ShieldAlert,
  HelpCircle,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type {
  SmartBriefingRequest,
  SmartBriefingResponse,
  SmartBriefingPractice,
  SmartBriefingPracticeResult,
} from "@/lib/launchpad/ai-types"
import type { LaunchpadBundle, LaunchpadRankedTarget, LaunchpadTrack } from "@/lib/launchpad/signals"
import { resolveDsoTierEntry, DSO_TIER_LABELS } from "@/lib/launchpad/dso-tiers"
import { getPracticeDisplayName } from "@/lib/launchpad/display"

const MAX_SELECTED = 5

interface SmartBriefingBuilderProps {
  pinnedNpis: string[]
  bundle: LaunchpadBundle | null
  track: LaunchpadTrack
}

function buildBriefingPractice(
  target: LaunchpadRankedTarget
): SmartBriefingPractice {
  const { practice, trackScores, activeSignalIds, warningSignalIds, intel } = target

  const dsoEntry = practice.affiliated_dso
    ? resolveDsoTierEntry(
        practice.affiliated_dso,
        practice.parent_company,
        practice.franchise_name
      )
    : null

  return {
    npi: target.npi,
    snapshot: {
      name: getPracticeDisplayName(practice),
      dba: practice.doing_business_as,
      entity_classification: practice.entity_classification,
      city: practice.city,
      state: practice.state,
      zip: practice.zip,
      year_established: practice.year_established,
      employee_count: practice.employee_count,
      num_providers: practice.num_providers,
      estimated_revenue: practice.estimated_revenue,
      buyability_score: practice.buyability_score,
      website: practice.website,
      affiliated_dso: practice.affiliated_dso,
      dso_tier: dsoEntry ? DSO_TIER_LABELS[dsoEntry.tier] : null,
      ownership_status: practice.ownership_status,
      classification_confidence: practice.classification_confidence,
    },
    signals: [...activeSignalIds, ...warningSignalIds],
    scores: {
      succession: Math.round(trackScores.succession.score),
      high_volume: Math.round(trackScores.high_volume.score),
      dso: Math.round(trackScores.dso.score),
    },
    intel: intel
      ? {
          overall_assessment: intel.overall_assessment,
          acquisition_readiness: intel.acquisition_readiness,
          confidence: intel.confidence,
          green_flags: intel.green_flags,
          red_flags: intel.red_flags,
        }
      : null,
  }
}

async function fetchSmartBriefing(
  request: SmartBriefingRequest
): Promise<SmartBriefingResponse> {
  const res = await fetch("/api/launchpad/smart-briefing", {
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
  return data as SmartBriefingResponse
}

function PracticeResultCard({
  result,
  isTopPick,
}: {
  result: SmartBriefingPracticeResult
  isTopPick: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-[#FFFFFF] p-4",
        isTopPick ? "border-[#B8860B]/50 shadow-sm" : "border-[#E8E5DE]"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="font-sans text-sm font-bold leading-snug text-[#1A1A1A]">
          {result.name}
        </p>
        {isTopPick && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#B8860B]/40 bg-[#B8860B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#B8860B]">
            <Trophy className="h-3 w-3" />
            Top pick
          </span>
        )}
      </div>

      {result.strengths.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#2D8B4E]">
            <Star className="h-3 w-3" />
            Strengths
          </p>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#1A1A1A]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2D8B4E]" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.risks.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#C23B3B]">
            <ShieldAlert className="h-3 w-3" />
            Risks
          </p>
          <ul className="space-y-1">
            {result.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#1A1A1A]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C23B3B]" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.questions.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#D4920B]">
            <HelpCircle className="h-3 w-3" />
            Ask in interview
          </p>
          <ul className="space-y-1">
            {result.questions.map((q, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#1A1A1A]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4920B]" />
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SmartBriefingBuilder({
  pinnedNpis,
  bundle,
  track,
}: SmartBriefingBuilderProps) {
  const [open, setOpen] = useState(false)
  const [selectedNpis, setSelectedNpis] = useState<Set<string>>(new Set())

  // Map pinned NPIs to their ranked target objects
  const pinnedTargets = useMemo(() => {
    if (!bundle) return []
    return pinnedNpis
      .map((npi) => bundle.rankedTargets.find((t) => t.npi === npi))
      .filter((t): t is LaunchpadRankedTarget => t !== undefined)
  }, [pinnedNpis, bundle])

  const canOpen = pinnedNpis.length >= 2

  const handleOpen = () => {
    // Default: all selected (up to MAX_SELECTED)
    setSelectedNpis(new Set(pinnedNpis.slice(0, MAX_SELECTED)))
    setOpen(true)
  }

  const toggleNpi = (npi: string) => {
    setSelectedNpis((prev) => {
      const next = new Set(prev)
      if (next.has(npi)) {
        next.delete(npi)
      } else if (next.size < MAX_SELECTED) {
        next.add(npi)
      }
      return next
    })
  }

  const mutation = useMutation<SmartBriefingResponse, Error, SmartBriefingRequest>({
    mutationFn: fetchSmartBriefing,
  })

  const handleGenerate = () => {
    if (selectedNpis.size < 2) return
    const practices = pinnedTargets
      .filter((t) => selectedNpis.has(t.npi))
      .map((t) => buildBriefingPractice(t))

    mutation.mutate({ practices, track: track === "all" ? "succession" : track })
  }

  const handleClose = () => {
    setOpen(false)
    mutation.reset()
  }

  const topNpi = mutation.data?.recommendation?.top_npi ?? null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canOpen}
        onClick={handleOpen}
        className={cn(
          "h-9 gap-1.5 border-[#E8E5DE] text-[#1A1A1A] hover:bg-[#F7F7F4]",
          !canOpen && "opacity-50"
        )}
        title={canOpen ? "Compare pinned targets" : "Pin at least 2 practices to use Smart Briefing"}
      >
        <Brain className="h-3.5 w-3.5 text-[#B8860B]" />
        Smart Briefing
        {canOpen && (
          <span className="ml-1 rounded-full bg-[#B8860B]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#B8860B]">
            {pinnedNpis.length}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-[720px]"
        >
          <SheetHeader className="space-y-2 border-b border-[#E8E5DE] bg-[#FAFAF7] p-5">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-[#B8860B]" />
              <SheetTitle className="font-sans text-xl font-bold text-[#1A1A1A]">
                Smart Briefing
              </SheetTitle>
            </div>
            <SheetDescription className="text-[12px] text-[#6B6B60]">
              Compare your pinned targets. Sonnet analyzes each practice and recommends your top pick.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {/* Practice selector */}
            {!mutation.data && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
                    Select practices to compare (2–{MAX_SELECTED})
                  </p>
                  <ul className="space-y-2">
                    {pinnedTargets.map((target) => {
                      const checked = selectedNpis.has(target.npi)
                      const displayName = getPracticeDisplayName(target.practice)
                      const canToggle = checked || selectedNpis.size < MAX_SELECTED
                      return (
                        <li key={target.npi}>
                          <button
                            type="button"
                            disabled={!canToggle}
                            onClick={() => toggleNpi(target.npi)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                              checked
                                ? "border-[#B8860B]/40 bg-[#B8860B]/5"
                                : "border-[#E8E5DE] bg-[#FFFFFF] hover:border-[#D4D0C8] hover:bg-[#FAFAF7]",
                              !canToggle && "cursor-not-allowed opacity-50"
                            )}
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-[#B8860B]" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-[#9C9C90]" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                                {displayName}
                              </p>
                              <p className="text-[11px] text-[#6B6B60]">
                                {[target.practice.city, target.practice.state]
                                  .filter(Boolean)
                                  .join(", ") || "Unknown location"}
                                {" · "}
                                Score{" "}
                                <span className="font-mono font-semibold">
                                  {Math.round(target.displayScore)}
                                </span>
                              </p>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Generate button */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    disabled={selectedNpis.size < 2 || mutation.isPending}
                    onClick={handleGenerate}
                    className="gap-2 bg-[#B8860B] text-white hover:bg-[#A67509] disabled:opacity-50"
                  >
                    <Brain className="h-4 w-4" />
                    {mutation.isPending ? "Analyzing…" : "Generate briefing"}
                  </Button>
                  {selectedNpis.size < 2 && (
                    <p className="text-[12px] text-[#9C9C90]">
                      Select at least 2 practices
                    </p>
                  )}
                </div>

                {/* Progress message */}
                {mutation.isPending && (
                  <div className="flex items-center gap-2 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/5 px-4 py-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#B8860B]/30 border-t-[#B8860B]" />
                    <p className="text-[13px] text-[#6B6B60]">
                      Sonnet is analyzing your practices… this may take 3–8 seconds.
                    </p>
                  </div>
                )}

                {/* Error */}
                {mutation.isError && (
                  <div className="flex items-start gap-2 rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C23B3B]" />
                    <div className="space-y-1">
                      <p className="font-semibold text-[#C23B3B]">Briefing failed</p>
                      <p className="text-[12px] text-[#6B6B60]">
                        {mutation.error?.message ?? "Unknown error"}
                      </p>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="text-[12px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {mutation.data && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
                    Analysis results
                  </p>
                  <button
                    type="button"
                    onClick={() => mutation.reset()}
                    className="text-[12px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
                  >
                    Regenerate
                  </button>
                </div>

                {/* Practice cards */}
                <div className="space-y-4">
                  {mutation.data.practices.map((result) => (
                    <PracticeResultCard
                      key={result.npi}
                      result={result}
                      isTopPick={result.npi === topNpi}
                    />
                  ))}
                </div>

                {/* Recommendation footer */}
                {mutation.data.recommendation && (
                  <div className="rounded-lg border border-[#B8860B]/40 bg-gradient-to-br from-[#FEF9E7] to-[#FFFFFF] p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B8860B]">
                      <Trophy className="h-3.5 w-3.5" />
                      Recommendation
                    </p>
                    <p className="text-sm font-bold text-[#1A1A1A]">
                      Top pick:{" "}
                      {mutation.data.practices.find(
                        (p) => p.npi === mutation.data?.recommendation.top_npi
                      )?.name ?? mutation.data.recommendation.top_npi}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B60]">
                      {mutation.data.recommendation.rationale}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
