import { NextRequest, NextResponse } from "next/server"
import type {
  CompoundNarrativeRequest,
  CompoundNarrativeResponse,
  LedgerAtom,
} from "@/lib/launchpad/ai-types"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getPracticeIntelByNpi, getZipIntelByZip } from "@/lib/supabase/queries/intel"
import { getDealCompsForPractice, type DealCompsSummary } from "@/lib/supabase/queries/deals"
import {
  getPracticeSignalsByNpi,
  type PracticePeerPercentiles,
} from "@/lib/supabase/queries/warroom"
import type { PracticeIntel, ZipQualitativeIntel } from "@/lib/types/intel"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// Two-pass extract→synthesize architecture (#26)
// Pass 1: Haiku 4.5 reads full intel dump → emits JSON evidence ledger
// Pass 2: Sonnet 4.6 receives ONLY ledger + header → writes thesis
// ---------------------------------------------------------------------------

const SYNTHESIZER_MODEL = "claude-sonnet-4-6"
const EXTRACTOR_MODEL = "claude-haiku-4-5-20251001"
const TEMPERATURE_SYNTH = 0.3
const TEMPERATURE_EXTRACT = 0.0
const MAX_TOKENS_VERIFIED = 500
const MAX_TOKENS_PARTIAL = 280
const EXTRACTOR_MAX_TOKENS = 4000
const MIN_LEDGER_ATOMS = 3
const MAX_LEDGER_ATOMS_HINT = 30

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { type: string; message: string }
}

// LedgerAtom + LedgerCategory imported from "@/lib/launchpad/ai-types" — shared with client

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
    const head = entry.split(/[(,\-–—]/)[0]?.trim()
    if (head && head.length > 0 && head.length < 60) labels.add(head)
  }
  return Array.from(labels).slice(0, 8)
}

function stripCiteTags(s: string | null | undefined): string | null {
  if (s == null) return null
  return s.replace(/<cite\s+index="[^"]*"\s*>([\s\S]*?)<\/cite>/gi, "$1").trim()
}

// ---------------------------------------------------------------------------
// EXTRACTOR (Pass 1): full intel dump → JSON ledger of atoms
// ---------------------------------------------------------------------------

