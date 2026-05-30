import { NextRequest, NextResponse } from "next/server"
import type { PracticeSnapshot, TrackScores } from "@/lib/launchpad/ai-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NARRATIVE_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 500
const TEMPERATURE = 0.4

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface NarrativeRequest {
  npi: string
  practice: PracticeSnapshot
  signals: string[]
  scores: TrackScores
  track: "succession" | "high_volume" | "dso" | "all"
}

export interface NarrativeResponse {
  narrative: string
  model: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): NarrativeRequest | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (typeof b.npi !== "string" || b.npi.trim().length === 0) return null
  if (!b.practice || typeof b.practice !== "object") return null
  const p = b.practice as Record<string, unknown>
  if (typeof p.name !== "string") return null
  if (!Array.isArray(b.signals)) return null
  if (!b.scores || typeof b.scores !== "object") return null
  const validTracks = ["succession", "high_volume", "dso", "all"]
  if (typeof b.track !== "string" || !validTracks.includes(b.track)) return null
  return raw as NarrativeRequest
}

function buildPrompt(body: NarrativeRequest): { system: string; user: string } {
  const { practice: p, signals, scores, track } = body
  const age = p.year_established != null ? new Date().getFullYear() - p.year_established : null

  const system = [
    "You are a candid dental career advisor helping a new DDS/DMD graduate evaluate a practice as a first job.",
    "Write a 'Why this practice for me?' narrative — 3-5 sentences, no bullet points, no markdown, plain prose.",
    "Focus on the specific structural signals and career-fit factors that matter for the requested track.",
    "Be honest: highlight what's genuinely good AND any caveats the grad should weigh.",
    "Never fabricate facts. If data is thin, say so in one sentence and focus on what IS known.",
    "Close with one concrete action the grad should take to verify the most important factor.",
  ].join(" ")

  const trackLabels: Record<string, string> = {
    succession: "Succession / Apprentice (looking to buy in long-term)",
    high_volume: "High-Volume Ethical (build speed and production)",
    dso: "DSO Associate (corporate stability, training programs)",
    all: "General (best overall fit)",
  }

  const parts = [
    `Practice: ${p.name || "Unknown"}${p.dba ? ` (also known as ${p.dba})` : ""}`,
    `Location: ${[p.city, p.state, p.zip].filter(Boolean).join(", ") || "unknown"}`,
    `Entity type: ${p.entity_classification ?? "unclassified"}`,
    age != null ? `Years in operation: ${age}` : "Years in operation: unknown",
    p.employee_count != null ? `Employees: ${p.employee_count}` : null,
    p.num_providers != null ? `Providers: ${p.num_providers}` : null,
    p.estimated_revenue != null
      ? `Estimated revenue: $${p.estimated_revenue.toLocaleString()}`
      : null,
    p.buyability_score != null ? `Buyability score: ${p.buyability_score}/100` : null,
    p.affiliated_dso ? `DSO affiliation: ${p.affiliated_dso}${p.dso_tier ? ` (${p.dso_tier})` : ""}` : "Independent practice",
    signals.length > 0
      ? `Active signals: ${signals.join(", ")}`
      : "Active signals: none",
    `Track scores — succession: ${scores.succession}, high_volume: ${scores.high_volume}, dso: ${scores.dso}`,
    `Requested track: ${trackLabels[track] ?? track}`,
  ]
    .filter((s): s is string => s !== null)
    .join("\n")

  const user = `${parts}\n\nWrite the 'Why this practice for me?' narrative for the requested track now. 3-5 sentences, plain prose.`

  return { system, user }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest
): Promise<NextResponse<NarrativeResponse | { error: string }>> {
  // CRITICAL: Check API key FIRST — must return 503 (not 404 or 500) when absent.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Narrative disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable.",
      },
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
          "Invalid request — required: npi (string), practice (object with name), signals (array), scores (object), track (string)",
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
        model: NARRATIVE_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system,
        messages: [{ role: "user", content: user }],
      }),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`,
      },
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

  const narrative =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!narrative) {
    return NextResponse.json({ error: "Empty response from Anthropic" }, { status: 502 })
  }

  return NextResponse.json({ narrative, model: NARRATIVE_MODEL })
}
