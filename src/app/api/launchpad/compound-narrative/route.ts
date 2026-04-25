import { NextRequest, NextResponse } from "next/server"
import type { CompoundNarrativeRequest, CompoundNarrativeResponse } from "@/lib/launchpad/ai-types"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getPracticeIntelByNpi, getZipIntelByZip } from "@/lib/supabase/queries/intel"
import type { PracticeIntel, ZipQualitativeIntel } from "@/lib/types/intel"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NARRATIVE_MODEL = "claude-sonnet-4-6"
const TEMPERATURE = 0.3
const MAX_TOKENS_VERIFIED = 350
const MAX_TOKENS_PARTIAL = 200

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

// ZIP `sources` field stores either URLs OR plain-text source labels like
// "Redfin (January 2026 housing data)". This extracts a short cite-able label
// from each entry — short domain for URLs, leading non-paren token(s) for text.
function parseZipSourceLabels(s: string | null): string[] {
  if (!s) return []
  let raw: string[] = []
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) {
      raw = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    }
  } catch {
    raw = s.split(/[\n;|]/).map((x) => x.trim()).filter(Boolean)
  }
  const labels = new Set<string>()
  for (const entry of raw) {
    if (entry.startsWith("http")) {
      labels.add(shortDomain(entry))
      continue
    }
    // Take everything before the first paren / dash / comma — that's the source name
    const head = entry.split(/[(,\-–—]/)[0]?.trim()
    if (head && head.length > 0 && head.length < 60) labels.add(head)
  }
  return Array.from(labels).slice(0, 8)
}

// `<cite index="...">x</cite>` artifacts leak in from synthetic ZIP intel rows.
// Strip the wrapper but keep the content.
function stripCiteTags(s: string | null | undefined): string | null {
  if (s == null) return null
  return s.replace(/<cite\s+index="[^"]*"\s*>([\s\S]*?)<\/cite>/gi, "$1").trim()
}

const SYSTEM_PROMPT = [
  "You are a dental private-equity pattern analyst writing a verified investment thesis for a new graduate evaluating this practice.",
  "",
  "NON-NEGOTIABLE RULES:",
  "- Every claim must come from either (a) a structural fact stated in the user message, or (b) a verified source with [source: ...] citation pulled from the supplied source list. Sources may be URLs (cite by domain) or named research providers (cite by provider name, e.g. [source: Redfin]).",
  "- The demand_outlook, supply_outlook, and investment_thesis fields under '# ZIP market intelligence' are themselves structural facts (rule a). Paraphrasing or quoting from them is allowed without a separate citation, though attaching [source: ZIP intel] to such paraphrases is encouraged for transparency.",
  "- Net-new market claims that go BEYOND those structural fields (specific dollar figures, named employers, named competitors, school rankings, etc.) require a [source: ...] citation from the cite-able ZIP source list.",
  "- If neither (a) nor (b) supports a claim, OMIT the claim. Never produce filler analysis to hit a word count.",
  "- Never paraphrase a signal ID into a fact. \"mentor_density\" is a signal label, not evidence of mentorship.",
  "- Never invent doctor names, ages, retirement intent, review counts, or technology lists.",
  "- Reviews/ratings: only cite if a Google or Healthgrades URL is in the source list.",
  "- When ZIP market intelligence is provided, integrate at least one substantive market-level fact alongside practice-level evidence so the thesis reflects both supply/demand context and target-specific structure.",
  "",
  "FORMAT:",
  "- Plain prose, no headers, no bullets.",
  "- 120-170 words when evidence quality is verified AND ZIP intel is provided.",
  "- 100-150 words when evidence quality is verified WITHOUT ZIP intel.",
  "- ≤80 words when evidence quality is partial — recite verified facts only.",
  "- Frame the conclusion in terms of fit for the requested track (succession / high_volume / dso).",
].join("\n")