const EXTRACTOR_SYSTEM_PROMPT = [
  "You are an evidence extractor for a dental private-equity analyst. You read raw practice and ZIP intel, then emit a JSON ledger of discrete, source-attributed evidence atoms. NO PROSE.",
  "",
  "OUTPUT CONTRACT:",
  "- Emit ONLY a JSON array. No code fences, no commentary, no preamble.",
  "- Each element is an atom: {\"label\": string, \"value\": string, \"source_label\": string, \"category\": string, \"confidence\": string}",
  "- label: short noun phrase (≤6 words) describing what the atom is. e.g. \"Years in operation\", \"Owner career stage\", \"Median home price\"",
  "- value: concrete value, ≤25 words. Numbers stay as in source (don't round). e.g. \"22 years\", \"late-career, near retirement\", \"$680,000\"",
  "- source_label: where the value comes from. Pick from this hierarchy:",
  "  1. Bare URL domain (e.g. \"yelp.com\", \"google.com\", \"healthgrades.com\") — use when the value is sourced from a specific verification URL or known web platform (Google reviews → google.com, Healthgrades reviews → healthgrades.com, Yelp reviews → yelp.com).",
  "  2. Named research provider (e.g. \"Redfin\", \"DataUSA\", \"NPPES\", \"Data Axle\") — use when the value is sourced from a named ZIP-level research provider listed in the source labels.",
  "  3. \"structural\" — use ONLY for facts in the '# Practice header (structural facts)' section above.",
  "  4. \"practice intel\" — use for facts in the '# Verified web research' section that DON'T have a specific URL or platform (overall_assessment, acquisition_readiness, owner_career_stage, hiring_active, services, technology, green/red flags, ppo_heavy, accepts_medicaid, etc.).",
  "  5. \"ZIP intel\" — use ONLY for the ZIP synthesis fields demand_outlook / supply_outlook / investment_thesis. Net-new ZIP specifics (median home price, employer names, demographics, dental landscape) should cite the named provider when given (Redfin, etc.) — fall back to \"ZIP intel\" only if no provider was named in the source.",
  "  CRITICAL: Do NOT tag practice-level intel facts as \"ZIP intel\" — that's the most common mislabel. ZIP intel is ONLY for market-level facts about the geography.",
  "  6. \"deal comps\" — use ONLY for facts in the '# Deal comp signals' section (state-level recent-deal volume, top acquirer, freshest deal date, deal size/multiple medians).",
  "  7. \"peer percentile\" — use ONLY for facts in the '# Peer percentile signals' section (this practice's relative position vs. entity_classification peers, with or without ZIP scope).",
  "- category: one of {\"structural\", \"operational\", \"financial\", \"market\", \"signal\"}",
  "  - structural: years in operation, providers, employees, entity classification, location",
  "  - operational: services, technology, hiring activity, owner career stage, reviews",
  "  - financial: revenue, comp signals, buyability score, ownership status",
  "  - market: ZIP-level demand/supply outlook, demographics, real estate, employers, dental landscape",
  "  - signal: red flags, green flags, acquisition rumors, succession intent",
  "- confidence: \"high\" if value is from a verified web source (URL or named provider), \"medium\" if from analyst-curated synthesis (demand_outlook, supply_outlook, investment_thesis, structural fields), \"low\" if from inference or partial evidence.",
  "",
  "EXTRACTION RULES:",
  `- Cap the ledger at ${MAX_LEDGER_ATOMS_HINT} atoms. If you have more material than that, prioritize in this order: (1) structural snapshot, (2) peer-percentile signals (buyability/retirement vs ZIP+class peers — these atoms have source_label = "peer percentile"), (3) financial metrics, (4) owner career stage, (5) reviews, (6) hiring/acquisition signals, (7) deal comps, (8) ZIP demographic context. Drop low-signal trivia FIRST (e.g. work-from-home %, mean travel time, racial composition, generic median income). Never drop a peer-percentile or deal-comps atom to make room for ZIP demographics.`,
  "- Extract every material fact within the cap. Do not editorialize. Do not summarize.",
  "- If a field is null or missing, skip it — never invent a value.",
  "- One atom per discrete fact. Don't combine \"5 employees and $800k revenue\" into one atom — emit two.",
  "- Reviews/ratings: only emit if the source is Google or Healthgrades. Skip otherwise.",
  "- Signal IDs (e.g. \"mentor_density\") are NOT facts — never emit them as atoms.",
  "- Doctor names, ages, retirement intent: only emit if explicitly stated in source. Never infer.",
  "- If the entire intel is empty / says \"n/a\" / has no usable values, return [] (empty array).",
].join("\n")

function hasMeaningfulPercentile(p: PracticePeerPercentiles | null): boolean {
  if (!p) return false
  return (
    p.buyability_pctile_zip_class != null ||
    p.buyability_pctile_class != null ||
    p.retirement_pctile_zip_class != null ||
    p.retirement_pctile_class != null ||
    p.deal_catchment_24mo != null
  )
}

