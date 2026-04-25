import { NextRequest, NextResponse } from "next/server"
import type { CompoundNarrativeRequest, CompoundNarrativeResponse } from "@/lib/launchpad/ai-types"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getPracticeIntelByNpi } from "@/lib/supabase/queries/intel"
import type { PracticeIntel } from "@/lib/types/intel"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NARRATIVE_MODEL = "claude-sonnet-4-6"
const MAX_TOKENS = 800
const TEMPERATURE = 0.3

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

function parseList(s: string | null): string[] {
  if (!s) return []
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string")
  } catch {
    // fall through
  }
  return s.split(/[\n;|]/).map((x) => x.trim()).filter(Boolean)
}

function parseUrls(s: string | null): string[] {
  if (!s) return []
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => (typeof x === "string" ? x : null))
        .filter((x): x is string => !!x && x !== "no_results_found")
    }
  } catch {
    // fall through
  }
  return s
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter((x) => x.startsWith("http"))
}

function shortDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return url.slice(0, 40)
  }
}

const SYSTEM_PROMPT = [
  "You are a dental private-equity pattern analyst writing a verified investment thesis for a new dental graduate evaluating this practice as a first-job opportunity.",
  "",
  "OUTPUT REQUIREMENTS:",
  "- 200-300 words (4-6 sentences across 1-2 paragraphs).",
  "- Concrete, specific, and grounded — never generic.",
  "- Each substantive claim must be backed by either (a) the supplied structural signals, or (b) a `[source: domain]` citation drawn from the verified URL list.",
  "- If the practice has verified web research (intel block present), weave its findings into the narrative AND cite at least 2 source domains using `[source: example.com]` shorthand.",
  "- If the practice has NO verified web research (intel missing), open with: \"Structural signals only — verified web research not yet collected for this practice.\" Then write a thesis based purely on entity classification, age, providers, and active signals. Do NOT invent facts, reviews, or website details.",
  "- Frame the conclusion in terms of fit for a new grad on the requested track (succession / high-volume / DSO).",
  "- No markdown headers, no bullet points, no emojis. Plain prose.",
  "",
  "VERIFICATION DISCIPLINE:",
  "- Never fabricate doctor names, ages, retirement intent, review counts, or technology lists.",
  "- If the intel says `partial` or `insufficient` evidence quality, hedge with phrases like \"limited public footprint suggests\" or \"available evidence indicates\".",
  "- Reviews / ratings: only cite if the source URL list contains a Google or Healthgrades domain.",
].join("\n")

function buildUserPrompt(
  body: CompoundNarrativeRequest,
  intel: PracticeIntel | null
): string {
  const { practice: p, signals, scores, track } = body
  const age =
    p.year_established != null ? new Date().getFullYear() - p.year_established : null

  const lines: string[] = [
    `# Practice`,
    `- Name: ${p.name || "Unknown"}${p.dba ? ` (dba ${p.dba})` : ""}`,
    `- Location: ${p.city ?? "?"}, ${p.state ?? "?"} ${p.zip ?? ""}`,
    `- Entity classification: ${p.entity_classification ?? "unclassified"}`,
    `- Years in operation: ${age != null ? age : "unknown"}`,
    `- Providers: ${p.num_providers ?? "unknown"}`,
    `- Employees: ${p.employee_count ?? "unknown"}`,
    `- Estimated revenue: ${p.estimated_revenue != null ? `$${p.estimated_revenue.toLocaleString()}` : "unknown"}`,
    `- Buyability score: ${p.buyability_score ?? "unscored"}`,
    `- Affiliated DSO: ${p.affiliated_dso ?? "none"}`,
    `- Website on file: ${p.website ?? "none"}`,
    ``,
    `# Active structural signals (${signals.length})`,
    signals.length > 0 ? signals.map((s) => `- ${s}`).join("\n") : "- (none)",
    ``,
    `# Track scores (0-100)`,
    `- succession: ${scores.succession}`,
    `- high_volume: ${scores.high_volume}`,
    `- dso: ${scores.dso}`,
    `- Requested track: ${track}`,
  ]

  if (intel) {
    const greenFlags = parseList(intel.green_flags)
    const redFlags = parseList(intel.red_flags)
    const verUrls = parseUrls(intel.verification_urls).slice(0, 8)
    const services = parseList(intel.services_listed).slice(0, 6)
    const techs = parseList(intel.technology_listed).slice(0, 6)

    lines.push(
      ``,
      `# Verified web research`,
      `- Overall assessment: ${intel.overall_assessment ?? "n/a"}`,
      `- Acquisition readiness: ${intel.acquisition_readiness ?? "n/a"}`,
      `- Confidence: ${intel.confidence ?? "n/a"}`,
      `- Evidence quality: ${intel.verification_quality ?? "n/a"} (${intel.verification_searches ?? 0} web searches)`,
      `- Hiring active: ${intel.hiring_active === 1 ? "yes" : intel.hiring_active === 0 ? "no" : "unknown"}`,
      `- Acquisition rumors found: ${intel.acquisition_found === 1 ? "yes" : intel.acquisition_found === 0 ? "no" : "unknown"}`,
      `- Google reviews: ${intel.google_review_count ?? "?"} (rating ${intel.google_rating ?? "?"})`,
      `- Owner career stage: ${intel.owner_career_stage ?? "unknown"}`,
      services.length > 0 ? `- Services: ${services.join(", ")}` : "",
      techs.length > 0 ? `- Technology: ${techs.join(", ")}` : "",
      greenFlags.length > 0 ? `- Green flags: ${greenFlags.slice(0, 5).join("; ")}` : "",
      redFlags.length > 0 ? `- Red flags: ${redFlags.slice(0, 5).join("; ")}` : "",
      ``,
      `# Cite-able source URLs (use as [source: domain]):`,
      verUrls.length > 0
        ? verUrls.map((u) => `- ${u} (cite as [source: ${shortDomain(u)}])`).join("\n")
        : "- (no verified URLs — note this in the thesis)"
    )
  } else {
    lines.push(
      ``,
      `# Verified web research`,
      `STATUS: NOT YET COLLECTED. Open the thesis with the required preface and stick to structural signals.`
    )
  }

  return lines.filter(Boolean).join("\n")
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<CompoundNarrativeResponse | { error: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Compound narrative disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable.",
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
      { error: "Invalid request shape — required: practice (with npi), signals[], scores, track" },
      { status: 400 }
    )
  }

  let intel: PracticeIntel | null = null
  try {
    const supabase = getSupabaseServerClient()
    intel = await getPracticeIntelByNpi(supabase, body.practice.npi)
  } catch (err) {
    console.warn(
      `[compound-narrative] practice_intel fetch failed for npi=${body.practice.npi}:`,
      err instanceof Error ? err.message : err
    )
    // Fall through with intel=null — graceful degradation
  }

  const userPrompt = buildUserPrompt(body, intel)

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
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
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
