"use client";

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../supabase/client";
import { getSitrepBundle, type SitrepLoadOptions } from "../warroom/data";
import {
  DEFAULT_WARROOM_SCOPE,
  resolveScopeZipCodes,
  type WarroomScopeInput,
} from "../warroom/scope";
import type { WarroomLens } from "../warroom/mode";
import type { WarroomSitrepBundle } from "../warroom/signals";

const SITREP_BUNDLE_KEY = "warroom-sitrep";

export interface UseWarroomDataOptions {
  scope?: WarroomScopeInput;
  lens?: WarroomLens;
  rankLimit?: number;
  topSignalLimit?: number;
  requireFlags?: string[];
  excludeFlags?: string[];
  excludeCorporate?: boolean;
  initialData?: WarroomSitrepBundle;
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

function buildQueryKey(options: UseWarroomDataOptions): readonly unknown[] {
  return [
    SITREP_BUNDLE_KEY,
    serializeScope(options.scope),
    options.lens ?? "buyability",
    options.rankLimit ?? 40,
    options.topSignalLimit ?? 8,
    options.requireFlags?.slice().sort().join("|") ?? "",
    options.excludeFlags?.slice().sort().join("|") ?? "",
    options.excludeCorporate ?? false,
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
    initialData: options.initialData,
    retry: 1,
  };

  const query = useQuery<WarroomSitrepBundle, Error>(queryOptions);

  return Object.assign(query, { bundle: query.data });
}

export function warroomBundleQueryKey(options: UseWarroomDataOptions = {}): readonly unknown[] {
  return buildQueryKey(options);
}
