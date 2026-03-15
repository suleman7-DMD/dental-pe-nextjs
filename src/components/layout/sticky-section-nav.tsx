"use client";

import { cn } from "@/lib/utils";
import { useSectionObserver } from "@/lib/hooks/use-section-observer";

interface StickySectionNavProps {
  sections: { id: string; label: string }[];
}

export function StickySectionNav({ sections }: StickySectionNavProps) {
  const sectionIds = sections.map((s) => s.id);
  const activeId = useSectionObserver(sectionIds);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border)] py-2 px-1">
      <div className="flex gap-1 overflow-x-auto scrollbar-thin">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => handleClick(section.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
              activeId === section.id
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            )}
          >
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );
}
