"use client";

import { keepPreviousData, useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../supabase/client";
import { getSitrepBundle, type SitrepLoadOptions } from "../warroom/data";
import {
  DEFAULT_WARROOM_SCOPE,
  resolveScopeZipCodes,
  type WarroomScopeInput,
} from "../warroom/scope";
import { DEFAULT_WARROOM_LENS, type WarroomLens } from "../warroom/mode";
import type { WarroomIntentFilter, WarroomSitrepBundle } from "../warroom/signals";

const SITREP_BUNDLE_KEY = "warroom-sitrep";

export interface UseWarroomDataOptions {
  scope?: WarroomScopeInput;
  lens?: WarroomLens;
  rankLimit?: number;
  topSignalLimit?: number;
  requireFlags?: string[];
  excludeFlags?: string[];
  excludeCorporate?: boolean;
  confidence?: "all" | "high" | "medium" | "low";
  intentFilter?: WarroomIntentFilter | null;
  initialData?: WarroomSitrepBundle;
  /**
   * Scope used to compute `initialData` on the server. Defaults to
   * DEFAULT_WARROOM_SCOPE. When the client's active scope matches this, the
   * server payload is reused; otherwise the client refetches. Pass this
   * explicitly when the server fetches with a URL-driven scope.
   */
  initialDataScope?: WarroomScopeInput;
  /** Lens used to compute `initialData` on the server. Defaults to DEFAULT_WARROOM_LENS. */
  initialDataLens?: WarroomLens;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

type UseWarroomDataResult = UseQueryResult<WarroomSitrepBundle, Error> & {
  bundle: WarroomSitrepBundle | undefined;
};

function serializeScope(scope: WarroomScopeInput | undefined): string {
  const zipCodes = resolveScopeZipCodes(scope ?? DEFAULT_WARROOM_SCOPE);
  if (!zipCodes) return "us";
  if (zipCodes.length === 0) return "empty";
  return [...zipCodes].sort().join(",");
}

function sorted(values: string[]): string[] {
  return [...values].sort();
}

function serializeIntentFilter(filter: WarroomIntentFilter | null | undefined): string {
  if (!filter) return "";
  return JSON.stringify({
    ...filter,
    zipCodes: sorted(filter.zipCodes),
    subzones: sorted(filter.subzones),
    ownershipGroups: sorted(filter.ownershipGroups),
    entityClassifications: sorted(filter.entityClassifications),
    requireFlags: sorted(filter.requireFlags),
    excludeFlags: sorted(filter.excludeFlags),
    dsoNames: sorted(filter.dsoNames),
    peSponsorNames: sorted(filter.peSponsorNames),
  });
}

function buildQueryKey(options: UseWarroomDataOptions): readonly unknown[] {
  return [
    SITREP_BUNDLE_KEY,
    serializeScope(options.scope),
    options.lens ?? DEFAULT_WARROOM_LENS,
    options.rankLimit ?? 40,
    options.topSignalLimit ?? 8,
    options.requireFlags?.slice().sort().join("|") ?? "",
    options.excludeFlags?.slice().sort().join("|") ?? "",
    options.excludeCorporate ?? false,
    options.confidence ?? "all",
    serializeIntentFilter(options.intentFilter),
  ] as const;
}

export function useWarroomData(options: UseWarroomDataOptions = {}): UseWarroomDataResult {
  const loadOptions: SitrepLoadOptions = {
    lens: options.lens,
    rankLimit: options.rankLimit,
    topSignalLimit: options.topSignalLimit,
    requireFlags: options.requireFlags,
    excludeFlags: options.excludeFlags,
    excludeCorporate: options.excludeCorporate,
    confidence: options.confidence,
    intentFilter: options.intentFilter,
    loadSignals: true,
  };

  const queryOptions: UseQueryOptions<WarroomSitrepBundle, Error, WarroomSitrepBundle> = {
    queryKey: buildQueryKey(options),
    queryFn: () =>
      getSitrepBundle(
        options.scope ?? DEFAULT_WARROOM_SCOPE,
        loadOptions,
        getSupabaseBrowserClient()
      ),
    staleTime: options.staleTime ?? 5 * 60 * 1000,
    gcTime: options.gcTime ?? 30 * 60 * 1000,
    enabled: options.enabled ?? true,
    retry: 1,
    placeholderData: keepPreviousData,
  };

  if (options.initialData) {
    const initialKey = buildQueryKey({
      scope: options.initialDataScope ?? DEFAULT_WARROOM_SCOPE,
      lens: options.initialDataLens ?? DEFAULT_WARROOM_LENS,
      rankLimit: 40,
      topSignalLimit: 8,
      excludeCorporate: false,
      confidence: "all",
    });
    const activeKey = buildQueryKey(options);
    if (JSON.stringify(initialKey) === JSON.stringify(activeKey)) {
      queryOptions.initialData = options.initialData;
    }
  }

  const query = useQuery<WarroomSitrepBundle, Error>(queryOptions);

  return Object.assign(query, { bundle: query.data });
}

export function warroomBundleQueryKey(options: UseWarroomDataOptions = {}): readonly unknown[] {
  return buildQueryKey(options);
}
