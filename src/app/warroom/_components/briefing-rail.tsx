"use client"

import {
  AlertTriangle,
  ArrowUpRight,
  Flag,
  Info,
  ShieldAlert,
  Zap,
} from "lucide-react"
import type { ComponentType } from "react"
import { cn } from "@/lib/utils"
import type {
  WarroomBriefingItem,
  WarroomBriefingSeverity,
} from "@/lib/warroom/signals"
import type { WarroomLens } from "@/lib/warroom/mode"
import { getWarroomLensLabel } from "@/lib/warroom/mode"

interface BriefingRailProps {
  items: WarroomBriefingItem[]
  onIntentRequest?: (intentText: string) => void
  onLensChange?: (lens: WarroomLens) => void
  emptyHint?: string
  className?: string
}

const SEVERITY_STYLES: Record<
  WarroomBriefingSeverity,
  {
    badge: string
    border: string
    iconColor: string
    icon: ComponentType<{ className?: string }>
    label: string
  }
> = {
  critical: {
    badge: "bg-[#C23B3B]/10 text-[#C23B3B] border-[#C23B3B]/30",
    border: "border-l-[3px] border-l-[#C23B3B]",
    iconColor: "text-[#C23B3B]",
    icon: ShieldAlert,
    label: "Critical",
  },
  high: {
    badge: "bg-[#D4920B]/15 text-[#B0780A] border-[#D4920B]/30",
    border: "border-l-[3px] border-l-[#D4920B]",
    iconColor: "text-[#D4920B]",
    icon: AlertTriangle,
    label: "High",
  },
  medium: {
    badge: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30",
    border: "border-l-[3px] border-l-[#2563EB]",
    iconColor: "text-[#2563EB]",
    icon: Flag,
    label: "Medium",
  },
  info: {
    badge: "bg-[#E8E5DE] text-[#6B6B60] border-[#D4D0C8]",
    border: "border-l-[3px] border-l-[#9C9C90]",
    iconColor: "text-[#6B6B60]",
    icon: Info,
    label: "Info",
  },
}

export function BriefingRail({
  items,
  onIntentRequest,
  onLensChange,
  emptyHint,
  className,
}: BriefingRailProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]",
        className
      )}
      aria-label="Market briefing"
    >
      <header className="flex items-center justify-between border-b border-[#E8E5DE] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Market Briefing</h2>
          <p className="text-xs text-[#707064]">
            {items.length} auto-synthesized insights
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-1 text-[11px] font-medium text-[#B8860B]">
          <Zap className="h-3 w-3" />
          Live
        </span>
      </header>

      <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#D4D0C8] bg-[#FAFAF7] px-4 py-8 text-center">
            <p className="text-sm text-[#6B6B60]">
              {emptyHint ?? "No briefing items yet for this scope."}
            </p>
          </div>
        ) : (
          items.map((item) => {
            const styles = SEVERITY_STYLES[item.severity]
            const IconComponent = styles.icon
            const actionable = Boolean(
              item.action || (item.lens && onLensChange)
            )
            return (
              <article
                key={item.id}
                className={cn(
                  "group rounded-md border border-[#E8E5DE] bg-[#FFFFFF] p-3 transition-colors hover:bg-[#FAFAF7]",
                  styles.border
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <IconComponent className={cn("h-4 w-4", styles.iconColor)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          styles.badge
                        )}
                      >
                        {styles.label}
                      </span>
                      {item.lens && (
                        <button
                          type="button"
                          disabled={!onLensChange}
                          onClick={() =>
                            item.lens && onLensChange?.(item.lens as WarroomLens)
                          }
                          className={cn(
                            "inline-flex items-center rounded-full border border-[#E8E5DE] bg-[#F7F7F4] px-1.5 py-0.5 text-[10px] font-medium text-[#6B6B60]",
                            onLensChange && "hover:border-[#B8860B]/40 hover:text-[#B8860B]"
                          )}
                        >
                          Lens: {getWarroomLensLabel(item.lens as WarroomLens)}
                        </button>
                      )}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-[#1A1A1A]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#6B6B60]">{item.detail}</p>

                    {item.metric && (
                      <div className="mt-2 inline-flex items-baseline gap-1 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-2 py-1">
                        <span className="font-mono text-sm font-semibold text-[#1A1A1A]">
                          {item.metric.value}
                        </span>
                        {item.metric.unit && (
                          <span className="text-[10px] uppercase tracking-wider text-[#707064]">
                            {item.metric.unit}
                          </span>
                        )}
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-[#707064]">
                          {item.metric.label}
                        </span>
                      </div>
                    )}

                    {actionable && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.action?.intentHint && onIntentRequest && (
                          <button
                            type="button"
                            onClick={() =>
                              item.action?.intentHint &&
                              onIntentRequest(item.action.intentHint)
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/5 px-2 py-1 text-[11px] font-medium text-[#B8860B] transition-colors hover:bg-[#B8860B]/15"
                          >
                            {item.action.label}
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                        {item.action?.href && !item.action.intentHint && (
                          <a
                            href={item.action.href}
                            className="inline-flex items-center gap-1 rounded-md border border-[#B8860B]/30 bg-[#B8860B]/5 px-2 py-1 text-[11px] font-medium text-[#B8860B] transition-colors hover:bg-[#B8860B]/15"
                          >
                            {item.action.label}
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
