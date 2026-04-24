import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface NarrativeRequestBody {
  npi: string
  track: "succession" | "high_volume" | "dso" | "all"
  practice: {
    name: string
    dba?: string | null
    entity_classification?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    year_established?: number | null
    employee_count?: number | null
    num_providers?: number | null
    buyability_score?: number | null
    website?: string | null
    affiliated_dso?: string | null
    dso_tier?: string | null
  }
  scores: {
    display: number
    display_tier: string
    best_track: "succession" | "high_volume" | "dso"
    succession: number
    high_volume: number
    dso: number
    confidence_capped: boolean
  }
  signals: {
    active: Array<{ id: string; label: string }>
    warnings: Array<{ id: string; label: string }>
  }
  zip_context: {
    metro?: string | null
    market_type?: string | null
    corporate_share_pct?: number | null
    dld_gp_per_10k?: number | null
    commutable: boolean
    metrics_confidence?: string | null
  }
}

const TRACK_LABELS: Record<string, string> = {
  succession: "Succession / Apprentice",
  high_volume: "High-Volume Ethical",
  dso: "DSO Associate",
  all: "All tracks",
}

const MAX_NPI_LEN = 12
const NARRATIVE_MODEL = "claude-haiku-4-5-20251001"

function validateBody(raw: unknown): NarrativeRequestBody | null {
  if (!raw || typeof raw !== "object") return null
  const b = raw as Record<string, unknown>
  if (typeof b.npi !== "string" || b.npi.length === 0 || b.npi.length > MAX_NPI_LEN) return null
  if (typeof b.track !== "string") return null
  if (!b.practice || typeof b.practice !== "object") return null
  if (!b.scores || typeof b.scores !== "object") return null
  if (!b.signals || typeof b.signals !== "object") return null
  if (!b.zip_context || typeof b.zip_context !== "object") return null
  return raw as NarrativeRequestBody
}

function buildPrompt(body: NarrativeRequestBody): { system: string; user: string } {
  const { practice, scores, signals, zip_context, track } = body

  const activeTrackLabel =
    track === "all" ? TRACK_LABELS[scores.best_track] : TRACK_LABELS[track]

  const locationLine = [practice.city, practice.state, practice.zip]
    .filter(Boolean)
    .join(", ")
  const age =
    practice.year_established != null
      ? new Date().getFullYear() - practice.year_established
      : null

  const activeList =
    signals.active.length > 0
      ? signals.active.map((s) => `- ${s.label}`).join("\n")
      : "(none)"
  const warningList =
    signals.warnings.length > 0
      ? signals.warnings.map((s) => `- ${s.label}`).join("\n")
      : "(none)"

  const zipBits: string[] = []
  if (zip_context.metro) zipBits.push(`Metro: ${zip_context.metro}`)
  if (zip_context.market_type) zipBits.push(`Market type: ${zip_context.market_type}`)
  if (zip_context.corporate_share_pct != null)
    zipBits.push(`Corporate share: ${Math.round(zip_context.corporate_share_pct * 100)}%`)
  if (zip_context.dld_gp_per_10k != null)
    zipBits.push(`Density: ${zip_context.dld_gp_per_10k.toFixed(1)} GP offices per 10k residents`)
  zipBits.push(`Commutable from living location: ${zip_context.commutable ? "yes" : "no"}`)
  if (zip_context.metrics_confidence)
    zipBits.push(`Data confidence: ${zip_context.metrics_confidence}`)

  const system = [
    "You are a candid dental career advisor writing for a new dental-school graduate hunting a first associate role.",
    "Your job: explain why this specific practice is ranked where it is on the Launchpad tool, tuned to the user's active career track.",
    "Write in first person to the reader ('you'), plain and conversational — not corporate or promotional.",
    "Never invent data; only use what's provided. If a signal is missing, don't speculate.",
    "If warning signals are present, say so explicitly and weight them against the positives.",
    "Output format: 2 short paragraphs, 90-160 words total. No headings, no bullets, no markdown.",
  ].join(" ")

  const user = `
Active track: ${activeTrackLabel}${track === "all" ? " (selected as best-fit for this practice)" : ""}

Practice snapshot:
- Name: ${practice.name}${practice.dba ? ` (dba ${practice.dba})` : ""}
- Location: ${locationLine || "unknown"}
- Entity type: ${practice.entity_classification ?? "unclassified"}
- Age: ${age != null ? `${age} years` : "unknown"}
- Employees: ${practice.employee_count ?? "unknown"} · Providers: ${practice.num_providers ?? "unknown"}
- Buyability score: ${practice.buyability_score ?? "unknown"}
- DSO affiliation: ${practice.affiliated_dso ?? "none"}${practice.dso_tier ? ` (tier: ${practice.dso_tier})` : ""}

Score:
- Display score: ${scores.display} (tier: ${scores.display_tier})
- Track scores — succession: ${scores.succession}, high_volume: ${scores.high_volume}, dso: ${scores.dso}
- Best track: ${scores.best_track}${scores.confidence_capped ? " — confidence-capped (thin data)" : ""}

Active signals:
${activeList}

Warning signals:
${warningList}

ZIP context:
${zipBits.map((b) => `- ${b}`).join("\n")}

Write the 2-paragraph narrative now. Tie the reasoning to the active track. End with one concrete next step (e.g. "read reviews", "ask about non-compete radius", "look up the owner's CE history", etc.).
`.trim()

  return { system, user }
}

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

export async function POST(req: NextRequest) {
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
      { error: "Invalid request shape — missing required fields" },
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
        max_tokens: 500,
        temperature: 0.4,
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
      {
        error: `Anthropic error ${upstream.status}: ${text.slice(0, 300)}`,
      },
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
    return NextResponse.json(
      { error: "Empty narrative returned by Anthropic" },
      { status: 502 }
    )
  }

  return NextResponse.json({
    narrative,
    model: NARRATIVE_MODEL,
    npi: body.npi,
    track: body.track,
  })
}
