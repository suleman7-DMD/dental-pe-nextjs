import Link from "next/link"
import { ArrowRight, Crosshair } from "lucide-react"
import { cn } from "@/lib/utils"

interface WarroomCrossLinkProps {
  /** Short hint describing what the Warroom offers for this legacy surface. */
  context?: string
  /** Optional querystring appended to /warroom (e.g. "?scope=chicagoland&mode=investigate"). */
  hrefSuffix?: string
  className?: string
}

export function WarroomCrossLink({
  context = "Unified scope, ranked targets, and Living Map lenses in one place.",
  hrefSuffix = "",
  className,
}: WarroomCrossLinkProps) {
  return (
    <Link
      href={`/warroom${hrefSuffix}`}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-lg border border-[#B8860B]/30 bg-gradient-to-r from-[#B8860B]/[0.08] to-[#B8860B]/[0.04] px-4 py-3 transition-colors hover:border-[#B8860B]/60 hover:from-[#B8860B]/[0.12] hover:to-[#B8860B]/[0.06]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#B8860B]/15 text-[#B8860B]">
          <Crosshair className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#1A1A1A]">
            Open the Chicagoland Warroom
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6B60]">{context}</p>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-[#B8860B] transition-transform group-hover:translate-x-0.5">
        Launch
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
