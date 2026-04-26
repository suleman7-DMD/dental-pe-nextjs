import { NextRequest, NextResponse } from "next/server"
import type { ContractParseRequest, ContractParseResponse } from "@/lib/launchpad/ai-types"
import { safeParseJson } from "@/lib/launchpad/ai-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CONTRACT_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 1500
const MIN_CONTRACT_LEN = 500
const MAX_CONTRACT_LEN = 8000

// Simple in-memory rate limiter — 5 requests per hour per IP
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 5

interface RateEntry {
  count: number
  windowStart: number
}

const rateLimitMap = new Map<string, RateEntry>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now })
    return true // allowed
  }
  if (entry.count >= RATE_LIMIT_MAX) return false // blocked
  entry.count += 1
  return true
}

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): ContractParseRequest | { validationError: string } {
  if (!raw || typeof raw !== "object") return { validationError: "Body must be a JSON object" }
  const b = raw as Record<string, unknown>
  if (typeof b.contract_text !== "string") return { validationError: "contract_text must be a string" }
  const len = b.contract_text.length
  if (len < MIN_CONTRACT_LEN) {
    return { validationError: `Contract text too short (${len} chars). Minimum: ${MIN_CONTRACT_LEN}.` }
  }
  if (len > MAX_CONTRACT_LEN) {
    return { validationError: `Contract text too long (${len} chars). Maximum: ${MAX_CONTRACT_LEN}.` }
  }
  return raw as ContractParseRequest
}

function buildPrompt(): { system: string } {
  const system = [
    "You are a contract analyst helping a new dental graduate evaluate an employment contract.",
    "Extract exactly these clauses and flag severity.",
    "Output JSON only — no prose, no markdown fences:",
    JSON.stringify({
      non_compete: {
        radius_miles: "number|null",
        duration_months: "number|null",
        severity: "low|medium|high",
      },
      compensation: {
        base_salary_usd: "number|null",
        production_pct: "number|null",
        collection_floor_pct: "number|null",
        draw_structure: "string|null",
      },
      termination: {
        notice_period_days: "number|null",
        at_will: "boolean|null",
      },
      restrictive_covenants: ["string"],
      ce_reimbursement: {
        annual_usd: "number|null",
        clawback: "boolean|null",
      },
      flags: [{ severity: "red|amber|green", message: "string" }],
      overall_assessment: "string",
    }),
    "If a field is not present, use null.",
    "Do not fabricate.",
    "Be conservative on severity: only 'red' for clauses that would materially harm the grad.",
  ].join(" ")

  return { system }
}

interface RawContractResult {
  non_compete?: unknown
  compensation?: unknown
  termination?: unknown
  restrictive_covenants?: unknown
  ce_reimbursement?: unknown
  flags?: unknown
  overall_assessment?: unknown
}

function parseContractResult(text: string): ContractParseResponse | null {
  const obj = safeParseJson<RawContractResult>(text)
  if (!obj || typeof obj !== "object") return null
  const r = obj

  if (!r.non_compete || !r.compensation || !r.termination || !r.ce_reimbursement) return null
  if (typeof r.overall_assessment !== "string") return null
  if (!Array.isArray(r.restrictive_covenants) || !Array.isArray(r.flags)) return null

  return obj as ContractParseResponse
}

export async function POST(req: NextRequest): Promise<NextResponse<ContractParseResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Contract parsing disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable." },
      { status: 503 }
    )
  }

  // Rate limiting: 5 req/hr per IP
  const ip = req.headers.get("x-forwarded-for") ?? "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded: 5 contract parses per hour per IP." },
      { status: 429 }
    )
  }

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const validation = validateBody(parsed)
  if ("validationError" in validation) {
    return NextResponse.json({ error: validation.validationError }, { status: 400 })
  }
  const body = validation as ContractParseRequest

  const { system } = buildPrompt()
  // SECURITY: contract_text is sent to Anthropic but never logged here
  const userContent = `Contract text:\n\n${body.contract_text}`

  let upstream: Response
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CONTRACT_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    })
  } catch (err) {
    // Never include body/contract_text in the error message
    return NextResponse.json(
      { error: `Anthropic request failed: ${err instanceof Error ? err.message : "network error"}` },
      { status: 502 }
    )
  }

  if (!upstream.ok) {
    // Don't include body text in error — return only status code
    return NextResponse.json(
      { error: `Anthropic returned status ${upstream.status}` },
      { status: 502 }
    )
  }

  const data = (await upstream.json()) as AnthropicResponse
  if (data.error) {
    return NextResponse.json(
      { error: `Anthropic API error: ${data.error.type}` },
      { status: 502 }
    )
  }

  const rawText =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!rawText) {
    return NextResponse.json({ error: "Empty response from Anthropic" }, { status: 502 })
  }

  const result = parseContractResult(rawText)
  if (!result) {
    return NextResponse.json(
      { error: "Anthropic returned malformed JSON — could not parse contract analysis" },
      { status: 502 }
    )
  }

  return NextResponse.json(result)
}