function buildExtractorPrompt(
  body: CompoundNarrativeRequest,
  intel: PracticeIntel,
  zipIntel: ZipQualitativeIntel | null,
  comps: DealCompsSummary | null,
  percentiles: PracticePeerPercentiles | null
): string {
  const { practice: p, signals } = body
  const age =
    p.year_established != null ? new Date().getFullYear() - p.year_established : null

  const greenFlags = parseList(intel.green_flags)
  const redFlags = parseList(intel.red_flags)
  const verUrls = parseUrls(intel.verification_urls).slice(0, 8)
  const services = parseList(intel.services_listed).slice(0, 6)
  const techs = parseList(intel.technology_listed).slice(0, 6)

  const lines: string[] = [
    `# Practice header (structural facts — source_label = "structural")`,
    `- Name: ${p.name || "Unknown"}${p.dba ? ` (dba ${p.dba})` : ""}`,
    `- Location: ${p.city ?? "?"}, ${p.state ?? "?"} ${p.zip ?? ""}`,
    `- Entity classification: ${p.entity_classification ?? "unclassified"}`,
    `- Years in operation: ${age != null ? age : "unknown"}`,
    `- Year established: ${p.year_established ?? "unknown"}`,
    `- Providers: ${p.num_providers ?? "unknown"}`,
    `- Employees: ${p.employee_count ?? "unknown"}`,
    `- Estimated revenue: ${p.estimated_revenue != null ? `$${p.estimated_revenue.toLocaleString()}` : "unknown"}`,
    `- Buyability score: ${p.buyability_score ?? "unscored"}`,
    `- Affiliated DSO: ${p.affiliated_dso ?? "none"}`,
    `- Website on file: ${p.website ?? "none"}`,
    ``,
    `# Active structural signal IDs (DO NOT extract as atoms — these are pattern labels, not facts)`,
    signals.length > 0 ? signals.map((s) => `- ${s}`).join("\n") : "- (none)",
    ``,
    `# Verified web research (source_label = "practice intel" for synthesis fields below; use specific URL domain ONLY for review counts/ratings tied to a known platform)`,
    `- Overall assessment [source_label: practice intel]: ${intel.overall_assessment ?? "n/a"}`,
    `- Acquisition readiness [source_label: practice intel]: ${intel.acquisition_readiness ?? "n/a"}`,
    `- Confidence [source_label: practice intel]: ${intel.confidence ?? "n/a"}`,
    `- Hiring active [source_label: practice intel]: ${intel.hiring_active === 1 ? "yes" : intel.hiring_active === 0 ? "no" : "unknown"}`,
    `- Acquisition rumors found [source_label: practice intel]: ${intel.acquisition_found === 1 ? "yes" : intel.acquisition_found === 0 ? "no" : "unknown"}`,
    `- Google reviews [source_label: google.com]: ${intel.google_review_count ?? "?"} (rating ${intel.google_rating ?? "?"})`,
    `- Owner career stage [source_label: practice intel]: ${intel.owner_career_stage ?? "unknown"}`,
    services.length > 0 ? `- Services [source_label: practice intel]: ${services.join(", ")}` : "",
    techs.length > 0 ? `- Technology [source_label: practice intel]: ${techs.join(", ")}` : "",
    greenFlags.length > 0 ? `- Green flags [source_label: practice intel]: ${greenFlags.slice(0, 5).join("; ")}` : "",
    redFlags.length > 0 ? `- Red flags [source_label: practice intel]: ${redFlags.slice(0, 5).join("; ")}` : "",
    verUrls.length > 0 ? `- Verification URLs (use these as source_label when a specific fact above ties to one): ${verUrls.join(", ")}` : "",
    ``,
  ]

  if (zipIntel) {
    const demand = stripCiteTags(zipIntel.demand_outlook)
    const supply = stripCiteTags(zipIntel.supply_outlook)
    const thesis = stripCiteTags(zipIntel.investment_thesis)
    const zipUrls = parseUrls(zipIntel.sources).slice(0, 6)
    const zipLabels = parseZipSourceLabels(zipIntel.sources)
    lines.push(
      `# ZIP market intelligence (source_label = "ZIP intel" for the 3 synthesis fields below; use named provider — Redfin, DataUSA, etc. — for net-new market specifics)`,
      `- ZIP: ${zipIntel.zip_code}`,
      `- Researched: ${zipIntel.research_date ?? "unknown"}`,
      `- Confidence: ${zipIntel.confidence ?? "n/a"}`,
      `- Demand outlook [source_label: ZIP intel]: ${demand ?? "n/a"}`,
      `- Supply outlook [source_label: ZIP intel]: ${supply ?? "n/a"}`,
      `- Investment thesis [source_label: ZIP intel]: ${thesis ?? "n/a"}`
    )
    if (zipIntel.median_home_price != null)
      lines.push(`- Median home price [source_label: Redfin]: $${zipIntel.median_home_price.toLocaleString()}`)
    if (zipIntel.home_price_yoy_pct != null)
      lines.push(`- Home price YoY change [source_label: Redfin]: ${zipIntel.home_price_yoy_pct}%`)
    if (zipIntel.home_price_trend) lines.push(`- Home price trend [source_label: Redfin]: ${zipIntel.home_price_trend}`)
    if (zipIntel.pop_growth_signals)
      lines.push(`- Population growth [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.pop_growth_signals)}`)
    if (zipIntel.pop_demographics)
      lines.push(`- Demographics [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.pop_demographics)}`)
    if (zipIntel.major_employers)
      lines.push(`- Major employers [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.major_employers)}`)
    if (zipIntel.dental_new_offices)
      lines.push(`- New dental offices [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.dental_new_offices)}`)
    if (zipIntel.dental_dso_moves)
      lines.push(`- Recent DSO moves [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.dental_dso_moves)}`)
    if (zipIntel.competitor_new) lines.push(`- New competitors [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.competitor_new)}`)
    if (zipIntel.competitor_closures)
      lines.push(`- Recent closures [source_label: pick named provider from sources, fallback ZIP intel]: ${stripCiteTags(zipIntel.competitor_closures)}`)
    if (zipIntel.housing_status || zipIntel.housing_summary)
      lines.push(
        `- Housing [source_label: Redfin if specific, else ZIP intel]: ${[stripCiteTags(zipIntel.housing_status), stripCiteTags(zipIntel.housing_summary)].filter(Boolean).join(" — ")}`
      )
    if (zipIntel.school_district || zipIntel.school_rating)
      lines.push(
        `- Schools [source_label: ZIP intel]: ${[zipIntel.school_district, zipIntel.school_rating].filter(Boolean).join(" rated ")}`
      )
    if (zipUrls.length > 0) lines.push(`- ZIP URLs (cite by domain): ${zipUrls.join(", ")}`)
    if (zipLabels.length > 0) lines.push(`- Named ZIP providers (use these as source_label, NOT "ZIP intel"): ${zipLabels.join(", ")}`)
    lines.push(``)
  }

  if (comps) {
    lines.push(
      `# Deal comp signals (source_label = "deal comps"; category = "market")`,
      `- State scope: ${comps.state}`,
      `- Window: last ${comps.windowMonths} months`,
      `- Total deals in state: ${comps.totalCount}`
    )
    if (comps.specialty && comps.specialtyCount != null) {
      lines.push(`- ${comps.specialty} deals in state: ${comps.specialtyCount}`)
    }
    if (comps.topPlatform) {
      lines.push(
        `- Most active platform: ${comps.topPlatform.name} (${comps.topPlatform.count} deals)`
      )
    }
    if (comps.topPeSponsor) {
      lines.push(
        `- Most active PE sponsor: ${comps.topPeSponsor.name} (${comps.topPeSponsor.count} deals)`
      )
    }
    if (comps.freshestDate) lines.push(`- Freshest deal date: ${comps.freshestDate}`)
    if (comps.medianSizeMM != null)
      lines.push(`- Median deal size: $${comps.medianSizeMM}M`)
    if (comps.medianEbitdaMultiple != null)
      lines.push(`- Median EBITDA multiple: ${comps.medianEbitdaMultiple}x`)
    lines.push(``)
  }

  if (hasMeaningfulPercentile(percentiles) && percentiles) {
    lines.push(
      `# Peer percentile signals (source_label = "peer percentile"; category = "signal")`,
      `- Methodology: percentiles compare this practice to other ${p.entity_classification ?? "same-class"} practices, scoped within ZIP and across the full class. Higher = more attractive on that dimension.`
    )
    if (percentiles.buyability_pctile_zip_class != null)
      lines.push(
        `- Buyability percentile (within ZIP + class): ${percentiles.buyability_pctile_zip_class}`
      )
    if (percentiles.buyability_pctile_class != null)
      lines.push(
        `- Buyability percentile (within class, all ZIPs): ${percentiles.buyability_pctile_class}`
      )
    if (percentiles.retirement_pctile_zip_class != null)
      lines.push(
        `- Retirement-risk percentile (within ZIP + class): ${percentiles.retirement_pctile_zip_class}`
      )
    if (percentiles.retirement_pctile_class != null)
      lines.push(
        `- Retirement-risk percentile (within class, all ZIPs): ${percentiles.retirement_pctile_class}`
      )
    if (percentiles.high_peer_retirement_flag === true)
      lines.push(`- High peer retirement flag: tripped (top decile retirement risk vs peers)`)
    if (percentiles.deal_catchment_24mo != null)
      lines.push(
        `- Deal catchment score (24mo, normalized 0-1): ${percentiles.deal_catchment_24mo}`
      )
    lines.push(``)
  }

  lines.push(
    `Emit the JSON ledger now. JSON array only — no code fences, no preamble.`
  )

  return lines.filter(Boolean).join("\n")
}

