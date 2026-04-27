"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Brain,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  FileSearch,
  Clock,
  AlertCircle,
  MessageCircleQuestion,
  ExternalLink,
} from "lucide-react"
import type {
  CompoundNarrativeRequest,
  CompoundNarrativeResponse,
  PracticeSnapshot,
  TrackScores,
  ThesisContradiction,
  ThesisQuestion,
} from "@/lib/launchpad/ai-types"
import type { LaunchpadTrack } from "@/lib/launchpad/signals"
import { safeExternalUrl } from "@/lib/utils/safe-url"
import { LedgerCards } from "./ledger-cards"

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

function AiBadge() {
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-[#B8860B]/30 bg-[#B8860B]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#B8860B]">
      <Brain className="h-3 w-3" aria-hidden="true" />
      AI
    </span>
  )
}

function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
    >
      <RotateCcw className="h-3 w-3" />
      Regenerate
    </button>
  )
}

function ThesisStaleBanner({
  reason,
  intelAgeDays,
}: {
  reason: string | null | undefined
  intelAgeDays: number | null | undefined
}) {
  return (
    <div className="flex items-start gap-1.5 rounded border border-[#D4920B]/30 bg-[#D4920B]/10 px-2 py-1.5 text-[11px] text-[#D4920B]">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold uppercase tracking-wider text-[10px]">Thesis may be stale</p>
        <p className="mt-0.5 text-[11px] text-[#6B6B60]">
          {reason ?? "Underlying intel is older than 180 days."}
          {intelAgeDays != null && reason && !reason.includes("days old")
            ? ` Intel is ${intelAgeDays} days old.`
            : ""}
        </p>
      </div>
    </div>
  )
}

