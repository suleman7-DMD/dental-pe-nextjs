import { NextRequest, NextResponse } from "next/server"
import type { ZipMoodRequest, ZipMoodResponse } from "@/lib/launchpad/ai-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ZIP_MOOD_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 180

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

function validateBody(raw: unknown): ZipMoodRequest | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (typeof b.zip_code !== "string" || b.zip_code.trim().length === 0) return null
  if (!b.zip_context || typeof b.zip_context !== "object") return null
  return raw as ZipMoodRequest
}

function buildPrompt(body: ZipMoodRequest): { system: string; user: string } {
  const system = [
    "You are a dental market analyst describing the career vibe of a ZIP code for a new graduate.",
    "Given ZIP stats and intel, write exactly 2 sentences: one naming the market pattern, one on what it means for a job-hunting grad.",
    "No markdown. Under 60 words total. Dry, specific, no generic phrases.",
  ].join(" ")

  const { zip_code, zip_context: z, zip_intel, practice_stats: ps } = body

  const bits = [
    `ZIP ${zip_code}`,
    z.metro ? `metro: ${z.metro}` : null,
    z.market_type ? `market type: ${z.market_type}` : null,
    z.corporate_share_pct != null
      ? `corporate share: ${Math.round(z.corporate_share_pct * 100)}%`
      : null,
    z.dld_gp_per_10k != null
      ? `GP density: ${z.dld_gp_per_10k.toFixed(1)} offices per 10k residents`
      : null,
    z.buyable_practice_ratio != null
      ? `buyable ratio: ${Math.round(z.buyable_practice_ratio * 100)}%`
      : null,
    z.metrics_confidence ? `data confidence: ${z.metrics_confidence}` : null,
    z.population != null ? `population: ${z.population.toLocaleString()}` : null,
    z.median_household_income != null
      ? `median HHI: $${z.median_household_income.toLocaleString()}`
      : null,
  ].filter(Boolean)

  if (ps) {
    if (ps.total != null) bits.push(`total practices: ${ps.total}`)
    if (ps.mentor_rich_count != null) bits.push(`mentor-rich practices: ${ps.mentor_rich_count}`)
    if (ps.dso_density != null) bits.push(`DSO density: ${ps.dso_density.toFixed(2)}`)
    if (ps.independent_pct != null)
      bits.push(`independent pct: ${Math.round(ps.independent_pct * 100)}%`)
  }

  if (zip_intel) {
    bits.push(`Intel summary: ${JSON.stringify(zip_intel).slice(0, 600)}`)
  }

  const user = `ZIP stats:\n${bits.map((b) => `- ${b}`).join("\n")}\n\nWrite exactly 2 sentences describing the career vibe of this market for a new grad.`

  return { system, user }
}

function deriveConfidence(body: ZipMoodRequest): "high" | "medium" | "low" {
  const c = body.zip_context.metrics_confidence
  if (c === "high") return "high"
  if (c === "medium") return "medium"
  return "low"
}

export async function POST(req: NextRequest): Promise<NextResponse<ZipMoodResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ZIP mood disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable." },
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
      { error: "Invalid request shape — required: zip_code (string), zip_context (object)" },
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
        model: ZIP_MOOD_MODEL,
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

  const mood =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!mood) {
    return NextResponse.json({ error: "Empty response from Anthropic" }, { status: 502 })
  }

  return NextResponse.json({ mood, confidence: deriveConfidence(body) })
}
