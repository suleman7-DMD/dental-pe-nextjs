"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  tooltip?: string;
  /** Alias for tooltip — some page agents use helpText instead. */
  helpText?: string;
  id?: string;
}

export function SectionHeader({ title, description, tooltip, helpText, id }: SectionHeaderProps) {
  const tooltipText = tooltip ?? helpText;
  return (
    <div
      id={id}
      className="mt-6 pb-2 border-b border-[var(--border)] scroll-mt-20"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
          {title}
        </h3>
        {tooltipText && (
          <Tooltip>
            <TooltipTrigger
              delay={200}
              render={
                <span className="cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </span>
              }
            />
            <TooltipContent
              side="right"
              className="max-w-[260px] bg-[var(--bg-card-hover)] border-[var(--border-hover)] text-[var(--text-primary)] text-xs"
            >
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      )}
    </div>
  );
}
