"use client"

import { useMemo } from "react"
import {
  Building2,
  Flame,
  MapPin,
  Phone,
  StickyNote,
  ThermometerSnowflake,
  ThermometerSun,
  Users,
  X,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber } from "@/lib/utils/formatting"
import { getEntityClassificationLabel } from "@/lib/constants/entity-classifications"
import type { RankedTarget } from "@/lib/warroom/signals"
import type { PinNoteMap } from "@/lib/hooks/use-warroom-pin-notes"

interface PinCompareDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pins: string[]
  pinTargets?: Map<string, RankedTarget>
  pinNotes: PinNoteMap
  onSelectEntity: (npi: string) => void
  onRemovePin: (npi: string) => void
}

const TIER_META: Record<
  RankedTarget["tier"],
  { label: string; color: string; icon: typeof Flame }
> = {
  hot: { label: "Hot", color: "#C23B3B", icon: Flame },
  warm: { label: "Warm", color: "#D4920B", icon: ThermometerSun },
  cool: { label: "Cool", color: "#2563EB", icon: ThermometerSnowflake },
  cold: { label: "Cold", color: "#6B6B60", icon: ThermometerSnowflake },
}

const OWNERSHIP_META: Record<
  RankedTarget["ownershipGroup"],
  { label: string; color: string; bg: string }
> = {
  independent: { label: "Independent", color: "#2563EB", bg: "#2563EB15" },
  corporate: { label: "Corporate", color: "#C23B3B", bg: "#C23B3B15" },
  specialist: { label: "Specialist", color: "#0D9488", bg: "#0D948815" },
  non_clinical: { label: "Non-clinical", color: "#7C3AED", bg: "#7C3AED15" },
  unknown: { label: "Unknown", color: "#6B6B60", bg: "#6B6B6015" },
}

const COLUMN_MIN_WIDTH = 280

interface CompareRowProps {
  label: string
  values: Array<{ npi: string; node: React.ReactNode }>
  emphasis?: boolean
}

function CompareRow({ label, values, emphasis }: CompareRowProps) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] divide-x divide-[#E8E5DE] border-b border-[#E8E5DE] last:border-b-0">
      <div className="sticky left-0 z-10 flex w-[160px] items-start bg-[#FAFAF7] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
          {label}
        </span>
      </div>
      {values.map(({ npi, node }) => (
        <div
          key={npi}
          className={cn(
            "px-3 py-2 text-[12px] leading-snug text-[#1A1A1A]",
            emphasis && "font-semibold"
          )}
        >
          {node}
        </div>
      ))}
    </div>
  )
}

function flagLabel(flag: string): string {
  return flag.replace(/_flag$/i, "").replace(/_/g, " ")
}

