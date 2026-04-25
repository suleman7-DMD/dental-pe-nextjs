import { NextRequest, NextResponse } from "next/server"
import type {
  SmartBriefingRequest,
  SmartBriefingResponse,
  SmartBriefingPractice,
  SmartBriefingPracticeResult,
} from "@/lib/launchpad/ai-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Sonnet for long-form multi-practice comparison
const BRIEFING_MODEL = "claude-sonnet-4-6"
const MAX_TOKENS = 2500

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): SmartBriefingRequest | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (!Array.isArray(b.practices)) return null
  if (b.practices.length < 2 || b.practices.length > 5) return null
  for (const item of b.practices) {
    if (!item || typeof item !== "object") return null
    const p = item as Record<string, unknown>
    if (typeof p.npi !== "string" || p.npi.length === 0) return null
    if (!p.snapshot || typeof p.snapshot !== "object") return null
    if (!Array.isArray(p.signals)) return null
    if (!p.scores || typeof p.scores !== "object") return null
  }
  const validTracks = ["succession", "high_volume", "dso", "all"]
  if (typeof b.track !== "string" || !validTracks.includes(b.track)) return null
  return raw as SmartBriefingRequest
}

function formatPractice(p: SmartBriefingPractice): string {
  const s = p.snapshot
  const age = s.year_established != null ? new Date().getFullYear() - s.year_established : null
  const lines = [
    `NPI: ${p.npi}`,
    `Name: ${s.name || "Unknown"}${s.dba ? ` (dba ${s.dba})` : ""}`,
    `Location: ${[s.city, s.state, s.zip].filter(Boolean).join(", ") || "unknown"}`,
    `Entity: ${s.entity_classification ?? "unclassified"}`,
    `Age: ${age != null ? `${age} years` : "unknown"}`,
    `Employees: ${s.employee_count ?? "unknown"} | Providers: ${s.num_providers ?? "unknown"}`,
    `Revenue: ${s.estimated_revenue != null ? `$${s.estimated_revenue.toLocaleString()}` : "unknown"}`,
    `Buyability score: ${s.buyability_score ?? "unknown"}`,
    `DSO: ${s.affiliated_dso ?? "none"}${s.dso_tier ? ` (${s.dso_tier})` : ""}`,
    `Signals: ${p.signals.length > 0 ? p.signals.join(", ") : "none"}`,
    `Scores — succession: ${p.scores.succession}, high_volume: ${p.scores.high_volume}, dso: ${p.scores.dso}`,
  ]
  if (p.intel) {
    if (p.intel.overall_assessment) lines.push(`Intel: ${p.intel.overall_assessment}`)
    if (p.intel.green_flags?.length) lines.push(`Green flags: ${p.intel.green_flags.join(", ")}`)
    if (p.intel.red_flags?.length) lines.push(`Red flags: ${p.intel.red_flags.join(", ")}`)
  }
  return lines.join("\n")
}

function buildPrompt(body: SmartBriefingRequest): { system: string; user: string } {
  const system = [
    "You are a dental career analyst preparing a pre-interview briefing for a graduate considering multiple practices.",
    "For EACH practice in the input, output exactly: 3 strengths (1 sentence each), 3 risks (1 sentence each), 3 questions to ask during an interview at THIS specific practice.",
    "End with a 2-sentence recommendation naming the top choice and WHY.",
    "Output JSON only — no prose, no markdown fences:",
    '{ "practices": [{ "npi": string, "name": string, "strengths": string[], "risks": string[], "questions": string[] }], "recommendation": { "top_npi": string, "rationale": string } }',
  ].join(" ")

  const practiceBlocks = body.practices.map((p, i) => {
    return `--- Practice ${i + 1} ---\n${formatPractice(p)}`
  })

  const user = `Track: ${body.track}\n\n${practiceBlocks.join("\n\n")}\n\nGenerate the briefing JSON now.`

  return { system, user }
}

interface RawBriefingResult {
  practices?: unknown[]
  recommendation?: { top_npi?: unknown; rationale?: unknown }
}

function parseBriefing(text: string): SmartBriefingResponse | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  let obj: unknown
  try {
    obj = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!obj || typeof obj !== "object") return null
  const root = obj as RawBriefingResult

  if (!Array.isArray(root.practices) || root.practices.length === 0) return null
  if (!root.recommendation || typeof root.recommendation !== "object") return null
  if (
    typeof root.recommendation.top_npi !== "string" ||
    typeof root.recommendation.rationale !== "string"
  ) {
    return null
  }

  const practices: SmartBriefingPracticeResult[] = []
  for (const item of root.practices) {
    if (!item || typeof item !== "object") return null
    const p = item as Record<string, unknown>
    if (typeof p.npi !== "string") return null
    if (typeof p.name !== "string") return null
    if (!Array.isArray(p.strengths) || !Array.isArray(p.risks) || !Array.isArray(p.questions)) {
      return null
    }
    practices.push({
      npi: p.npi,
      name: p.name,
      strengths: p.strengths as string[],
      risks: p.risks as string[],
      questions: p.questions as string[],
    })
  }

  return {
    practices,
    recommendation: {
      top_npi: root.recommendation.top_npi as string,
      rationale: root.recommendation.rationale as string,
    },
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<SmartBriefingResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Smart briefing disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable." },
      { status: 503 }
    )
  }

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = validateBody(parsed)
  if (!body) {
    return NextResponse.json(
      {
        error:
          "Invalid request shape — required: practices (2-5 items each with npi, snapshot, signals[], scores), track",
      },
      { status: 400 }
    )
  }

  const { system, user } = buildPrompt(body)

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
        model: BRIEFING_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        system,
        messages: [{ role: "user", content: user }],
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "")
    return NextResponse.json(
      { error: `Anthropic error ${upstream.status}: ${text.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const data = (await upstream.json()) as AnthropicResponse
  if (data.error) {
    return NextResponse.json(
      { error: `Anthropic API error: ${data.error.message}` },
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

  const result = parseBriefing(rawText)
  if (!result) {
    return NextResponse.json(
      { error: "Anthropic returned malformed JSON — could not parse smart briefing" },
      { status: 502 }
    )
  }

  return NextResponse.json(result)
}
