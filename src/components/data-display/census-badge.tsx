import { cn } from "@/lib/utils"
import {
  OWNERSHIP_TIERS,
  TIER_META as CONTRACT_TIER_META,
  type OwnershipTier,
} from "@/lib/census/ownership-truth"

export type ReviewStatus = "verified" | "needs_evidence" | "not_reviewed"

interface OwnershipTierMeta {
  label: string
  shortLabel: string
  description: string
  className: string
}

const BASE_BADGE =
  "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight"

// Chip styling is presentational and lives here; labels/descriptions come from
// the ownership-truth contract so no badge can drift from ratified semantics.
const TIER_CLASSNAMES: Record<OwnershipTier, string> = {
  true_independent: "border-[#2563EB]/25 bg-[#EFF6FF] text-[#1D4ED8]",
  single_loc_group: "border-[#0D9488]/25 bg-[#F0FDFA] text-[#0F766E]",
  dentist_multi: "border-[#6366F1]/25 bg-[#EEF2FF] text-[#4F46E5]",
  stealth_dso: "border-[#D4920B]/30 bg-[#FFF7E5] text-[#98690A]",
  branded_dso: "border-[#C23B3B]/25 bg-[#FEF2F2] text-[#B91C1C]",
  institutional: "border-[#6B7280]/25 bg-[#F3F4F6] text-[#4B5563]",
}

const TIER_META: Record<string, OwnershipTierMeta> = {
  ...Object.fromEntries(
    OWNERSHIP_TIERS.map((tier) => [
      tier,
      {
        label: CONTRACT_TIER_META[tier].label,
        shortLabel: CONTRACT_TIER_META[tier].shortLabel,
        description: CONTRACT_TIER_META[tier].description,
        className: TIER_CLASSNAMES[tier],
      },
    ])
  ),
  undetermined: {
    label: "Needs Evidence",
    shortLabel: "Needs Evidence",
    description: "Reviewed, but evidence was not strong enough to classify.",
    className: "border-[#B8860B]/25 bg-[#FFFBEB] text-[#8B6508]",
  },
}

const NOT_REVIEWED_META: OwnershipTierMeta = {
  label: "Not Reviewed Yet",
  shortLabel: "Not Reviewed",
  description: "No synced census conclusion yet.",
  className: "border-[#D4D0C8] bg-[#F7F7F4] text-[#6B6B60]",
}

export function getOwnershipTierMeta(tier: string | null | undefined): OwnershipTierMeta {
  if (!tier) return NOT_REVIEWED_META
  return TIER_META[tier] ?? {
    label: tier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    shortLabel: tier.replace(/_/g, " "),
    description: "Ownership tier from the live census.",
    className: "border-[#D4D0C8] bg-[#F7F7F4] text-[#3D3D35]",
  }
}

export function getReviewStatus(tier: string | null | undefined): ReviewStatus {
  if (!tier) return "not_reviewed"
  if (tier === "undetermined") return "needs_evidence"
  return "verified"
}

export function formatNetworkName(networkId: string | null | undefined): string | null {
  if (!networkId) return null
  const prefix = /^ao:/i.test(networkId) ? "Owner: " : /^brand:/i.test(networkId) ? "Group: " : ""
  const cleaned = networkId
    .replace(/^brand:/i, "")
    .replace(/^ao:/i, "")
    .replace(/[-_:]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/\d/.test(w) || (w.length <= 3 && w === w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
  return `${prefix}${cleaned}`
}

export function CensusBadge({
  tier,
  peBacked,
  compact = false,
  className,
}: {
  tier: string | null | undefined
  peBacked?: boolean | null
  compact?: boolean
  className?: string
}) {
  const meta = getOwnershipTierMeta(tier)
  const label = compact ? meta.shortLabel : meta.label

  return (
    <span
      className={cn(BASE_BADGE, meta.className, className)}
      title={meta.description}
    >
      {label}
      {peBacked ? (
        <span className="ml-1.5 rounded-full bg-[#1A1A1A]/10 px-1.5 py-0.5 text-[10px]">
          PE
        </span>
      ) : null}
    </span>
  )
}

export function ReviewStatusBadge({
  tier,
  className,
}: {
  tier: string | null | undefined
  className?: string
}) {
  const status = getReviewStatus(tier)
  if (status === "verified") {
    return (
      <span className={cn(BASE_BADGE, "border-[#2D8B4E]/25 bg-[#ECFDF3] text-[#166534]", className)}>
        Verified
      </span>
    )
  }
  if (status === "needs_evidence") {
    return (
      <span className={cn(BASE_BADGE, "border-[#B8860B]/25 bg-[#FFFBEB] text-[#8B6508]", className)}>
        Needs Evidence
      </span>
    )
  }
  return (
    <span className={cn(BASE_BADGE, "border-[#D4D0C8] bg-[#F7F7F4] text-[#6B6B60]", className)}>
      Not Reviewed
    </span>
  )
}