function buildUserPrompt(
  body: CompoundNarrativeRequest,
  intel: PracticeIntel,
  zipIntel: ZipQualitativeIntel | null,
  evidenceQuality: "verified" | "partial" | "high"
): string {
  const { practice: p, signals, scores, track } = body
  const age =
    p.year_established != null ? new Date().getFullYear() - p.year_established : null

  const greenFlags = parseList(intel.green_flags)
  const redFlags = parseList(intel.red_flags)
  const verUrls = parseUrls(intel.verification_urls).slice(0, 8)
  const services = parseList(intel.services_listed).slice(0, 6)
  const techs = parseList(intel.technology_listed).slice(0, 6)
  const zipUrls = zipIntel ? parseUrls(zipIntel.sources).slice(0, 6) : []
  const zipSourceLabels = zipIntel ? parseZipSourceLabels(zipIntel.sources) : []
  // Combined cite-able set: prefer URLs (cite by domain) but fall through to plain-text labels.
  const zipCiteList: { display: string; label: string }[] = [
    ...zipUrls.map((u) => ({ display: u, label: shortDomain(u) })),
    ...zipSourceLabels
      .filter((label) => !zipUrls.some((u) => shortDomain(u) === label))
      .map((label) => ({ display: label, label })),
  ].slice(0, 8)

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
    ``,
    `# Verified web research`,
    `- Evidence quality (gated): ${evidenceQuality} (${intel.verification_searches ?? 0} web searches)`,
    `- Overall assessment: ${intel.overall_assessment ?? "n/a"}`,
    `- Acquisition readiness: ${intel.acquisition_readiness ?? "n/a"}`,
    `- Confidence: ${intel.confidence ?? "n/a"}`,
    `- Hiring active: ${intel.hiring_active === 1 ? "yes" : intel.hiring_active === 0 ? "no" : "unknown"}`,
    `- Acquisition rumors found: ${intel.acquisition_found === 1 ? "yes" : intel.acquisition_found === 0 ? "no" : "unknown"}`,
    `- Google reviews: ${intel.google_review_count ?? "?"} (rating ${intel.google_rating ?? "?"})`,
    `- Owner career stage: ${intel.owner_career_stage ?? "unknown"}`,
    services.length > 0 ? `- Services: ${services.join(", ")}` : "",
    techs.length > 0 ? `- Technology: ${techs.join(", ")}` : "",
    greenFlags.length > 0 ? `- Green flags: ${greenFlags.slice(0, 5).join("; ")}` : "",
    redFlags.length > 0 ? `- Red flags: ${redFlags.slice(0, 5).join("; ")}` : "",
    ``,
  ]

  if (zipIntel) {
    const demand = stripCiteTags(zipIntel.demand_outlook)
    const supply = stripCiteTags(zipIntel.supply_outlook)
    const thesis = stripCiteTags(zipIntel.investment_thesis)
    lines.push(
      `# ZIP market intelligence (zip ${zipIntel.zip_code}, researched ${zipIntel.research_date ?? "unknown date"})`,
      `- Demand outlook: ${demand ?? "n/a"}`,
      `- Supply outlook: ${supply ?? "n/a"}`,
      `- Investment thesis (analyst-curated): ${thesis ?? "n/a"}`,
      `- Confidence: ${zipIntel.confidence ?? "n/a"}`
    )
    const realEstateBits: string[] = []
    if (zipIntel.median_home_price != null)
      realEstateBits.push(`median home $${zipIntel.median_home_price.toLocaleString()}`)
    if (zipIntel.home_price_yoy_pct != null)
      realEstateBits.push(`${zipIntel.home_price_yoy_pct}% YoY`)
    if (zipIntel.home_price_trend) realEstateBits.push(`trend ${zipIntel.home_price_trend}`)
    if (realEstateBits.length > 0) lines.push(`- Real estate: ${realEstateBits.join(", ")}`)
    if (zipIntel.pop_growth_signals)
      lines.push(`- Population growth: ${stripCiteTags(zipIntel.pop_growth_signals)}`)
    if (zipIntel.pop_demographics)
      lines.push(`- Demographics: ${stripCiteTags(zipIntel.pop_demographics)}`)
    if (zipIntel.major_employers)
      lines.push(`- Major employers: ${stripCiteTags(zipIntel.major_employers)}`)
    if (zipIntel.dental_new_offices)
      lines.push(`- New dental offices nearby: ${stripCiteTags(zipIntel.dental_new_offices)}`)
    if (zipIntel.dental_dso_moves)
      lines.push(`- Recent DSO moves: ${stripCiteTags(zipIntel.dental_dso_moves)}`)
    if (zipIntel.competitor_new)
      lines.push(`- New competitors: ${stripCiteTags(zipIntel.competitor_new)}`)
    if (zipIntel.competitor_closures)
      lines.push(`- Recent closures: ${stripCiteTags(zipIntel.competitor_closures)}`)
    if (zipIntel.housing_status || zipIntel.housing_summary) {
      lines.push(
        `- Housing: ${[stripCiteTags(zipIntel.housing_status), stripCiteTags(zipIntel.housing_summary)].filter(Boolean).join(" — ")}`
      )
    }
    if (zipIntel.school_district || zipIntel.school_rating) {
      lines.push(
        `- Schools: ${[zipIntel.school_district, zipIntel.school_rating].filter(Boolean).join(" rated ")}`
      )
    }
    if (zipCiteList.length > 0) {
      lines.push(
        ``,
        `# Cite-able ZIP sources (use [source: label] for net-new market-level claims):`,
        ...zipCiteList.map((c) =>
          c.display === c.label
            ? `- ${c.label} (cite as [source: ${c.label}])`
            : `- ${c.display} (cite as [source: ${c.label}])`
        ),
        `Citation guidance: paraphrasing demand_outlook / supply_outlook / investment_thesis above is allowed without citation (they ARE the structural facts). Net-new specifics (dollar figures, named employers, named competitors) require [source: ...] from this list.`
      )
    } else {
      lines.push(
        ``,
        `# ZIP sources: (none on file — restrict ZIP commentary to paraphrasing the demand_outlook / supply_outlook / investment_thesis fields above; do not introduce new market specifics)`
      )
    }
    lines.push(``)
  }

  if (verUrls.length > 0) {
    lines.push(
      `# Cite-able source URLs (use [source: domain]):`,
      ...verUrls.map((u) => `- ${u} (cite as [source: ${shortDomain(u)}])`),
      ``,
      `Citation requirement: include at least 2 [source: ...] citations bound to URLs above. Never invent a domain not on this list.`
    )
  } else {
    lines.push(
      `# Cite-able source URLs`,
      `- (none — verified intel without URLs)`,
      ``,
      `No URLs available. Stay strictly inside structural facts above. Cap output at 100 words. No [source: ...] citations required since none can be supported.`
    )
  }

  if (evidenceQuality === "partial") {
    lines.push(
      ``,
      `EVIDENCE QUALITY IS PARTIAL — recite verified facts only. ≤80 words. No analytical leaps.`
    )
  }

  return lines.filter(Boolean).join("\n")
}