function isLedgerAtom(x: unknown): x is LedgerAtom {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  if (typeof o.label !== "string" || o.label.trim().length === 0) return false
  if (typeof o.value !== "string" || o.value.trim().length === 0) return false
  if (typeof o.source_label !== "string" || o.source_label.trim().length === 0) return false
  if (typeof o.category !== "string") return false
  if (!["structural", "operational", "financial", "market", "signal"].includes(o.category)) return false
  if (typeof o.confidence !== "string") return false
  if (!["high", "medium", "low"].includes(o.confidence)) return false
  return true
}

function parseLedger(raw: string): LedgerAtom[] {
  // Strip markdown code fences if model ignored the no-fence rule
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : raw
  const start = candidate.indexOf("[")
  if (start === -1) return []

  // Fast path: response is well-formed and has a closing bracket we can use
  const end = candidate.lastIndexOf("]")
  if (end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1))
      if (Array.isArray(parsed)) {
        const atoms = parsed.filter(isLedgerAtom)
        if (atoms.length > 0) return atoms
      }
    } catch {
      // fall through to recovery path
    }
  }

  // Recovery path: response was truncated mid-atom (Haiku ran out of tokens).
  // Find every `}` after the opening `[` and try to JSON.parse the prefix
  // closed with `]` until one parses. Keeps the largest valid prefix.
  const body = candidate.slice(start)
  let lastValid: LedgerAtom[] = []
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "}") continue
    const attempt = body.slice(0, i + 1) + "]"
    try {
      const parsed = JSON.parse(attempt)
      if (Array.isArray(parsed)) {
        const atoms = parsed.filter(isLedgerAtom)
        if (atoms.length > lastValid.length) lastValid = atoms
      }
    } catch {
      // keep scanning
    }
  }
  return lastValid
}

