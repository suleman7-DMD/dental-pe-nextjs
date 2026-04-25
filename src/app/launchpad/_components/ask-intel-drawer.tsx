"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { AlertTriangle, Brain, MessageCircle, RotateCcw, Send } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  AskIntelRequest,
  AskIntelResponse,
  PracticeSnapshot,
  ZipContext,
  IntelContext,
} from "@/lib/launchpad/ai-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskIntelError {
  error: string
  status: number
}

interface AskIntelDrawerProps {
  open: boolean
  onClose: () => void
  npi: string
  practiceSnapshot: PracticeSnapshot
  zipContext?: ZipContext | null
  intelContext?: IntelContext | null
}

// ---------------------------------------------------------------------------
// Starter question chips
// ---------------------------------------------------------------------------

const STARTER_QUESTIONS = [
  "What's the succession risk here?",
  "Should I worry about non-competes?",
  "How does this compare to industry comp?",
]

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchAskIntel(
  request: AskIntelRequest
): Promise<AskIntelResponse> {
  const res = await fetch("/api/launchpad/ask", {
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
    const err: AskIntelError = { error: msg, status: res.status }
    throw err
  }
  return data as AskIntelResponse
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AskIntelDrawer({
  open,
  onClose,
  npi,
  practiceSnapshot,
  zipContext,
  intelContext,
}: AskIntelDrawerProps) {
  const [question, setQuestion] = useState("")
  const [submittedQuestion, setSubmittedQuestion] = useState("")

  const mutation = useMutation<AskIntelResponse, AskIntelError, string>({
    mutationFn: (q: string) =>
      fetchAskIntel({
        question: q,
        npi,
        practice_snapshot: practiceSnapshot,
        zip_context: zipContext ?? undefined,
        intel_context: intelContext ?? undefined,
      }),
  })

  const isLoading = mutation.isPending
  const answer = mutation.data?.answer ?? null
  const model = mutation.data?.model ?? null
  const errorMsg = mutation.isError ? mutation.error.error : null

  function handleSubmit(q: string) {
    const trimmed = q.trim()
    if (!trimmed || isLoading) return
    setSubmittedQuestion(trimmed)
    mutation.reset()
    mutation.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(question)
    }
  }

  function handleRetry() {
    if (submittedQuestion) {
      mutation.reset()
      mutation.mutate(submittedQuestion)
    }
  }

  const canSubmit = question.trim().length > 0 && !isLoading

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-[480px]"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-[#E8E5DE] bg-[#FAFAF7] px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#B8860B]" />
            <SheetTitle className="text-base font-semibold text-[#1A1A1A]">
              Ask Intel
            </SheetTitle>
          </div>
          <p className="mt-0.5 text-xs text-[#9C9C90]">
            Ask anything about{" "}
            <span className="font-medium text-[#6B6B60]">
              {practiceSnapshot.name}
            </span>{" "}
            — powered by Claude Haiku
          </p>
        </SheetHeader>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Starter question chips */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90]">
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuestion(q)
                    handleSubmit(q)
                  }}
                  disabled={isLoading}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DE] bg-[#FAFAF7] px-3 py-1 text-xs text-[#6B6B60] transition-colors",
                    "hover:border-[#B8860B]/40 hover:bg-[#B8860B]/5 hover:text-[#B8860B]",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <MessageCircle className="h-3 w-3 shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Answer area */}
          {(isLoading || answer || errorMsg) && (
            <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
              {/* Question echo */}
              {submittedQuestion && (
                <p className="mb-2 text-xs font-medium text-[#9C9C90]">
                  Q: {submittedQuestion}
                </p>
              )}

              {/* Loading skeleton */}
              {isLoading && (
                <div className="space-y-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#E8E5DE]" />
                  <div className="h-3.5 w-full animate-pulse rounded bg-[#E8E5DE]" />
                  <div className="h-3.5 w-5/6 animate-pulse rounded bg-[#E8E5DE]" />
                </div>
              )}

              {/* Error banner */}
              {errorMsg && !isLoading && (
                <div className="flex items-start gap-2 rounded border border-[#C23B3B]/30 bg-[#C23B3B]/5 p-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C23B3B]" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-[#C23B3B]">
                      {errorMsg}
                    </p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="flex items-center gap-1 text-[11px] font-medium text-[#B8860B] underline-offset-2 hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Answer */}
              {answer && !isLoading && (
                <div className="space-y-3">
                  <div className="space-y-2 text-sm leading-relaxed text-[#1A1A1A]">
                    {answer.split(/\n\n+/).map((para, i) => (
                      <p key={i}>{para.trim()}</p>
                    ))}
                  </div>
                  {model && (
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-[#9C9C90]" />
                      <span className="text-[10px] text-[#9C9C90]">
                        Powered by {model.replace("claude-", "Claude ").replace(/-\d+$/, "")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area — sticky at bottom */}
        <div className="shrink-0 border-t border-[#E8E5DE] bg-[#FAFAF7] px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this practice… (Enter to send)"
              rows={2}
              className={cn(
                "flex-1 resize-none rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2",
                "text-sm text-[#1A1A1A] placeholder-[#9C9C90]",
                "focus:border-[#B8860B]/60 focus:outline-none focus:ring-1 focus:ring-[#B8860B]/30",
                "disabled:opacity-50"
              )}
              disabled={isLoading}
            />
            <Button
              type="button"
              onClick={() => handleSubmit(question)}
              disabled={!canSubmit}
              size="sm"
              className={cn(
                "h-auto shrink-0 rounded-md px-3 py-2",
                "bg-[#B8860B] text-white hover:bg-[#A67509]",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              aria-label="Send question"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#9C9C90]">
            Answers are based on available practice and ZIP data only.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
