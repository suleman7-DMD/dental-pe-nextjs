import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export formatting helpers that some page agents import from "@/lib/utils"
export { formatDate, formatNumber } from "./utils/formatting";

/** Format a number as a percentage string (e.g. "42.1%"). */
export function formatPct(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(decimals)}%`;
}