function ContradictionsCard({ contradictions }: { contradictions: ThesisContradiction[] }) {
  if (contradictions.length === 0) return null
  return (
    <div className="rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3 text-[#C23B3B]" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C23B3B]">
          Conflicting signal {contradictions.length === 1 ? "" : `(${contradictions.length})`}
        </p>
      </div>
      <ul className="space-y-1.5">
        {contradictions.map((c, i) => (
          <li key={i} className="text-[11px] text-[#1A1A1A]">
            <span className="font-medium">{c.label}:</span>{" "}
            <span className="text-[#6B6B60]">
              {c.values.map((v, j) => (
                <span key={j}>
                  {j > 0 && <span className="text-[#9C9C90]"> vs </span>}
                  <span>
                    {v.value}{" "}
                    <span className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      [{v.source_label}]
                    </span>
                  </span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OwnerQuestionsCard({ questions }: { questions: ThesisQuestion[] }) {
  if (questions.length === 0) return null
  return (
    <div className="rounded-md border border-[#2563EB]/20 bg-[#2563EB]/5 p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <MessageCircleQuestion className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">
          Ask the owner ({questions.length})
        </p>
      </div>
      <ul className="space-y-1.5">
        {questions.map((q, i) => (
          <li key={i} className="text-[11px] leading-snug text-[#1A1A1A]">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#6B6B60]">
              {q.topic}
            </span>
            <p className="mt-0.5">{q.question}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EvidenceSources({ urls }: { urls: string[] | null | undefined }) {
  const visible = (urls ?? []).slice(0, 8)
  if (visible.length === 0) return null
  return (
    <div className="rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B6B60]">
        Source URLs used by research
      </p>
      <ul className="space-y-1">
        {visible.map((url) => (
          <li key={url}>
            <a
              href={safeExternalUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1 text-[11px] text-[#B8860B] hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResearchAuditCard({
  audit,
}: {
  audit: CompoundNarrativeResponse["research_audit"]
}) {
  if (!audit) return null
  const accepted = audit.status === "source_backed"
  return (
    <div
      className={
        accepted
          ? "rounded-md border border-[#2D8B4E]/25 bg-[#2D8B4E]/5 p-2"
          : "rounded-md border border-[#D4920B]/25 bg-[#D4920B]/5 p-2"
      }
    >
      <p
        className={
          accepted
            ? "text-[10px] font-semibold uppercase tracking-wider text-[#2D8B4E]"
            : "text-[10px] font-semibold uppercase tracking-wider text-[#D4920B]"
        }
      >
        Research audit
      </p>
      <p className="mt-1 text-[11px] text-[#6B6B60]">{audit.reason}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#9C9C90]">
        <span>quality: {audit.verification_quality ?? "missing"}</span>
        <span>searches: {audit.verification_searches ?? 0}</span>
        <span>URLs: {audit.verification_urls.length}</span>
        {audit.research_date && <span>date: {audit.research_date.slice(0, 10)}</span>}
      </div>
    </div>
  )
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

  const isRefused =
    !!data &&
    data.thesis === null &&
    (data.reason === "no_verified_research" || data.reason === "validation_failed")
  const isPartial =
    !!data && !!data.thesis && data.evidence_quality === "partial"
  const isVerified =
    !!data &&
    !!data.thesis &&
    (data.evidence_quality === "verified" || data.evidence_quality === "high")

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
        <div className="mt-2">
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

          {isRefused && data && !isFetching && (
            <div className="space-y-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
              <div className="flex items-center gap-1.5">
                <FileSearch className="h-3.5 w-3.5 text-[#9C9C90]" aria-hidden="true" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B60]">
                  {data.reason === "validation_failed"
                    ? "Thesis withheld — failed numeric audit"
                    : "No source-backed research available"}
                </p>
              </div>
              <ResearchAuditCard audit={data.research_audit} />
              <EvidenceSources urls={data.source_urls} />
              {data.structural_summary && (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div className="flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Entity
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.entity_classification ?? "unclassified"}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Years operating
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.years_in_operation ?? "unknown"}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Providers
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.providers ?? "unknown"}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Employees
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.employees ?? "unknown"}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Buyability
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.buyability_score ?? "unscored"}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Active signals
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.active_signals.length}
                    </dd>
                  </div>
                  <div className="col-span-2 flex flex-col">
                    <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                      Track scores (succession / high-vol / dso)
                    </dt>
                    <dd className="font-medium text-[#1A1A1A]">
                      {data.structural_summary.track_scores.succession} /{" "}
                      {data.structural_summary.track_scores.high_volume} /{" "}
                      {data.structural_summary.track_scores.dso}
                    </dd>
                  </div>
                  {data.structural_summary.active_signals.length > 0 && (
                    <div className="col-span-2 flex flex-col">
                      <dt className="text-[10px] uppercase tracking-wider text-[#9C9C90]">
                        Signals
                      </dt>
                      <dd className="text-[10px] text-[#6B6B60]">
                        {data.structural_summary.active_signals.join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <p className="mt-3 border-t border-[#E8E5DE] pt-2 text-[11px] text-[#9C9C90]">
                {data.reason === "validation_failed"
                  ? "Generated thesis included numeric claims that don't appear in the verified intel. Refused rather than ship unsourced facts."
                  : "Thesis cannot be developed from structural signals or rejected raw research. Run or repair the practice deep-dive before using this as evidence."}
              </p>
              {data.reason === "validation_failed" && (
                <RegenerateButton onClick={() => void refetch()} />
              )}
            </div>
          )}

          {isPartial && data && !isFetching && (
            <div className="space-y-2">
              {data.thesis_stale && (
                <ThesisStaleBanner
                  reason={data.stale_reason}
                  intelAgeDays={data.intel_age_days}
                />
              )}
              <div className="rounded border border-[#D4920B]/30 bg-[#D4920B]/5 px-2 py-1 text-[10px] font-medium text-[#D4920B]">
                Limited evidence — partial verification only.
              </div>
              <div className="relative rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 pr-12">
                <AiBadge />
                <p className="whitespace-pre-line text-[12px] italic leading-relaxed text-[#6B6B60]">
                  {data.thesis}
                </p>
                <RegenerateButton onClick={() => void refetch()} />
              </div>
              <ResearchAuditCard audit={data.research_audit} />
              <EvidenceSources urls={data.source_urls} />
              {data.ledger && data.ledger.length > 0 && <LedgerCards atoms={data.ledger} />}
              {data.contradictions && data.contradictions.length > 0 && (
                <ContradictionsCard contradictions={data.contradictions} />
              )}
              {data.questions && data.questions.length > 0 && (
                <OwnerQuestionsCard questions={data.questions} />
              )}
            </div>
          )}

          {isVerified && data && !isFetching && (
            <div className="space-y-2">
              {data.thesis_stale && (
                <ThesisStaleBanner
                  reason={data.stale_reason}
                  intelAgeDays={data.intel_age_days}
                />
              )}
              <div className="relative rounded-md border border-[#B8860B]/20 bg-gradient-to-br from-[#FEF9E7] to-[#FFFFFF] p-3 pr-12">
                <AiBadge />
                <p className="whitespace-pre-line text-[12px] leading-relaxed text-[#1A1A1A]">
                  {data.thesis}
                </p>
                <RegenerateButton onClick={() => void refetch()} />
              </div>
              <ResearchAuditCard audit={data.research_audit} />
              <EvidenceSources urls={data.source_urls} />
              {data.ledger && data.ledger.length > 0 && <LedgerCards atoms={data.ledger} />}
              {data.contradictions && data.contradictions.length > 0 && (
                <ContradictionsCard contradictions={data.contradictions} />
              )}
              {data.questions && data.questions.length > 0 && (
                <OwnerQuestionsCard questions={data.questions} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
