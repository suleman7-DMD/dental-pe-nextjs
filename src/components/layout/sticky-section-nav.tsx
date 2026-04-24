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
    <nav className="sticky top-0 z-20 h-10 bg-[#FFFFFF] border-b border-[#E8E5DE] px-6 flex items-center">
      <div className="flex gap-6 overflow-x-auto scrollbar-thin">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => handleClick(section.id)}
            className={cn(
              "relative whitespace-nowrap pb-[9px] pt-[11px] text-sm font-medium transition-colors duration-200",
              activeId === section.id
                ? "text-[#B8860B]"
                : "text-[#707064] hover:text-[#6B6B60]"
            )}
          >
            {section.label}
            {/* Active underline indicator */}
            <span
              className={cn(
                "absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-all duration-200",
                activeId === section.id
                  ? "bg-[#B8860B] opacity-100"
                  : "bg-transparent opacity-0"
              )}
            />
          </button>
        ))}
      </div>
    </nav>
  );
}
