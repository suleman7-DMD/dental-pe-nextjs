import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * Each call returns a new client (no singleton) to avoid shared state between requests.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/** Alias used by page-level agent code. */
export const createServerClient = getSupabaseServerClient;
