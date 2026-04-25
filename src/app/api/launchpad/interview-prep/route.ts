import { NextRequest, NextResponse } from "next/server"
import type {
  InterviewPrepRequest,
  InterviewPrepResponse,
  InterviewCategory,
} from "@/lib/launchpad/ai-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const INTERVIEW_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 1200

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): InterviewPrepRequest | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (!b.practice || typeof b.practice !== "object") return null
  const p = b.practice as Record<string, unknown>
  if (typeof p.npi !== "string" || p.npi.length === 0) return null
  if (!Array.isArray(b.signals)) return null
  const validTracks = ["succession", "high_volume", "dso", "all"]
  if (typeof b.track !== "string" || !validTracks.includes(b.track)) return null
  return raw as InterviewPrepRequest
}

function buildPrompt(body: InterviewPrepRequest): { system: string; user: string } {
  const system = [
    "You are an interview coach for dental graduates.",
    "Given a practice's specific signals, generate exactly 10 interview questions calibrated to what matters most at THIS practice.",
    "Group them into 4 categories: Ownership & Culture, Compensation & Equity, Growth & Mentorship, Red Flag Probes.",
    "For EACH question, add one sentence starting with 'Listen for:' that explains what a great vs. bad answer sounds like.",
    "Output JSON only — no prose, no markdown fences:",
    '{ "categories": [{ "name": string, "questions": [{ "q": string, "listenFor": string }] }] }',
  ].join(" ")

  const { practice: p, signals, intel, track } = body
  const age =
    p.year_established != null ? new Date().getFullYear() - p.year_established : null

  const practiceLines = [
    `Name: ${p.name || "Unknown"}${p.dba ? ` (dba ${p.dba})` : ""}`,
    `Location: ${[p.city, p.state, p.zip].filter(Boolean).join(", ") || "unknown"}`,
    `Entity: ${p.entity_classification ?? "unclassified"}`,
    `Age: ${age != null ? `${age} years` : "unknown"}`,
    `Employees: ${p.employee_count ?? "unknown"} | Providers: ${p.num_providers ?? "unknown"}`,
    `Buyability score: ${p.buyability_score ?? "unknown"}`,
    `DSO affiliation: ${p.affiliated_dso ?? "none"}${p.dso_tier ? ` (${p.dso_tier})` : ""}`,
    `Track: ${track}`,
    `Active signals: ${signals.length > 0 ? signals.join(", ") : "none"}`,
  ]

  if (intel) {
    if (intel.overall_assessment) practiceLines.push(`Intel assessment: ${intel.overall_assessment}`)
    if (intel.acquisition_readiness) practiceLines.push(`Readiness: ${intel.acquisition_readiness}`)
    if (intel.green_flags?.length) practiceLines.push(`Green flags: ${intel.green_flags.join(", ")}`)
    if (intel.red_flags?.length) practiceLines.push(`Red flags: ${intel.red_flags.join(", ")}`)
  }

  const user = `Practice context:\n${practiceLines.map((l) => `- ${l}`).join("\n")}\n\nGenerate exactly 10 questions across 4 categories as JSON.`

  return { system, user }
}

function parseCategories(text: string): InterviewCategory[] | null {
  // Strip optional markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  let obj: unknown
  try {
    obj = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!obj || typeof obj !== "object") return null
  const root = obj as Record<string, unknown>
  if (!Array.isArray(root.categories)) return null
  // Validate shape loosely — each entry needs name + questions array
  for (const cat of root.categories) {
    if (!cat || typeof cat !== "object") return null
    const c = cat as Record<string, unknown>
    if (typeof c.name !== "string") return null
    if (!Array.isArray(c.questions)) return null
  }
  return root.categories as InterviewCategory[]
}

export async function POST(req: NextRequest): Promise<NextResponse<InterviewPrepResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Interview prep disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable." },
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
      { error: "Invalid request shape — required: practice (with npi), signals[], track" },
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
        model: INTERVIEW_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.4,
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

  const categories = parseCategories(rawText)
  if (!categories) {
    return NextResponse.json(
      { error: "Anthropic returned malformed JSON — could not parse interview categories" },
      { status: 502 }
    )
  }

  return NextResponse.json({ categories })
}
