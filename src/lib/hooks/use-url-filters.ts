"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * Syncs filter state with URL search params for shareable URLs.
 * Provides get/set helpers that read from and write to the URL.
 */
export function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  /** Get a single filter value from URL params. */
  const getFilter = useCallback(
    (key: string, defaultValue = ""): string => {
      return searchParams.get(key) ?? defaultValue;
    },
    [searchParams]
  );

  /** Get a filter value as an array (comma-separated in URL). */
  const getArrayFilter = useCallback(
    (key: string): string[] => {
      const raw = searchParams.get(key);
      if (!raw) return [];
      return raw.split(",").map(s => s.trim()).filter(Boolean);
    },
    [searchParams]
  );

  /** Get a filter value as a number. */
  const getNumberFilter = useCallback(
    (key: string, defaultValue?: number): number | undefined => {
      const raw = searchParams.get(key);
      if (raw === null) return defaultValue;
      const num = Number(raw);
      return isNaN(num) ? defaultValue : num;
    },
    [searchParams]
  );

  /** Set one or more filter values in the URL. Pass null to remove a key. */
  const setFilters = useCallback(
    (updates: Record<string, string | string[] | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            params.delete(key);
          } else {
            params.set(key, value.join(","));
          }
        } else {
          params.set(key, String(value));
        }
      });

      const newSearch = params.toString();
      const url = newSearch ? `${pathname}?${newSearch}` : pathname;
      router.push(url, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  /** Reset all filters (clear all params). */
  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  return {
    getFilter,
    getArrayFilter,
    getNumberFilter,
    setFilters,
    resetFilters,
    searchParams,
  };
}
