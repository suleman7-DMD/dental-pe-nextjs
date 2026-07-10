// ────────────────────────────────────────────────────────────────────────────
// Trust-source tags — every key fact a user might act on (phone, address,
// website, staffing, doctors) carries a small label saying WHERE the value
// came from and how much to trust it. Six classes, per the PM ruling:
//
//   website_verified   checked on the practice's own website, evidence on file
//   ownership_reviewed a human reviewer assigned this from ownership evidence
//   registry_only      federal NPI registry (NPPES) — filings, often stale
//   commercial_estimate purchased business-data feed (Data Axle) — unchecked
//   suspected_wrong    our own check contradicts this value
//   missing            no source has this fact
//
// No "use client" directive — server pages and client shells both render tags.
// ────────────────────────────────────────────────────────────────────────────

export type TrustSource =
  | "website_verified"
  | "ownership_reviewed"
  | "registry_only"
  | "commercial_estimate"
  | "suspected_wrong"
  | "missing"

export const TRUST_SOURCE_META: Record<
  TrustSource,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  website_verified: {
    label: "Website-verified",
    color: "#166534",
    bg: "rgba(22,101,52,0.08)",
    border: "rgba(22,101,52,0.25)",
    description:
      "Checked on the practice's own website by our verification pass — evidence URLs are on file.",
  },
  ownership_reviewed: {
    label: "Ownership-reviewed",
    color: "#8B6508",
    bg: "rgba(184,134,11,0.08)",
    border: "rgba(184,134,11,0.25)",
    description:
      "A human reviewer assigned this from ownership evidence (locator pages, registries, filings).",
  },
  registry_only: {
    label: "Registry only",
    color: "#6B6B60",
    bg: "rgba(107,107,96,0.07)",
    border: "#E8E5DE",
    description:
      "From the federal NPI registry (NPPES). Practices rarely update their filings — treat as possibly stale until checked.",
  },
  commercial_estimate: {
    label: "Commercial estimate",
    color: "#6B6B60",
    bg: "rgba(107,107,96,0.07)",
    border: "#E8E5DE",
    description:
      "From a purchased business-data feed (Data Axle). An estimate we have not checked — not a verified fact.",
  },
  suspected_wrong: {
    label: "Suspected wrong",
    color: "#C23B3B",
    bg: "rgba(194,59,59,0.08)",
    border: "rgba(194,59,59,0.3)",
    description:
      "Our own website check contradicts this value — do not act on it until it is re-verified.",
  },
  missing: {
    label: "Missing",
    color: "#8F8E82",
    bg: "transparent",
    border: "#E8E5DE",
    description: "No source we hold has this fact yet.",
  },
}

export function TrustSourceTag({
  source,
  className,
}: {
  source: TrustSource
  className?: string
}) {
  const meta = TRUST_SOURCE_META[source]
  return (
    <span
      title={meta.description}
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-medium leading-4 ${className ?? ""}`}
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
      }}
    >
      {meta.label}
    </span>
  )
}

/** Minimal slice of a job_hunt_verification row the website ruling needs. */
export interface WebsiteVerificationInput {
  website_url?: string | null
  website_status?: string | null
}

/**
 * The single ruling for "which website do we show, and how much do we trust
 * it?" — shared by every surface so the label can never drift from the link.
 *
 *  · verification found a live site  → that URL, website_verified
 *  · verification found NO usable site but a URL is still on file
 *                                     → the stored URL, suspected_wrong
 *  · no verification yet, URL on file → the stored URL, commercial_estimate
 *    (websites come from the purchased feed; the registry has no website field)
 *  · nothing anywhere                 → missing
 */
export function websiteTrust(
  storedWebsite: string | null | undefined,
  verification?: WebsiteVerificationInput | null
): { url: string | null; source: TrustSource } {
  const stored = (storedWebsite ?? "").trim()
  const verifiedUrl = (verification?.website_url ?? "").trim()
  if (verification) {
    if (verification.website_status === "live" && verifiedUrl) {
      return { url: verifiedUrl, source: "website_verified" }
    }
    // Checked, and no usable site exists — any URL still on file is bad data.
    if (stored) return { url: stored, source: "suspected_wrong" }
    return { url: null, source: "missing" }
  }
  if (stored) return { url: stored, source: "commercial_estimate" }
  return { url: null, source: "missing" }
}
