"use client";

import { useMemo, useState } from "react";
import { BarChart3, Search } from "lucide-react";
import { DataBreakdownChart } from "@/components/charts/data-breakdown-chart";
import type { DataBreakdownBundle } from "@/lib/supabase/queries/data-breakdown";
import { formatNumber } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";

interface DataBreakdownShellProps {
  bundle: DataBreakdownBundle | null;
  error: string | null;
}

const CATEGORY_ORDER: Array<{ id: string; label: string; matcher: (title: string) => boolean }> = [
  {
    id: "practices",
    label: "Practices",
    matcher: (t) => t.toLowerCase().includes("practice") || t.toLowerCase().includes("location"),
  },
  {
    id: "deals",
    label: "Deals",
    matcher: (t) => t.toLowerCase().includes("deals"),
  },
  {
    id: "zips",
    label: "ZIPs",
    matcher: (t) => t.toLowerCase().includes("zip"),
  },
  {
    id: "intel",
    label: "Intelligence",
    matcher: (t) => t.toLowerCase().includes("intel") || t.toLowerCase().includes("dossier"),
  },
];

export function DataBreakdownShell({ bundle, error }: DataBreakdownShellProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandAll, setExpandAll] = useState(false);

  const filteredBlocks = useMemo(() => {
    if (!bundle) return [];
    let result = bundle.blocks;
    if (activeCategory !== "all") {
      const cat = CATEGORY_ORDER.find((c) => c.id === activeCategory);
      if (cat) result = result.filter((b) => cat.matcher(b.title));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.source.toLowerCase().includes(q) ||
          b.groupBy.toLowerCase().includes(q) ||
          b.segments.some((s) => s.label.toLowerCase().includes(q))
      );
    }
    return result;
  }, [bundle, activeCategory, search]);

  const driftCount = useMemo(() => {
    if (!bundle) return 0;
    return bundle.blocks.filter((b) => b.reconciliation && b.reconciliation.drift !== 0).length;
  }, [bundle]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1
          className="text-[24px] font-bold text-[#1A1A1A]"
          style={{ fontFamily: "var(--font-heading), DM Sans, sans-serif" }}
        >
          Data Breakdown
        </h1>
        <div className="mt-6 rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-3 text-[13px] text-[#C23B3B]">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-[24px] font-bold text-[#1A1A1A]">Data Breakdown</h1>
        <p className="mt-3 text-[13px] text-[#6B6B60]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-[#B8860B]" />
            <h1
              className="text-[24px] font-bold text-[#1A1A1A]"
              style={{ fontFamily: "var(--font-heading), DM Sans, sans-serif" }}
            >
              Data Breakdown
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-[13px] text-[#6B6B60]">
            Every headline number on the dashboard, broken down to its source. Hover any
            segment for the exact count + share. Expand a block for the source query and
            full reconciliation table.
          </p>
        </div>

        {/* Stats summary */}
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
              Blocks
            </div>
            <div
              className="text-[20px] font-bold text-[#1A1A1A]"
              style={{ fontFamily: "var(--font-mono), JetBrains Mono, monospace" }}
            >
              {bundle.blocks.length}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
              Watched ZIPs
            </div>
            <div
              className="text-[20px] font-bold text-[#1A1A1A]"
              style={{ fontFamily: "var(--font-mono), JetBrains Mono, monospace" }}
            >
              {formatNumber(bundle.watchedZipCount)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#9C9C90]">
              Drift Alerts
            </div>
            <div
              className={cn(
                "text-[20px] font-bold",
                driftCount === 0 ? "text-[#2D8B4E]" : "text-[#D4920B]"
              )}
              style={{ fontFamily: "var(--font-mono), JetBrains Mono, monospace" }}
            >
              {driftCount}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-[#E8E5DE] bg-white px-3 py-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9C9C90]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, source, segment label…"
            className="w-full rounded-md border border-[#E8E5DE] bg-[#F5F5F0] py-1.5 pl-8 pr-3 text-[12px] text-[#1A1A1A] placeholder:text-[#9C9C90] focus:border-[#B8860B] focus:outline-none focus:ring-1 focus:ring-[#B8860B]/30"
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 rounded-md border border-[#E8E5DE] bg-[#F5F5F0] p-0.5">
          <CategoryButton
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            All
          </CategoryButton>
          {CATEGORY_ORDER.map((cat) => (
            <CategoryButton
              key={cat.id}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </CategoryButton>
          ))}
        </div>

        {/* Expand all */}
        <button
          onClick={() => setExpandAll((v) => !v)}
          className="rounded-md border border-[#E8E5DE] bg-white px-3 py-1.5 text-[11px] font-medium text-[#6B6B60] transition-colors hover:border-[#B8860B] hover:text-[#1A1A1A]"
        >
          {expandAll ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Blocks */}
      <div className="mt-4 space-y-3">
        {filteredBlocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E8E5DE] bg-white px-4 py-8 text-center text-[12px] text-[#9C9C90]">
            No blocks match your filters.
          </div>
        ) : (
          filteredBlocks.map((block, i) => (
            <DataBreakdownChart
              key={`${block.title}-${i}`}
              block={block}
              defaultExpanded={expandAll}
            />
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="mt-8 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] px-4 py-3 text-[11px] text-[#6B6B60]">
        <strong className="text-[#1A1A1A]">Why this page exists:</strong>{" "}
        NPPES emits one row per provider AND one row per organization at the same
        physical address — counting NPI rows as &ldquo;practices&rdquo; inflates
        watched-ZIP totals by ~2.7×. This page surfaces both the NPI-row count and
        the location-deduped count for every metric, plus the source query, so you
        can verify each number end-to-end.
      </div>

      {/* Fetched at */}
      <div className="mt-3 text-right text-[10px] text-[#9C9C90]">
        Fetched at {new Date(bundle.fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-white text-[#1A1A1A] shadow-sm"
          : "text-[#6B6B60] hover:text-[#1A1A1A]"
      )}
    >
      {children}
    </button>
  );
}
