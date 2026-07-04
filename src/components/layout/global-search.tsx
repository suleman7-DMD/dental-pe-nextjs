"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CensusBadge } from "@/components/data-display/census-badge";

interface PracticeSearchResult {
  locationId: string;
  name: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  ownershipTier: string | null;
  peBacked: boolean | null;
  networkId: string | null;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Global practice search (⌘K): name / city / ZIP → /practice/[locationId].
 * Result rows show only census ownership badges — search is a truth surface
 * like every other, so unreviewed rows read as unreviewed, never as a guess.
 */
export function GlobalSearch({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PracticeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced fetch against the search API.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/practice-search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`search ${response.status}`);
        const payload = (await response.json()) as {
          results?: PracticeSearchResult[];
        };
        setResults(payload.results ?? []);
        setActiveIndex(0);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(true);
        setResults([]);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  // Reset palette state each time it closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setError(false);
      setLoading(false);
    }
  }, [open]);

  const navigateTo = useCallback(
    (result: PracticeSearchResult) => {
      setOpen(false);
      router.push(`/practice/${encodeURIComponent(result.locationId)}`);
    },
    [router]
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const active = results[activeIndex];
      if (active) navigateTo(active);
    }
  };

  // Keep the active row scrolled into view during keyboard navigation.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeRow = list.children[activeIndex] as HTMLElement | undefined;
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "group flex items-center gap-3 rounded-md text-[13px] font-medium transition-all duration-150",
        "py-[10px] px-4 w-full",
        "text-[#F5F5F0]/60 hover:text-[#F5F5F0]/80 hover:bg-[#363636]",
        collapsed && "justify-center px-0"
      )}
      aria-label="Search practices"
    >
      <Search className="h-[18px] w-[18px] shrink-0 text-[#F5F5F0]/60 group-hover:text-[#F5F5F0]/80 transition-colors duration-150" />
      {!collapsed && (
        <>
          <span>Search practices</span>
          <kbd className="ml-auto rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#F5F5F0]/50">
            ⌘K
          </kbd>
        </>
      )}
    </button>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger delay={0} render={trigger} />
          <TooltipContent side="right" sideOffset={8}>
            Search practices
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] translate-y-0 gap-0 overflow-hidden border-[#E8E5DE] bg-[#FFFFFF] p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search practices</DialogTitle>
          <div className="flex items-center gap-2.5 border-b border-[#E8E5DE] px-4 py-3">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#B8860B]" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-[#8F8E82]" />
            )}
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search by practice name, city, or ZIP…"
              className="w-full bg-transparent text-sm text-[#1A1A1A] outline-none placeholder:text-[#9C9C90]"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
            />
            <kbd className="shrink-0 rounded border border-[#E8E5DE] bg-[#FAFAF7] px-1.5 py-0.5 text-[10px] font-medium text-[#8F8E82]">
              esc
            </kbd>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {query.trim().length < MIN_QUERY_LENGTH ? (
              <p className="px-4 py-8 text-center text-sm text-[#9C9C90]">
                Type at least two characters — Chicagoland practices by name,
                city, or ZIP. Every result opens the full census record.
              </p>
            ) : error ? (
              <p className="px-4 py-8 text-center text-sm text-[#C23B3B]">
                Search failed — try again in a moment.
              </p>
            ) : results.length === 0 && !loading ? (
              <p className="px-4 py-8 text-center text-sm text-[#9C9C90]">
                No practices match &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul
                id="global-search-results"
                ref={listRef}
                role="listbox"
                className="divide-y divide-[#F0EEE8] py-1"
              >
                {results.map((result, index) => (
                  <li key={result.locationId} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onClick={() => navigateTo(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors",
                        index === activeIndex ? "bg-[#FAFAF7]" : "bg-transparent"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#1A1A1A]">
                          {result.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-[#6B6B60]">
                          <MapPin className="h-3 w-3 shrink-0 text-[#B8860B]" />
                          {[result.city, result.zip].filter(Boolean).join(" · ") ||
                            "Location not synced"}
                        </span>
                      </span>
                      <CensusBadge
                        tier={result.ownershipTier}
                        peBacked={result.peBacked}
                        compact
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
