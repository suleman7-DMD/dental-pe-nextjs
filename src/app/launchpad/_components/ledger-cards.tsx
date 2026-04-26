"use client"

import {
  Building2,
  Activity,
  DollarSign,
  MapPin,
  Flag,
  CheckCheck,
  Clock,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { LedgerAtom, LedgerCategory } from "@/lib/launchpad/ai-types"

interface LedgerCardsProps {
  atoms: LedgerAtom[]
}

interface CategoryMeta {
  id: LedgerCategory
  label: string
  icon: LucideIcon
  accent: string
  bgTint: string
  borderTint: string
}

const CATEGORY_ORDER: CategoryMeta[] = [
  {
    id: "structural",
    label: "Structural",
    icon: Building2,
    accent: "#6366F1",
    bgTint: "#6366F108",
    borderTint: "#6366F126",
  },
  {
    id: "operational",
    label: "Operational",
    icon: Activity,
    accent: "#0D9488",
    bgTint: "#0D948808",
    borderTint: "#0D948826",
  },
  {
    id: "financial",
    label: "Financial",
    icon: DollarSign,
    accent: "#2D8B4E",
    bgTint: "#2D8B4E08",
    borderTint: "#2D8B4E26",
  },
  {
    id: "market",
    label: "Market",
    icon: MapPin,
    accent: "#2563EB",
    bgTint: "#2563EB08",
    borderTint: "#2563EB26",
  },
  {
    id: "signal",
    label: "Signal",
    icon: Flag,
    accent: "#B8860B",
    bgTint: "#B8860B08",
    borderTint: "#B8860B26",
  },
]

function ConfidenceDot({ confidence }: { confidence: LedgerAtom["confidence"] }) {
  const color =
    confidence === "high" ? "#2D8B4E" : confidence === "medium" ? "#D4920B" : "#9C9C90"
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      title={`Confidence: ${confidence}`}
      aria-label={`Confidence ${confidence}`}
    />
  )
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-[#E8E5DE] bg-[#FFFFFF] px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[#6B6B60]">
      {label}
    </span>
  )
}

function TriangulatedBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded border border-[#2D8B4E]/30 bg-[#2D8B4E]/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#2D8B4E]"
      title="Two or more sources independently report this value"
    >
      <CheckCheck className="h-2.5 w-2.5" aria-hidden="true" />
      Corroborated
    </span>
  )
}

function StaleBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded border border-[#D4920B]/30 bg-[#D4920B]/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#D4920B]"
      title="Source intel is older than 180 days — confidence downgraded"
    >
      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
      Stale
    </span>
  )
}

export function LedgerCards({ atoms }: LedgerCardsProps) {
  if (!atoms || atoms.length === 0) return null

  const grouped = new Map<LedgerCategory, LedgerAtom[]>()
  for (const atom of atoms) {
    const arr = grouped.get(atom.category) ?? []
    arr.push(atom)
    grouped.set(atom.category, arr)
  }

  const visibleCategories = CATEGORY_ORDER.filter((c) => (grouped.get(c.id) ?? []).length > 0)

  if (visibleCategories.length === 0) return null

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6B60]">
          Evidence ledger
        </p>
        <p className="text-[10px] text-[#9C9C90]">
          {atoms.length} {atoms.length === 1 ? "atom" : "atoms"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((cat) => {
          const items = grouped.get(cat.id) ?? []
          const Icon = cat.icon
          return (
            <div
              key={cat.id}
              className="rounded-md border bg-white p-2"
              style={{ borderColor: cat.borderTint, backgroundColor: cat.bgTint }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: cat.accent }}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {cat.label}
                </span>
                <span className="text-[10px] text-[#9C9C90]">{items.length}</span>
              </div>
              <ul className="space-y-1.5">
                {items.map((atom, idx) => (
                  <li key={`${cat.id}-${idx}`} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <ConfidenceDot confidence={atom.confidence} />
                      <span className="truncate text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
                        {atom.label}
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-[#1A1A1A]">{atom.value}</p>
                    {atom.snippet && (
                      <p className="border-l-2 border-[#E8E5DE] pl-1.5 text-[10px] italic leading-snug text-[#6B6B60]">
                        &ldquo;{atom.snippet}&rdquo;
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <SourceBadge label={atom.source_label} />
                      {atom.triangulated && <TriangulatedBadge />}
                      {atom.stale && <StaleBadge />}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
