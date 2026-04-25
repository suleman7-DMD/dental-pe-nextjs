"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, FileText, Lock, RotateCcw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ContractParseRequest,
  ContractParseResponse,
  ContractFlag,
} from "@/lib/launchpad/ai-types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractParseError {
  error: string
  status: number
  retryAfterMin?: number
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchContractParse(
  contractText: string
): Promise<ContractParseResponse> {
  const body: ContractParseRequest = { contract_text: contractText }
  const res = await fetch("/api/launchpad/contract-parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => null)

  if (res.status === 429) {
    const retryHeader = res.headers.get("retry-after")
    const retryMin = retryHeader
      ? Math.ceil(parseInt(retryHeader, 10) / 60)
      : 60
    const err: ContractParseError = {
      error: "Rate limit exceeded: 5 contract parses per hour per IP.",
      status: 429,
      retryAfterMin: retryMin,
    }
    throw err
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    const err: ContractParseError = { error: msg, status: res.status }
    throw err
  }
  return data as ContractParseResponse
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<"low" | "medium" | "high", string> = {
  low: "bg-[#2D8B4E]/10 text-[#2D8B4E] border-[#2D8B4E]/30",
  medium: "bg-[#D4920B]/10 text-[#D4920B] border-[#D4920B]/30",
  high: "bg-[#C23B3B]/10 text-[#C23B3B] border-[#C23B3B]/30",
}

const FLAG_SEVERITY_STYLES: Record<"red" | "amber" | "green", string> = {
  red: "border-[#C23B3B]/30 bg-[#C23B3B]/5 text-[#C23B3B]",
  amber: "border-[#D4920B]/30 bg-[#D4920B]/5 text-[#D4920B]",
  green: "border-[#2D8B4E]/30 bg-[#2D8B4E]/5 text-[#2D8B4E]",
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90]">
      {children}
    </h4>
  )
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-[#9C9C90]">{label}</span>
      <span className="text-right font-medium text-[#1A1A1A]">
        {value ?? <span className="font-normal text-[#9C9C90]">—</span>}
      </span>
    </div>
  )
}

