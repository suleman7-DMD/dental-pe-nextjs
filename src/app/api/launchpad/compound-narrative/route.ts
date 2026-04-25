import { NextRequest, NextResponse } from "next/server"
import type { CompoundNarrativeRequest, CompoundNarrativeResponse } from "@/lib/launchpad/ai-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NARRATIVE_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 200

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): CompoundNarrativeRequest | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (!b.practice || typeof b.practice !== "object") return null
  const p = b.practice as Record<string, unknown>
  if (typeof p.npi !== "string" || p.npi.length === 0) return null
  if (!Array.isArray(b.signals)) return null
  if (!b.scores || typeof b.scores !== "object") return null
  const validTracks = ["succession", "high_volume", "dso", "all"]
  if (typeof b.track !== "string" || !validTracks.includes(b.track)) return null
  return raw as CompoundNarrativeRequest
}

function buildPrompt(body: CompoundNarrativeRequest): { system: string; user: string } {
  const system = [
    "You are a dental PE pattern-recognition analyst writing a 2-3 sentence thesis for a new graduate.",
    "Combine the practice's structural signals into a coherent story.",
    "Format: one sentence describing the practice's position, one sentence naming the pattern, one sentence about what it means for a new grad.",
    "No markdown. No bullet points. 2-3 sentences total, under 50 words.",
  ].join(" ")

  const { practice: p, signals, scores, track } = body
  const age =
    p.year_established != null ? new Date().getFullYear() - p.year_established : null

  const user = [
    `Practice: ${p.name || "Unknown"}${p.dba ? ` (dba ${p.dba})` : ""} in ${p.city ?? "unknown city"}.`,
    `Entity: ${p.entity_classification ?? "unclassified"}.`,
    `Age: ${age != null ? `${age} years` : "unknown"}.`,
    `Providers: ${p.num_providers ?? "unknown"}.`,
    `Employees: ${p.employee_count ?? "unknown"}.`,
    `Revenue: ${p.estimated_revenue != null ? `$${p.estimated_revenue.toLocaleString()}` : "unknown"}.`,
    `Active signals: ${signals.length > 0 ? signals.join(", ") : "none"}.`,
    `Score breakdown — succession: ${scores.succession}, high_volume: ${scores.high_volume}, dso: ${scores.dso}.`,
    `Track: ${track}.`,
  ].join(" ")

  return { system, user }
}

export async function POST(req: NextRequest): Promise<NextResponse<CompoundNarrativeResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Compound narrative disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable." },
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
      { error: "Invalid request shape — required: practice (with npi), signals[], scores, track" },
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
        temperature: 0.5,
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

  const thesis =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!thesis) {
    return NextResponse.json({ error: "Empty thesis returned by Anthropic" }, { status: 502 })
  }

  return NextResponse.json({ thesis })
}
