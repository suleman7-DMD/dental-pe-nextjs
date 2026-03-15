"use client";

import { cn } from "@/lib/utils";

interface ConfidenceStarsProps {
  level: "high" | "medium" | "low" | "confirmed" | "provisional" | "insufficient_data" | string | null;
  className?: string;
}

function getStarCount(level: string | null): number {
  switch (level?.toLowerCase()) {
    case "high":
    case "confirmed":
      return 3;
    case "medium":
    case "provisional":
      return 2;
    case "low":
    case "insufficient_data":
      return 1;
    default:
      return 0;
  }
}

function getLabel(level: string | null): string {
  switch (level?.toLowerCase()) {
    case "high":
    case "confirmed":
      return "High";
    case "medium":
    case "provisional":
      return "Medium";
    case "low":
    case "insufficient_data":
      return "Low";
    default:
      return "Unknown";
  }
}

function getColor(level: string | null): string {
  switch (level?.toLowerCase()) {
    case "high":
    case "confirmed":
      return "text-[var(--accent-green)]";
    case "medium":
    case "provisional":
      return "text-[var(--accent-amber)]";
    case "low":
    case "insufficient_data":
      return "text-[var(--accent-red)]";
    default:
      return "text-[var(--text-muted)]";
  }
}

export function ConfidenceStars({ level, className }: ConfidenceStarsProps) {
  const stars = getStarCount(level);
  const maxStars = 3;
  const label = getLabel(level);
  const color = getColor(level);

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", className)}
      title={`${label} confidence`}
    >
      <span className={color}>
        {"★".repeat(stars)}
        <span className="text-[var(--text-muted)] opacity-30">
          {"★".repeat(maxStars - stars)}
        </span>
      </span>
      <span className="text-[var(--text-muted)]">{label}</span>
    </span>
  );
}