function buildStructuralSummary(body: CompoundNarrativeRequest): NonNullable<
  CompoundNarrativeResponse["structural_summary"]
> {
  const { practice: p, signals, scores } = body
  const age =
    p.year_established != null ? new Date().getFullYear() - p.year_established : null

  return {
    name: p.name,
    entity_classification: p.entity_classification ?? null,
    years_in_operation: age,
    providers: p.num_providers ?? null,
    employees: p.employee_count ?? null,
    buyability_score: p.buyability_score ?? null,
    active_signals: signals,
    track_scores: scores,
  }
}

function extractNumericClaims(prose: string): { raw: string; num: string }[] {
  const claims: { raw: string; num: string }[] = []
  const patterns: RegExp[] = [
    /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s?([KMB]?)/gi,
    /(\d+(?:\.\d+)?)\s?%/g,
    /(\d+(?:,\d{3})*)[\s-]+(?:years?|reviews?|employees?|providers?|locations?|patients?|staff|operatories|chairs|sq\s?ft|square\s+feet|miles?)/gi,
    /(\d+(?:\.\d+)?)\s+(?:rating|stars?|out\s+of\s+\d+)/gi,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(prose)) !== null) {
      claims.push({ raw: m[0], num: m[1].replace(/,/g, "") })
    }
  }
  return claims
}