// ---------------------------------------------------------------------------
// SYNTHESIZER (Pass 2): ledger + practice header → thesis prose
// ---------------------------------------------------------------------------

const SYNTHESIZER_SYSTEM_PROMPT = [
  "You are a dental private-equity pattern analyst writing a verified investment thesis for a new graduate evaluating this practice.",
  "",
  "INPUT CONTRACT:",
  "You receive a JSON evidence ledger of atoms — each atom is {label, value, source_label, category, confidence}. The ledger is the ONLY source of facts you may use. You also receive a minimal practice header (name, city, state, requested track) and track scores. Do not invent any fact that is not in the ledger.",
  "",
  "NON-NEGOTIABLE RULES:",
  "- Every claim in your thesis must be supported by an atom in the ledger.",
  "- Cite by source_label using bracket notation: [source: <source_label>]. e.g. [source: yelp.com], [source: Redfin], [source: structural], [source: ZIP intel].",
  "- Numbers must match the atom value EXACTLY. Don't round, don't convert units, don't compose new figures from atoms.",
  "- If the ledger lacks evidence to support a claim, OMIT the claim. Never produce filler analysis to hit a word count.",
  "- Never invent doctor names, ages, retirement intent, review counts, technology lists, or financial figures.",
  "- Reviews/ratings: only cite when the atom's source_label is google.com / healthgrades.com / similar.",
  "",
  "FORMAT:",
  "- Plain prose, no headers, no bullets.",
  "- 120-170 words when the ledger contains BOTH practice-level and market-level atoms.",
  "- 100-150 words when the ledger contains only practice-level atoms.",
  "- ≤80 words when the ledger has fewer than 6 atoms.",
  "- Open with the structural snapshot. Weave in operational, financial, and (if present) market signals. Close with one sentence framing fit for the requested track (succession / high_volume / dso).",
  "- Use at minimum 2 distinct [source: ...] citations across the thesis. If only one source_label is available, use it more than once.",
].join("\n")

