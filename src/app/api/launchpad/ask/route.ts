import { NextRequest, NextResponse } from "next/server"
import type { AskIntelRequest, AskIntelResponse } from "@/lib/launchpad/ai-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ASK_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 350

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): AskIntelRequest | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (typeof b.question !== "string" || b.question.trim().length === 0) return null
  // Must have at least one of: npi+practice_snapshot or zip_code+zip_context
  const hasPractice = typeof b.npi === "string" && b.practice_snapshot != null
  const hasZip = typeof b.zip_code === "string" && b.zip_context != null
  if (!hasPractice && !hasZip) return null
  return raw as AskIntelRequest
}

function buildPrompt(body: AskIntelRequest): { system: string; user: string } {
  const system = [
    "You are a candid dental career advisor helping a new DDS/DMD graduate.",
    "Answer the user's question using ONLY the practice and ZIP data provided.",
    "If data is thin, say so explicitly. Never make up facts.",
    "2-4 sentences max, conversational, no markdown, no bullet points.",
    "Focus on what the grad should actually DO with this information.",
  ].join(" ")

  const parts: string[] = []

  if (body.practice_snapshot) {
    const p = body.practice_snapshot
    const snap = [
      p.name,
      p.city && p.state ? `${p.city}, ${p.state}` : (p.city ?? p.state ?? null),
      p.entity_classification ? `entity: ${p.entity_classification}` : null,
      p.year_established != null
        ? `established ${p.year_established} (${new Date().getFullYear() - p.year_established}y)`
        : null,
      p.employee_count != null ? `${p.employee_count} employees` : null,
      p.num_providers != null ? `${p.num_providers} providers` : null,
      p.buyability_score != null ? `buyability: ${p.buyability_score}` : null,
      p.affiliated_dso ? `DSO: ${p.affiliated_dso}` : null,
    ]
      .filter(Boolean)
      .join(", ")
    parts.push(`Practice: ${snap}`)
  }

  if (body.zip_context) {
    const z = body.zip_context
    const zipBits = [
      body.zip_code ? `ZIP ${body.zip_code}` : null,
      z.metro ? `metro: ${z.metro}` : null,
      z.market_type ? `market: ${z.market_type}` : null,
      z.corporate_share_pct != null
        ? `corporate share: ${Math.round(z.corporate_share_pct * 100)}%`
        : null,
      z.dld_gp_per_10k != null ? `density: ${z.dld_gp_per_10k.toFixed(1)} GP/10k` : null,
      z.metrics_confidence ? `data confidence: ${z.metrics_confidence}` : null,
    ]
      .filter(Boolean)
      .join(", ")
    parts.push(`ZIP: ${zipBits}`)
  }

  if (body.intel_context) {
    const intel = body.intel_context
    const intelBits = [
      intel.overall_assessment ? `assessment: ${intel.overall_assessment}` : null,
      intel.acquisition_readiness ? `readiness: ${intel.acquisition_readiness}` : null,
      intel.confidence ? `confidence: ${intel.confidence}` : null,
      intel.green_flags?.length ? `green flags: ${intel.green_flags.join(", ")}` : null,
      intel.red_flags?.length ? `red flags: ${intel.red_flags.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ")
    if (intelBits) parts.push(`Intel: ${intelBits}`)
    if (intel.raw_json) {
      parts.push(`Raw intel summary: ${JSON.stringify(intel.raw_json).slice(0, 800)}`)
    }
  }

  parts.push(`\nQuestion: ${body.question}`)

  return { system, user: parts.join("\n") }
}

export async function POST(req: NextRequest): Promise<NextResponse<AskIntelResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Q&A disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable." },
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
          "Invalid request — provide question + (npi + practice_snapshot) or (zip_code + zip_context)",
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
        model: ASK_MODEL,
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

  const answer =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!answer) {
    return NextResponse.json({ error: "Empty response from Anthropic" }, { status: 502 })
  }

  return NextResponse.json({ answer, model: ASK_MODEL })
}