function getNumericVariants(rawClaim: string, numStr: string): string[] {
  const variants = new Set<string>()
  variants.add(numStr)

  const suffixMatch = rawClaim.match(/([KMB])/i)
  if (suffixMatch) {
    const suffix = suffixMatch[1].toUpperCase()
    const base = parseFloat(numStr)
    if (!isNaN(base)) {
      const mult = suffix === "K" ? 1000 : suffix === "M" ? 1000000 : 1000000000
      variants.add(String(Math.round(base * mult)))
      variants.add(String(base * mult))
    }
  }

  const n = parseFloat(numStr)
  if (!isNaN(n)) {
    if (n >= 1000 && n < 1000000) variants.add(String(n / 1000))
    if (n >= 1000000) variants.add(String(n / 1000000))
    if (Number.isInteger(n)) {
      variants.add(String(Math.round(n)))
      if (!numStr.includes(".")) variants.add(`${Math.round(n)}.0`)
    }
  }

  return Array.from(variants)
}

function buildValidationHaystack(
  intel: PracticeIntel,
  zipIntel: ZipQualitativeIntel | null,
  practice: CompoundNarrativeRequest["practice"]
): string {
  const currentYear = new Date().getFullYear()
  const parts: string[] = [JSON.stringify(intel)]

  if (practice.year_established != null) {
    parts.push(String(practice.year_established))
    parts.push(String(currentYear - practice.year_established))
  }
  if (practice.num_providers != null) parts.push(String(practice.num_providers))
  if (practice.employee_count != null) parts.push(String(practice.employee_count))
  if (practice.estimated_revenue != null) parts.push(String(practice.estimated_revenue))
  if (practice.buyability_score != null) parts.push(String(practice.buyability_score))
  if (practice.classification_confidence != null)
    parts.push(String(practice.classification_confidence))
  parts.push(String(currentYear))

  const intelJson = JSON.stringify(intel)
  const yearMatches = intelJson.matchAll(/\b(19\d{2}|20\d{2})\b/g)
  for (const ym of yearMatches) {
    const year = parseInt(ym[1], 10)
    const age = currentYear - year
    if (age > 0 && age < 100) parts.push(String(age))
  }

  if (zipIntel) {
    parts.push(JSON.stringify(zipIntel))
    if (zipIntel.median_home_price != null) parts.push(String(zipIntel.median_home_price))
    if (zipIntel.home_price_yoy_pct != null) parts.push(String(zipIntel.home_price_yoy_pct))
    const zipJson = JSON.stringify(zipIntel)
    const zipYearMatches = zipJson.matchAll(/\b(19\d{2}|20\d{2})\b/g)
    for (const ym of zipYearMatches) {
      const year = parseInt(ym[1], 10)
      const age = currentYear - year
      if (age > 0 && age < 100) parts.push(String(age))
    }
  }

  return parts.join(" ")
}

function validateClaims(
  claims: { raw: string; num: string }[],
  haystack: string
): { ok: boolean; missing: string[] } {
  const haystackNoCommas = haystack.replace(/,/g, "")
  const missing: string[] = []
  for (const claim of claims) {
    const variants = getNumericVariants(claim.raw, claim.num)
    const found = variants.some((v) => {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const re = new RegExp(`(?<!\\d)${escaped}(?!\\d)`)
      return re.test(haystackNoCommas)
    })
    if (!found) missing.push(claim.raw)
  }
  return { ok: missing.length === 0, missing }
}

