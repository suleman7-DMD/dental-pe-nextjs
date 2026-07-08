/**
 * Shared display-name contract — DESIGN_TRUTH_APP_SOLUTIONS §2.1.
 *
 * Until the Phase 2 `display_name` column lands, every surface derives the
 * headline name the same way: cleaned DBA, else cleaned legal name with
 * legal suffixes stripped and SHOUTING-CAPS registry style title-cased
 * ("DR. IMTIAZ AHMED, PC" → "Dr. Imtiaz Ahmed"). The raw legal entity is
 * only ever a secondary "Legal entity" line via `legalEntityName` — never
 * the headline. No component may keep a private copy of these rules.
 */

/** Registry placeholder junk ("<UNAVAIL>", "N/A", "null", "none") → null. */
const UNAVAILABLE_RE =
  /^<?\s*(?:unavail|unavailable|not available|none|null|n\/?a)\s*>?$/i

export function cleanNamePart(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed === "" || UNAVAILABLE_RE.test(trimmed)) return null
  return trimmed
}

/** Trailing legal-entity suffixes: ", PC", " LLC", ", S.C.", " LTD", "PLLC"… */
const LEGAL_SUFFIX_RE =
  /[,\s]+(?:p\.?l\.?l\.?c|l\.?l\.?c|l\.?l\.?p|p\.?c|s\.?c|ltd|inc|corp)\.?\s*$/i

/** Tokens that stay uppercase when title-casing a SHOUTING legal name. */
const KEEP_UPPER = new Set(["DDS", "DMD", "MD", "MS", "II", "III", "IV"])

function titleCaseWord(word: string): string {
  if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase()
  return word
    .toLowerCase()
    .replace(/(^|['’.-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

/**
 * Human-format a raw registry name: strip trailing legal suffixes
 * (repeatedly — handles "X, PC, LLC"), then title-case ONLY when the
 * input is all-caps registry style. Mixed-case DBAs pass through as-is.
 */
export function formatEntityName(raw: string): string {
  let name = raw.trim()
  for (let i = 0; i < 3; i++) {
    const next = name.replace(LEGAL_SUFFIX_RE, "").replace(/[,\s]+$/, "").trim()
    if (next === name || next === "") break
    name = next
  }
  const letters = name.replace(/[^a-zA-Z]/g, "")
  const isAllCaps = letters.length > 0 && letters === letters.toUpperCase()
  if (!isAllCaps) return name
  return name.split(/\s+/).map(titleCaseWord).join(" ")
}

/**
 * Loose source shape: covers `Practice`, `PracticeLocationRecord`, and
 * `LaunchpadPracticeRecord` rows without importing any of them.
 * `display_name` is the future Phase 2 column — honored when present.
 */
export interface DisplayNameSource {
  display_name?: string | null
  doing_business_as?: string | null
  practice_name?: string | null
  provider_last_name?: string | null
  address?: string | null
  normalized_address?: string | null
  city?: string | null
  npi?: string | number | null
}

export function displayName(row: DisplayNameSource): string {
  const preferred = cleanNamePart(row.display_name)
  if (preferred) return preferred

  const dba = cleanNamePart(row.doing_business_as)
  if (dba) return formatEntityName(dba)

  const legal = cleanNamePart(row.practice_name)
  if (legal) return formatEntityName(legal)

  const last = cleanNamePart(row.provider_last_name)
  if (last) return `Dr. ${formatEntityName(last)}`

  const address = cleanNamePart(row.address) ?? cleanNamePart(row.normalized_address)
  if (address) return `Practice at ${address}`

  const city = cleanNamePart(row.city)
  if (city) return `Practice in ${city}`

  if (row.npi != null && `${row.npi}`.trim() !== "") return `NPI ${row.npi}`
  return "Unnamed practice"
}

/**
 * Secondary "Legal entity" line: the raw legal name, shown only when it
 * carries information the headline doesn't (i.e. the headline came from a
 * DBA, or formatting changed more than case/suffix noise).
 */
export function legalEntityName(row: DisplayNameSource): string | null {
  const legal = cleanNamePart(row.practice_name)
  if (!legal) return null
  const headline = displayName(row)
  if (formatEntityName(legal).toLowerCase() === headline.toLowerCase()) return null
  return legal
}