function ContractResultView({ result }: { result: ContractParseResponse }) {
  const nc = result.non_compete
  const comp = result.compensation
  const term = result.termination
  const ce = result.ce_reimbursement

  return (
    <div className="space-y-5">
      {/* Overall assessment banner */}
      <div className="rounded-md border border-[#B8860B]/30 bg-gradient-to-br from-[#FEF9E7] to-[#FFFFFF] px-3 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-[#B8860B]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B8860B]">
            Overall assessment
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[#1A1A1A]">
          {result.overall_assessment}
        </p>
      </div>

      {/* Non-compete */}
      <section className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader>Non-compete</SectionHeader>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
              SEVERITY_STYLES[nc.severity]
            )}
          >
            {nc.severity} risk
          </span>
        </div>
        <div className="divide-y divide-[#F0EDE8]">
          <DataRow
            label="Radius"
            value={nc.radius_miles != null ? `${nc.radius_miles} mi` : null}
          />
          <DataRow
            label="Duration"
            value={
              nc.duration_months != null
                ? `${nc.duration_months} months`
                : null
            }
          />
        </div>
      </section>

      {/* Compensation */}
      <section className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
        <SectionHeader>Compensation</SectionHeader>
        <div className="divide-y divide-[#F0EDE8]">
          <DataRow
            label="Base salary"
            value={
              comp.base_salary_usd != null
                ? `$${comp.base_salary_usd.toLocaleString()}`
                : null
            }
          />
          <DataRow
            label="Production %"
            value={
              comp.production_pct != null ? `${comp.production_pct}%` : null
            }
          />
          <DataRow
            label="Collection floor %"
            value={
              comp.collection_floor_pct != null
                ? `${comp.collection_floor_pct}%`
                : null
            }
          />
          {comp.draw_structure && (
            <DataRow label="Draw structure" value={comp.draw_structure} />
          )}
        </div>
      </section>

      {/* Termination */}
      <section className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
        <SectionHeader>Termination</SectionHeader>
        <div className="divide-y divide-[#F0EDE8]">
          <DataRow
            label="Notice period"
            value={
              term.notice_period_days != null
                ? `${term.notice_period_days} days`
                : null
            }
          />
          <DataRow
            label="At-will"
            value={
              term.at_will != null ? (term.at_will ? "Yes" : "No") : null
            }
          />
        </div>
      </section>

      {/* CE Reimbursement */}
      <section className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
        <SectionHeader>CE Reimbursement</SectionHeader>
        <div className="divide-y divide-[#F0EDE8]">
          <DataRow
            label="Annual allowance"
            value={
              ce.annual_usd != null ? `$${ce.annual_usd.toLocaleString()}` : null
            }
          />
          <DataRow
            label="Clawback"
            value={
              ce.clawback != null ? (ce.clawback ? "Yes" : "No") : null
            }
          />
        </div>
      </section>

      {/* Restrictive covenants */}
      {result.restrictive_covenants.length > 0 && (
        <section>
          <SectionHeader>Restrictive covenants</SectionHeader>
          <ul className="space-y-1.5">
            {result.restrictive_covenants.map((covenant, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B60]">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B8860B]" />
                {covenant}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Flags */}
      {result.flags.length > 0 && (
        <section>
          <SectionHeader>Flags</SectionHeader>
          <div className="space-y-2">
            {result.flags.map((flag: ContractFlag, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                  FLAG_SEVERITY_STYLES[flag.severity]
                )}
              >
                {flag.severity === "red" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : flag.severity === "green" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{flag.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MIN_CHARS = 500

export function ContractParser() {
  const [contractText, setContractText] = useState("")

  const mutation = useMutation<ContractParseResponse, ContractParseError, string>({
    mutationFn: (text) => fetchContractParse(text),
  })

  const isLoading = mutation.isPending
  const result = mutation.data ?? null
  const errorMsg = mutation.isError ? mutation.error : null
  const charCount = contractText.length
  const canSubmit = charCount >= MIN_CHARS && !isLoading

  function handleParse() {
    if (!canSubmit) return
    mutation.reset()
    mutation.mutate(contractText)
  }

  function handleReset() {
    setContractText("")
    mutation.reset()
  }

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-md border border-[#E8E5DE] bg-[#F5F5F0] px-3 py-2">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9C9C90]" />
        <p className="text-xs text-[#6B6B60]">
          Your contract text is not saved or stored. It is sent directly to the AI
          model for analysis and immediately discarded.
        </p>
      </div>

      {/* Input area */}
      {!result && (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="contract-text"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#9C9C90]"
            >
              Contract text
            </label>
            <textarea
              id="contract-text"
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              placeholder="Paste your associate contract here... (minimum 100 characters)"
              rows={12}
              className={cn(
                "w-full resize-y rounded-md border border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2",
                "font-mono text-sm text-[#1A1A1A] placeholder-[#9C9C90]",
                "focus:border-[#B8860B]/60 focus:outline-none focus:ring-1 focus:ring-[#B8860B]/30",
                "disabled:opacity-50"
              )}
              disabled={isLoading}
            />
            <div className="mt-1 flex justify-between text-[11px] text-[#9C9C90]">
              <span>
                {charCount < MIN_CHARS && charCount > 0
                  ? `${MIN_CHARS - charCount} more characters needed`
                  : charCount === 0
                  ? `Minimum ${MIN_CHARS} characters`
                  : `${charCount.toLocaleString()} characters`}
              </span>
              <span>Max 8,000 characters</span>
            </div>
          </div>

          {/* Error */}
          {errorMsg && !isLoading && (
            <div className="flex items-start gap-2 rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C23B3B]" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-[#C23B3B]">
                  {errorMsg.status === 429
                    ? `Rate limit reached — 5 parses per hour${
                        errorMsg.retryAfterMin
                          ? `. Try again in ~${errorMsg.retryAfterMin} min.`
                          : "."
                      }`
                    : errorMsg.error}
                </p>
              </div>
            </div>
          )}

          <Button
            type="button"
            onClick={handleParse}
            disabled={!canSubmit}
            className={cn(
              "w-full bg-[#B8860B] text-white hover:bg-[#A67509]",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 animate-spin" />
                Analyzing contract…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Parse contract
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#9C9C90]">
              Analysis complete · paste a new contract to analyze another
            </p>
            <button
              type="button"
              onClick={handleReset}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-2.5 py-1",
                "text-xs font-medium text-[#6B6B60] transition-colors",
                "hover:border-[#B8860B] hover:text-[#B8860B]"
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New contract
            </button>
          </div>
          <ContractResultView result={result} />
        </div>
      )}
    </div>
  )
}
