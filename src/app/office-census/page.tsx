import { createServerClient } from "@/lib/supabase/server";
import {
  getOfficeCensusCandidatesForZip,
  getOfficeCensusCoverage,
  getOfficeCensusLatestBuild,
  type OfficeCensusBuild,
  type OfficeCensusCandidate,
  type OfficeCensusZipCoverage,
} from "@/lib/supabase/queries/office-census";
import { OfficeCensusShell } from "./_components/office-census-shell";

export const dynamic = "force-dynamic"
export const revalidate = 0
export const metadata = {
  title: "Office Census | Chicagoland Census",
  description:
    "ZIP-by-ZIP research queue for which Chicagoland general dental offices exist and operate today.",
};

export default async function OfficeCensusPage({
  searchParams,
}: {
  searchParams: Promise<{ zip?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawZip = Array.isArray(sp.zip) ? sp.zip[0] : sp.zip;
  const zip = rawZip && /^\d{5}$/.test(rawZip) ? rawZip : null;

  const supabase = await createServerClient();

  let coverage: OfficeCensusZipCoverage[] = [];
  let build: OfficeCensusBuild | null = null;
  let candidates: OfficeCensusCandidate[] | null = null;
  let error: string | null = null;
  try {
    [coverage, build] = await Promise.all([
      getOfficeCensusCoverage(supabase),
      getOfficeCensusLatestBuild(supabase),
    ]);
    if (zip) candidates = await getOfficeCensusCandidatesForZip(supabase, zip);
  } catch (e: unknown) {
    error = serializeError(e);
    console.error("[/office-census] load failed:", e);
  }

  return (
    <OfficeCensusShell
      coverage={coverage}
      build={build}
      selectedZip={zip}
      candidates={candidates}
      error={error}
    />
  );
}

function serializeError(e: unknown): string {
  if (!e) return "Unknown error (null/undefined thrown)";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === "string") parts.push(obj.message);
    if (typeof obj.code === "string" || typeof obj.code === "number") parts.push(`(code: ${obj.code})`);
    if (typeof obj.details === "string") parts.push(`details: ${obj.details}`);
    if (typeof obj.hint === "string") parts.push(`hint: ${obj.hint}`);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(obj);
    } catch {
      return Object.prototype.toString.call(obj);
    }
  }
  return String(e);
}