export function PinCompareDrawer({
  open,
  onOpenChange,
  pins,
  pinTargets,
  pinNotes,
  onSelectEntity,
  onRemovePin,
}: PinCompareDrawerProps) {
  const hydratedPins = useMemo(() => {
    if (!pinTargets) return [] as Array<{ npi: string; target: RankedTarget }>
    const out: Array<{ npi: string; target: RankedTarget }> = []
    for (const npi of pins) {
      const target = pinTargets.get(npi)
      if (target) out.push({ npi, target })
    }
    return out
  }, [pins, pinTargets])

  const missingCount = pins.length - hydratedPins.length
  const totalWidth = Math.max(720, hydratedPins.length * COLUMN_MIN_WIDTH + 160)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!max-w-none w-full sm:!max-w-[min(96vw,1600px)] flex flex-col gap-0 overflow-hidden bg-[#FAFAF7] p-0"
      >
        <SheetHeader className="border-b border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-[#1A1A1A]">
                Compare pinned targets
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[12px] text-[#6B6B60]">
                {hydratedPins.length} of {pins.length} pins hydrated
                {missingCount > 0 && (
                  <span className="ml-1 text-[#D4920B]">
                    · {missingCount} not in current scope
                  </span>
                )}
                {hydratedPins.length >= 2 &&
                  ` · ${hydratedPins.length}-way comparison`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {hydratedPins.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FFFFFF] px-6 py-10 text-center text-sm text-[#6B6B60]">
              <p className="font-medium text-[#1A1A1A]">
                None of your pins are loaded
              </p>
              <p className="mt-1 text-[12px]">
                Switch to a scope that contains these practices, then reopen the
                compare drawer.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div style={{ minWidth: totalWidth }}>
              {/* Sticky header row with practice name + tier + close-pin button */}
              <div className="sticky top-0 z-20 grid grid-flow-col auto-cols-[minmax(280px,1fr)] divide-x divide-[#E8E5DE] border-b border-[#E8E5DE] bg-[#FFFFFF]">
                <div className="sticky left-0 z-10 w-[160px] bg-[#FAFAF7] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#707064]">
                    Practice
                  </p>
                </div>
                {hydratedPins.map(({ npi, target }) => {
                  const tier = TIER_META[target.tier]
                  const TierIcon = tier.icon
                  return (
                    <div key={npi} className="bg-[#FFFFFF] px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectEntity(npi)
                            onOpenChange(false)
                          }}
                          className="min-w-0 flex-1 text-left transition-colors hover:text-[#B8860B]"
                          title="Open dossier"
                        >
                          <p className="truncate text-[13px] font-semibold text-[#1A1A1A]">
                            {target.practiceName}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-[#6B6B60]">
                            <MapPin className="mr-1 inline h-3 w-3" />
                            {[target.city, target.zip].filter(Boolean).join(" · ") ||
                              "Location unknown"}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemovePin(npi)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#707064] transition-colors hover:bg-[#FAFAF7] hover:text-[#C23B3B]"
                          aria-label={`Unpin ${target.practiceName}`}
                          title="Unpin"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${tier.color}15`,
                            color: tier.color,
                          }}
                        >
                          <TierIcon className="h-3 w-3" />
                          {tier.label}
                        </span>
                        <span className="font-mono text-[18px] font-bold text-[#1A1A1A]">
                          {target.score}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <CompareRow
                label="Headline"
                values={hydratedPins.map(({ npi, target }) => ({
                  npi,
                  node: (
                    <span className="text-[12px] italic text-[#6B6B60]">
                      {target.headline || "—"}
                    </span>
                  ),
                }))}
              />

              <CompareRow
                label="Top score drivers"
                values={hydratedPins.map(({ npi, target }) => {
                  const top = [...target.components]
                    .filter((c) => Math.abs(c.contribution) > 0)
                    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                    .slice(0, 3)
                  return {
                    npi,
                    node:
                      top.length === 0 ? (
                        <span className="text-[#9C9C90]">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {top.map((c, idx) => (
                            <li
                              key={`${c.label}-${idx}`}
                              className="flex items-baseline justify-between gap-2 text-[11px]"
                            >
                              <span className="truncate text-[#1A1A1A]">
                                {c.label}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 font-mono font-semibold",
                                  c.contribution >= 0
                                    ? "text-[#2D8B4E]"
                                    : "text-[#C23B3B]"
                                )}
                              >
                                {c.contribution >= 0 ? "+" : ""}
                                {c.contribution.toFixed(0)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ),
                  }
                })}
              />

              <CompareRow
                label="Active flags"
                values={hydratedPins.map(({ npi, target }) => ({
                  npi,
                  node:
                    target.flags.length === 0 ? (
                      <span className="text-[#9C9C90]">No flags</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {target.flags.slice(0, 5).map((f) => (
                          <span
                            key={f}
                            className="rounded-full bg-[#B8860B]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#B8860B]"
                          >
                            {flagLabel(f)}
                          </span>
                        ))}
                        {target.flags.length > 5 && (
                          <span className="text-[10px] text-[#707064]">
                            +{target.flags.length - 5}
                          </span>
                        )}
                      </div>
                    ),
                }))}
              />

              <CompareRow
                label="Ownership"
                values={hydratedPins.map(({ npi, target }) => {
                  const meta = OWNERSHIP_META[target.ownershipGroup]
                  return {
                    npi,
                    node: (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ backgroundColor: meta.bg, color: meta.color }}
                        >
                          <Building2 className="h-3 w-3" />
                          {meta.label}
                        </span>
                        {target.entityClassification && (
                          <span className="text-[11px] text-[#6B6B60]">
                            {getEntityClassificationLabel(
                              target.entityClassification
                            )}
                          </span>
                        )}
                      </div>
                    ),
                  }
                })}
              />

              <CompareRow
                label="Buyability"
                values={hydratedPins.map(({ npi, target }) => ({
                  npi,
                  node:
                    target.buyabilityScore == null ? (
                      <span className="text-[#9C9C90]">—</span>
                    ) : (
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          target.buyabilityScore >= 70
                            ? "text-[#2D8B4E]"
                            : target.buyabilityScore >= 50
                              ? "text-[#D4920B]"
                              : "text-[#6B6B60]"
                        )}
                      >
                        {target.buyabilityScore}
                      </span>
                    ),
                }))}
              />

              <CompareRow
                label="Year established"
                values={hydratedPins.map(({ npi, target }) => {
                  const year = target.yearEstablished
                  const age = year ? new Date().getFullYear() - year : null
                  return {
                    npi,
                    node:
                      year == null ? (
                        <span className="text-[#9C9C90]">—</span>
                      ) : (
                        <span>
                          <span className="font-mono font-semibold">{year}</span>
                          {age != null && (
                            <span className="ml-1 text-[11px] text-[#6B6B60]">
                              ({age}y)
                            </span>
                          )}
                        </span>
                      ),
                  }
                })}
              />

              <CompareRow
                label="Providers"
                values={hydratedPins.map(({ npi, target }) => ({
                  npi,
                  node:
                    target.numProviders == null ? (
                      <span className="text-[#9C9C90]">—</span>
                    ) : (
                      <span className="font-mono">
                        <Users className="mr-1 inline h-3 w-3 text-[#6B6B60]" />
                        {target.numProviders}
                      </span>
                    ),
                }))}
              />

              <CompareRow
                label="Employees"
                values={hydratedPins.map(({ npi, target }) => ({
                  npi,
                  node:
                    target.employeeCount == null ? (
                      <span className="text-[#9C9C90]">—</span>
                    ) : (
                      <span className="font-mono">
                        {formatNumber(target.employeeCount)}
                      </span>
                    ),
                }))}
              />

              <CompareRow
                label="Estimated revenue"
                values={hydratedPins.map(({ npi, target }) => ({
                  npi,
                  node:
                    target.estimatedRevenue == null ? (
                      <span className="text-[#9C9C90]">—</span>
                    ) : (
                      <span className="font-mono">
                        {formatCurrency(target.estimatedRevenue)}
                      </span>
                    ),
                }))}
              />

              <CompareRow
                label="Phone"
                values={hydratedPins.map(({ npi, target }) => {
                  const phone = target.candidate.practice.phone
                  return {
                    npi,
                    node:
                      phone == null ? (
                        <span className="text-[#9C9C90]">—</span>
                      ) : (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex items-center gap-1 font-mono text-[12px] text-[#2563EB] hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {phone}
                        </a>
                      ),
                  }
                })}
              />

              <CompareRow
                label="Website"
                values={hydratedPins.map(({ npi, target }) => {
                  const website = target.candidate.practice.website
                  return {
                    npi,
                    node:
                      website == null ? (
                        <span className="text-[#9C9C90]">—</span>
                      ) : (
                        <a
                          href={
                            website.startsWith("http")
                              ? website
                              : `https://${website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-[12px] text-[#2563EB] hover:underline"
                        >
                          {website.replace(/^https?:\/\//, "").slice(0, 32)}
                        </a>
                      ),
                  }
                })}
              />

              <CompareRow
                label="Notes"
                values={hydratedPins.map(({ npi }) => {
                  const note = pinNotes[npi]
                  return {
                    npi,
                    node:
                      !note || note.trim().length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] italic text-[#9C9C90]">
                          <StickyNote className="h-3 w-3" />
                          No note
                        </span>
                      ) : (
                        <p className="whitespace-pre-wrap text-[11px] text-[#1A1A1A]">
                          {note}
                        </p>
                      ),
                  }
                })}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#E8E5DE] bg-[#FFFFFF] px-4 py-3">
          <p className="text-[11px] text-[#707064]">
            Click a practice name to open its full dossier · Notes are saved per
            device
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-[#E8E5DE]"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