async function callAnthropic(
  apiKey: string,
  userPrompt: string,
  maxTokens: number
): Promise<{ ok: true; thesis: string } | { ok: false; status: number; error: string }> {
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
        max_tokens: maxTokens,
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
    return {
      ok: false,
      status: 502,
      error: `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "")
    return {
      ok: false,
      status: 502,
      error: `Anthropic error ${upstream.status}: ${text.slice(0, 300)}`,
    }
  }

  const data = (await upstream.json()) as AnthropicResponse
  if (data.error) {
    return { ok: false, status: 502, error: `Anthropic API error: ${data.error.message}` }
  }

  const thesis =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!thesis) {
    return { ok: false, status: 502, error: "Empty thesis returned by Anthropic" }
  }

  return { ok: true, thesis }
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
  let zipIntel: ZipQualitativeIntel | null = null
  try {
    const supabase = getSupabaseServerClient()
    const [intelResult, zipIntelResult] = await Promise.allSettled([
      getPracticeIntelByNpi(supabase, body.practice.npi),
      body.practice.zip
        ? getZipIntelByZip(supabase, body.practice.zip)
        : Promise.resolve(null),
    ])
    if (intelResult.status === "fulfilled") {
      intel = intelResult.value
    } else {
      console.warn(
        `[compound-narrative] practice_intel fetch failed for npi=${body.practice.npi}:`,
        intelResult.reason instanceof Error ? intelResult.reason.message : intelResult.reason
      )
    }
    if (zipIntelResult.status === "fulfilled") {
      zipIntel = zipIntelResult.value
    } else {
      console.warn(
        `[compound-narrative] zip_qualitative_intel fetch failed for zip=${body.practice.zip}:`,
        zipIntelResult.reason instanceof Error ? zipIntelResult.reason.message : zipIntelResult.reason
      )
    }
  } catch (err) {
    console.warn(
      `[compound-narrative] supabase client init failed:`,
      err instanceof Error ? err.message : err
    )
    // Fall through with intel=null and zipIntel=null — handled by gate below
  }

  const intelQuality = intel?.verification_quality ?? null
  // "high" is enum drift from the model — treat as verified for gating
  const reliable = !!intel && (intelQuality === "verified" || intelQuality === "high")
  const partial = !!intel && intelQuality === "partial"
  const noUsable =
    !intel ||
    intelQuality === "insufficient" ||
    intelQuality === "unverified" ||
    !intelQuality

  if (noUsable) {
    return NextResponse.json({
      thesis: null,
      reason: "no_verified_research",
      structural_summary: buildStructuralSummary(body),
    })
  }

  const evidenceQuality: "verified" | "partial" | "high" =
    intelQuality === "high"
      ? "high"
      : reliable
        ? "verified"
        : "partial"

  const verUrlsCount = parseUrls(intel!.verification_urls).length
  const maxTokens =
    evidenceQuality === "partial"
      ? MAX_TOKENS_PARTIAL
      : verUrlsCount === 0
        ? MAX_TOKENS_PARTIAL // no-URL path is also short
        : MAX_TOKENS_VERIFIED

  const userPrompt = buildUserPrompt(body, intel!, zipIntel, evidenceQuality)
  const haystack = buildValidationHaystack(intel!, zipIntel, body.practice)

  const r1 = await callAnthropic(apiKey, userPrompt, maxTokens)
  if (!r1.ok) {
    return NextResponse.json({ error: r1.error }, { status: r1.status })
  }

  const claims1 = extractNumericClaims(r1.thesis)
  const v1 = validateClaims(claims1, haystack)
  if (v1.ok) {
    return NextResponse.json({ thesis: r1.thesis, evidence_quality: evidenceQuality })
  }

  console.warn(
    `[compound-narrative] pass 1 validation failed for npi=${body.practice.npi}: missing=[${v1.missing.join(" | ")}]`
  )

  const retryAddendum = [
    ``,
    ``,
    `PRIOR ATTEMPT FAILED VALIDATION. The following numeric claims in your prior thesis do not appear anywhere in the verified intel above: ${v1.missing.join(", ")}.`,
    `Regenerate the thesis. Remove or replace any number that cannot be sourced from the structural facts or verified intel sections above. Do NOT introduce new numeric claims to compensate. If you cannot meet the citation requirement without those numbers, write a shorter thesis using only claims you can source.`,
  ].join("\n")

  const r2 = await callAnthropic(apiKey, userPrompt + retryAddendum, maxTokens)
  if (!r2.ok) {
    return NextResponse.json({ error: r2.error }, { status: r2.status })
  }

  const claims2 = extractNumericClaims(r2.thesis)
  const v2 = validateClaims(claims2, haystack)
  if (v2.ok) {
    return NextResponse.json({ thesis: r2.thesis, evidence_quality: evidenceQuality })
  }

  console.warn(
    `[compound-narrative] pass 2 validation failed for npi=${body.practice.npi}: missing=[${v2.missing.join(" | ")}] — refusing`
  )

  return NextResponse.json({
    thesis: null,
    reason: "validation_failed",
    structural_summary: buildStructuralSummary(body),
  })
}
