"use client";

import { cn } from "@/lib/utils";
import { useSectionObserver } from "@/lib/hooks/use-section-observer";

interface StickySectionNavProps {
  sections: Array<{ id: string; label: string }>;
}

export function StickySectionNav({ sections }: StickySectionNavProps) {
  const sectionIds = sections.map((s) => s.id);
  const activeId = useSectionObserver(sectionIds);

  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-0 z-20 h-10 bg-[#0A0F1E] border-b border-[#1E293B] px-6 flex items-center">
      <div className="flex gap-6 overflow-x-auto scrollbar-thin">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => handleClick(section.id)}
            className={cn(
              "relative whitespace-nowrap pb-[9px] pt-[11px] text-xs font-medium transition-colors duration-200",
              activeId === section.id
                ? "text-[#F8FAFC]"
                : "text-[#64748B] hover:text-[#94A3B8]"
            )}
          >
            {section.label}
            {/* Active underline indicator */}
            <span
              className={cn(
                "absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-all duration-200",
                activeId === section.id
                  ? "bg-[#3B82F6] opacity-100"
                  : "bg-transparent opacity-0"
              )}
            />
          </button>
        ))}
      </div>
    </nav>
  );
}