function buildSynthesizerPrompt(
  body: CompoundNarrativeRequest,
  ledger: LedgerAtom[]
): string {
  const { practice: p, scores, track } = body
  const lines: string[] = [
    `# Practice header (minimal — for framing only)`,
    `- Name: ${p.name || "Unknown"}`,
    `- City/State: ${p.city ?? "?"}, ${p.state ?? "?"}`,
    `- Requested track: ${track}`,
    ``,
    `# Track scores (0-100, for fit framing)`,
    `- succession: ${scores.succession}`,
    `- high_volume: ${scores.high_volume}`,
    `- dso: ${scores.dso}`,
    ``,
    `# Evidence ledger (${ledger.length} atoms — the ONLY facts you may cite)`,
    JSON.stringify(ledger, null, 2),
    ``,
    `# Available source_labels for citation`,
    ...Array.from(new Set(ledger.map((a) => a.source_label))).map((s) => `- ${s}`),
    ``,
    `Write the thesis now. Plain prose. Paraphrase from atoms only. Cite with [source: <source_label>].`,
  ]
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Numeric claim validation (defense in depth)
// ---------------------------------------------------------------------------

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

function buildLedgerHaystack(ledger: LedgerAtom[]): string {
  return JSON.stringify(ledger)
}

function buildFallbackHaystack(
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

// ---------------------------------------------------------------------------
// Generic Anthropic caller (used by both passes)
// ---------------------------------------------------------------------------

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
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
        model,
        max_tokens: maxTokens,
        temperature,
        system: [
          {
            type: "text",
            text: systemPrompt,
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

  const text =
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""

  if (!text) {
    return { ok: false, status: 502, error: "Empty response returned by Anthropic" }
  }

  return { ok: true, text }
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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
  let comps: DealCompsSummary | null = null
  let percentiles: PracticePeerPercentiles | null = null
  try {
    const supabase = getSupabaseServerClient()
    const inferredSpecialty =
      body.practice.entity_classification === "specialist" ? null : "general"
    const [intelResult, zipIntelResult, compsResult, percentilesResult] =
      await Promise.allSettled([
        getPracticeIntelByNpi(supabase, body.practice.npi),
        body.practice.zip
          ? getZipIntelByZip(supabase, body.practice.zip)
          : Promise.resolve(null),
        getDealCompsForPractice(supabase, body.practice.state, inferredSpecialty),
        getPracticeSignalsByNpi(body.practice.npi, supabase),
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
    if (compsResult.status === "fulfilled") {
      comps = compsResult.value
    } else {
      console.warn(
        `[compound-narrative] deal comps fetch failed for state=${body.practice.state}:`,
        compsResult.reason instanceof Error ? compsResult.reason.message : compsResult.reason
      )
    }
    if (percentilesResult.status === "fulfilled") {
      percentiles = percentilesResult.value
    } else {
      console.warn(
        `[compound-narrative] practice_signals fetch failed for npi=${body.practice.npi}:`,
        percentilesResult.reason instanceof Error
          ? percentilesResult.reason.message
          : percentilesResult.reason
      )
    }
  } catch (err) {
    console.warn(
      `[compound-narrative] supabase client init failed:`,
      err instanceof Error ? err.message : err
    )
  }

  const intelQuality = intel?.verification_quality ?? null
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

  // ----------------------------------------------------------------
  // Pass 1: Extract evidence ledger via Haiku
  // ----------------------------------------------------------------
  const extractorPrompt = buildExtractorPrompt(body, intel!, zipIntel, comps, percentiles)
  const extractResult = await callAnthropic(
    apiKey,
    EXTRACTOR_MODEL,
    EXTRACTOR_SYSTEM_PROMPT,
    extractorPrompt,
    EXTRACTOR_MAX_TOKENS,
    TEMPERATURE_EXTRACT
  )
  if (!extractResult.ok) {
    console.warn(
      `[compound-narrative] extractor (Pass 1) failed for npi=${body.practice.npi}: ${extractResult.error}`
    )
    return NextResponse.json({ error: extractResult.error }, { status: extractResult.status })
  }

  const ledger = parseLedger(extractResult.text)

  if (ledger.length < MIN_LEDGER_ATOMS) {
    console.warn(
      `[compound-narrative] ledger below floor for npi=${body.practice.npi}: atoms=${ledger.length} (min=${MIN_LEDGER_ATOMS}) — refusing`
    )
    return NextResponse.json({
      thesis: null,
      reason: "no_verified_research",
      structural_summary: buildStructuralSummary(body),
    })
  }

  // ----------------------------------------------------------------
  // Pass 2: Synthesize thesis from ledger only
  // ----------------------------------------------------------------
  const synthesizerPrompt = buildSynthesizerPrompt(body, ledger)
  const maxTokens =
    evidenceQuality === "partial" || ledger.length < 6
      ? MAX_TOKENS_PARTIAL
      : MAX_TOKENS_VERIFIED

  const ledgerHaystack = buildLedgerHaystack(ledger)
  const fallbackHaystack = buildFallbackHaystack(intel!, zipIntel, body.practice)

  const r1 = await callAnthropic(
    apiKey,
    SYNTHESIZER_MODEL,
    SYNTHESIZER_SYSTEM_PROMPT,
    synthesizerPrompt,
    maxTokens,
    TEMPERATURE_SYNTH
  )
  if (!r1.ok) {
    return NextResponse.json({ error: r1.error }, { status: r1.status })
  }

  const claims1 = extractNumericClaims(r1.text)
  // Primary haystack: ledger. Fallback: raw intel (prevents over-rejection during rollout).
  let v1 = validateClaims(claims1, ledgerHaystack)
  if (!v1.ok) {
    const fallback1 = validateClaims(claims1, fallbackHaystack)
    if (fallback1.ok) {
      console.warn(
        `[compound-narrative] pass 1 ledger-validation failed but fallback OK for npi=${body.practice.npi}: missing=[${v1.missing.join(" | ")}]`
      )
      v1 = fallback1
    }
  }
  if (v1.ok) {
    return NextResponse.json({ thesis: r1.text, evidence_quality: evidenceQuality, ledger })
  }

  console.warn(
    `[compound-narrative] pass 1 validation failed for npi=${body.practice.npi}: missing=[${v1.missing.join(" | ")}]`
  )

  const retryAddendum = [
    ``,
    ``,
    `PRIOR ATTEMPT FAILED VALIDATION. The following numeric claims in your prior thesis are not supported by any atom in the ledger: ${v1.missing.join(", ")}.`,
    `Regenerate the thesis. Remove or replace any number that does not match an atom value exactly. Do NOT introduce new numeric claims to compensate. If you cannot meet the citation requirement without those numbers, write a shorter thesis using only atoms you can cite.`,
  ].join("\n")

  const r2 = await callAnthropic(
    apiKey,
    SYNTHESIZER_MODEL,
    SYNTHESIZER_SYSTEM_PROMPT,
    synthesizerPrompt + retryAddendum,
    maxTokens,
    TEMPERATURE_SYNTH
  )
  if (!r2.ok) {
    return NextResponse.json({ error: r2.error }, { status: r2.status })
  }

  const claims2 = extractNumericClaims(r2.text)
  let v2 = validateClaims(claims2, ledgerHaystack)
  if (!v2.ok) {
    const fallback2 = validateClaims(claims2, fallbackHaystack)
    if (fallback2.ok) {
      console.warn(
        `[compound-narrative] pass 2 ledger-validation failed but fallback OK for npi=${body.practice.npi}: missing=[${v2.missing.join(" | ")}]`
      )
      v2 = fallback2
    }
  }
  if (v2.ok) {
    return NextResponse.json({ thesis: r2.text, evidence_quality: evidenceQuality, ledger })
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
