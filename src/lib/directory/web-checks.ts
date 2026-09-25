import type {
  DirectoryWebCheck,
  WebCheckEffect,
} from "@/lib/supabase/queries/directory-web-checks"

/**
 * Directory web-check overlay rules — the ONE place the page decides what a
 * web check does to a row:
 *   removed         → out of the directory list and map (kept in a "removed" list
 *                     with its evidence; the database row is untouched)
 *   open_corrected  → the web-seen name / phone / website / address is displayed
 *   everything else → the row is shown as-is with a status line
 * "No web evidence" never counts against a row.
 */

export interface WebCheckedRow {
  location_id?: string | null
  doing_business_as?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  web_check?: DirectoryWebCheck | null
}

/** Attach the check and, for corrected rows, show the web-seen fields. */
export function applyWebCheck<T extends WebCheckedRow>(row: T, check?: DirectoryWebCheck | null): T {
  if (!check) return row
  const out: T = { ...row, web_check: check }
  if (check.effect !== "open_corrected") return out
  const o = check.observed ?? {}
  // The public name is what the office does business as; the legal/registry
  // name stays in practice_name and remains visible as the secondary line.
  if (o.name?.trim()) out.doing_business_as = o.name.trim()
  if (o.phone?.trim()) out.phone = o.phone.trim()
  if (o.website?.trim()) out.website = o.website.trim()
  if (o.address?.trim()) {
    out.address = o.suite?.trim() ? `${o.address.trim()}, Ste ${o.suite.trim()}` : o.address.trim()
  }
  return out
}

export function isRemovedByWebCheck(
  row: { location_id?: string | null },
  checks: Record<string, DirectoryWebCheck>
): boolean {
  return Boolean(row.location_id && checks[row.location_id]?.effect === "removed")
}

/** Split rows into what the directory shows and what the web check removed. */
export function applyWebChecks<T extends WebCheckedRow>(
  rows: T[],
  checks: Record<string, DirectoryWebCheck>
): { visible: T[]; removed: T[] } {
  const visible: T[] = []
  const removed: T[] = []
  for (const row of rows) {
    const check = row.location_id ? checks[row.location_id] : undefined
    const applied = applyWebCheck(row, check)
    if (check?.effect === "removed") removed.push(applied)
    else visible.push(applied)
  }
  return { visible, removed }
}

export interface WebCheckEffectMeta {
  label: string
  /** Short status line under a practice name in the list. */
  short: string
  color: string
  bg: string
  why: string
}

export const WEB_CHECK_EFFECT_META: Record<WebCheckEffect, WebCheckEffectMeta> = {
  open_verified: {
    label: "Open — confirmed on the web",
    short: "Web-checked: open",
    color: "#2D8B4E",
    bg: "rgba(45,139,78,0.08)",
    why: "The office's own website (or its group's location page) lists this address.",
  },
  open_corrected: {
    label: "Open — details corrected",
    short: "Web-checked: open, details updated",
    color: "#2D8B4E",
    bg: "rgba(45,139,78,0.08)",
    why: "The office's own website lists this address; the name, phone, website or suite shown here come from it.",
  },
  listed_only: {
    label: "Listed only",
    short: "Web-checked: listings only",
    color: "#6B6B60",
    bg: "rgba(156,156,144,0.10)",
    why: "Directory listings show this office here, but there is no current website or map signal. Call before relying on it.",
  },
  needs_review: {
    label: "Needs review",
    short: "Web-checked: needs review",
    color: "#B8860B",
    bg: "rgba(184,134,11,0.08)",
    why: "The web shows a conflict for this row (for example, one office's name with another's phone).",
  },
  no_web_evidence: {
    label: "No web evidence found",
    short: "Web-checked: nothing found",
    color: "#6B6B60",
    bg: "rgba(156,156,144,0.10)",
    why: "Searches found nothing about an office here. This does not mean it is closed.",
  },
  removed: {
    label: "Removed from the directory",
    short: "Removed by web check",
    color: "#C23B3B",
    bg: "rgba(194,59,59,0.06)",
    why: "Positive evidence shows this is not a current general-dentistry office at this address.",
  },
}

export const REMOVAL_REASON_LABELS: Record<string, string> = {
  closed: "Closed",
  moved: "Moved away",
  home_or_registration: "Home or registration address",
  specialist_only: "Specialist-only office",
  nonclinical: "Not a dental clinic",
  duplicate: "Duplicate of another listing",
}

export function removalReasonLabel(reason: string | null | undefined): string {
  return (reason && REMOVAL_REASON_LABELS[reason]) || "Not a current GP office here"
}

export const WEB_CHECK_SIGNAL_LABELS: Record<string, string> = {
  practice_sold: "Practice sold",
  owner_deceased: "Owner deceased",
  owner_retired: "Owner retired",
  successor_practice: "New practice at this address",
  rebranded: "Renamed",
  dso_or_group_branded: "Group / DSO branded",
  multi_location_practice: "Multi-location practice",
  other_offices_in_building: "Other dental offices in building",
  website_dead: "Website on file is dead",
  website_wrong_business: "Website on file is another business",
  phone_belongs_elsewhere: "Phone on file belongs elsewhere",
  real_estate_listing: "Real-estate listing for address",
  home_address: "Residential address",
  hiring_seen: "Hiring page seen",
}

export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  first_party_site: "Office website",
  dso_locator: "Group location page",
  maps_panel: "Maps listing",
  iema_registry: "State X-ray registry",
  listing: "Directory listing",
  registry: "NPI registry mirror",
  real_estate: "Real-estate listing",
  news_or_obituary: "News / obituary",
  other: "Other source",
}

export function evidenceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
