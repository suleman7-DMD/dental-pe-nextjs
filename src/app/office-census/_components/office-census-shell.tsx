"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  GitMerge,
  HelpCircle,
  MapPinOff,
  SearchX,
  X,
} from "lucide-react";
import { KpiCard } from "@/components/data-display/kpi-card";
import { SectionHeader } from "@/components/data-display/section-header";
import { formatNumber } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils";
import type {
  OfficeCensusBuild,
  OfficeCensusCandidate,
  OfficeCensusQueueState,
  OfficeCensusZipCoverage,
} from "@/lib/supabase/queries/office-census";

// Units discipline: every row here is a CANDIDATE or a DIRECTORY ROW. Nothing is
// an "office" until a research-ledger decision confirms it (CONFIRMED_OPERATING_GP).

const MONO = { fontFamily: "var(--font-mono), JetBrains Mono, monospace" } as const;
const HEADING = { fontFamily: "var(--font-heading), DM Sans, sans-serif" } as const;

const STATE_META: Record<OfficeCensusQueueState, { label: string; color: string }> = {
  CONFIRMED_OPERATING_GP: { label: "Confirmed operating GP", color: "#2D8B4E" },
  NEEDS_CURRENT_VERIFICATION: { label: "Likely — needs verification", color: "#2563EB" },
  IDENTITY_REVIEW: { label: "Identity / split-merge review", color: "#7C3AED" },
  OPERATING_STATUS_UNRESOLVED: { label: "Operating status unresolved", color: "#C23B3B" },
  GP_SCOPE_UNRESOLVED: { label: "GP scope unresolved", color: "#0D9488" },
  LOCATION_INCOMPLETE: { label: "Location incomplete", color: "#D4920B" },
  SOURCE_CANDIDATE_UNREPRESENTED: { label: "Source candidate not represented", color: "#B8860B" },
  EXTERNAL_DISCOVERY: { label: "Externally missing (research find)", color: "#B8860B" },
  RESEARCHED_UNRESOLVED: { label: "Researched — unresolved", color: "#D4920B" },
  PROBABLE_NON_OFFICE: { label: "Probable non-office", color: "#6B6B60" },
  LIKELY_SPECIALIST_ONLY: { label: "Likely specialist-only", color: "#9C9C90" },
  RESOLVED_EXCLUDED: { label: "Resolved — excluded", color: "#6B6B60" },
  RESOLVED_SPLIT: { label: "Resolved — split", color: "#6B6B60" },
};
const STATE_ORDER = Object.keys(STATE_META) as OfficeCensusQueueState[];

const FLAG_LABELS: Record<string, string> = {
  multi_org_multi_phone: "several orgs + phones at street",
  multi_suite_multi_phone: "several suites + phones",
  phone_shared_with_other_address: "phone shared with another address",
  phone_matches_existing_row: "phone matches a directory row",
  possible_address_variant_of_row: "possible address variant of a row",
  name_possibly_generated: "name may be generated",
  no_federal_npi: "no federal NPI",
  high_provider_count: "high provider count",
  prior_note_successor: "prior note: successor",
  prior_note_closure: "prior note: closure",
  prior_note_moved: "prior note: moved",
  prior_site_dead_or_parked: "website dead/parked",
  stale_registry_only: "stale registry only",
  no_contact_channel: "no phone or website",
  address_not_a_street_location: "not a street address",
  state_mismatch: "state mismatch",
  mixed_gp_specialist_taxonomy: "mixed GP + specialist",
  name_suggests_specialty: "name suggests specialty",
  no_gp_taxonomy: "no GP taxonomy",
  da_listing_2025_plus: "Data Axle listing 2025+",
  da_record_pre_2024: "Data Axle record pre-2024",
  da_individual_listings_only: "Data Axle individual listings only",
  da_non_dental_sic: "Data Axle non-dental SIC",
  da_zip_centroid_only: "Data Axle ZIP-centroid geocode",
  excluded_as_da_unverified: "was excluded: Data Axle only",
  excluded_as_duplicate_location: "was excluded: duplicate location",
  excluded_as_non_clinical: "was excluded: non-clinical",
  excluded_as_residential: "was excluded: residential",
  excluded_as_solo_established: "was excluded: solo established",
  excluded_as_specialist: "was excluded: specialist",
};
const WARN_FLAGS = new Set([
  "prior_note_closure",
  "prior_note_moved",
  "prior_site_dead_or_parked",
  "no_contact_channel",
  "address_not_a_street_location",
  "state_mismatch",
  "stale_registry_only",
]);

const ORIGIN_LABELS: Record<string, string> = {
  directory_row: "Directory row",
  excluded_row: "Excluded row",
  data_axle_unrepresented: "Data Axle record",
  nppes_unrepresented: "NPPES record",
  dso_locator_unrepresented: "DSO locator",
  external_discovery: "External discovery",
};

const COORD_LABELS: Record<string, string> = {
  none: "No coordinates",
  stored_unverified: "Stored coords (address not yet verified)",
  recoverable_da_parcel: "Recoverable (Data Axle parcel)",
  recoverable_da_site: "Recoverable (Data Axle site)",
  stored_suspect_shared_point: "Suspect shared point",
  verified: "Verified",
};

const EVIDENCE_LABELS: Record<string, string> = {
  none: "No prior research",
  ownership_review_only: "Ownership review only",
  researched: "Prior web research",
  site_checked_live: "Website checked live",
};

const STAGE_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  rows_validated: "Rows validated",
  discovery_done: "Discovery done",
  recall_audited: "Recall audited",
};

type SortKey =
  | "batch_rank"
  | "zip"
  | "directory_rows"
  | "confirmed"
  | "open_items"
  | "review_items"
  | "identity_review"
  | "status_unresolved"
  | "source_unrepresented"
  | "dir_no_prior_research"
  | "dir_missing_coords";

const COLUMNS: Array<{ key: SortKey; label: string; title: string }> = [
  { key: "batch_rank", label: "Batch #", title: "Order the batch planner will take this ZIP (pilots first, then most review items)" },
  { key: "zip", label: "ZIP", title: "ZIP code" },
  { key: "directory_rows", label: "Dir. rows", title: "Rows currently in the practice directory for this ZIP" },
  { key: "confirmed", label: "Confirmed", title: "Candidates confirmed operating GP by a research-ledger decision" },
  { key: "open_items", label: "Open", title: "Candidates still needing work (excludes probable non-office / likely specialist-only)" },
  { key: "review_items", label: "Review", title: "Identity + status + GP-scope + unrepresented source + external items" },
  { key: "identity_review", label: "Identity", title: "Rows that may merge several offices or duplicate another row" },
  { key: "status_unresolved", label: "Status", title: "Rows where existing data contradicts current operation" },
  { key: "source_unrepresented", label: "Src. gaps", title: "Raw source records at a street address the directory lacks" },
  { key: "dir_no_prior_research", label: "No research", title: "Directory rows with no prior research of any kind" },
  { key: "dir_missing_coords", label: "No coords", title: "Directory rows without stored coordinates" },
];

interface OfficeCensusShellProps {
  coverage: OfficeCensusZipCoverage[];
  build: OfficeCensusBuild | null;
  selectedZip: string | null;
  candidates: OfficeCensusCandidate[] | null;
  error: string | null;
}

export function OfficeCensusShell({
  coverage,
  build,
  selectedZip,
  candidates,
  error,
}: OfficeCensusShellProps) {
  const [sortKey, setSortKey] = useState<SortKey>("batch_rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");
  const [pilotOnly, setPilotOnly] = useState(false);

  const totals = useMemo(() => {
    const sum = (k: keyof OfficeCensusZipCoverage) =>
      coverage.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return {
      zips: coverage.length,
      directory: sum("directory_rows"),
      confirmed: sum("confirmed"),
      needs: sum("needs_verification"),
      identity: sum("identity_review"),
      status: sum("status_unresolved"),
      scope: sum("gp_scope_unresolved"),
      location: sum("location_incomplete"),
      source: sum("source_unrepresented"),
      external: sum("external_pending"),
      open: sum("open_items"),
      missingCoords: sum("dir_missing_coords"),
      recoverableCoords: sum("dir_coords_recoverable"),
      noResearch: sum("dir_no_prior_research"),
      started: coverage.filter((r) => r.stage !== "not_started").length,
    };
  }, [coverage]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = coverage.filter(
      (r) =>
        (!pilotOnly || r.pilot) &&
        (!q || r.zip.includes(q) || (r.city ?? "").toLowerCase().includes(q))
    );
    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir || a.batch_rank - b.batch_rank;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [coverage, search, pilotOnly, sortKey, sortAsc]);

  const selectedCoverage = selectedZip ? coverage.find((r) => r.zip === selectedZip) ?? null : null;
  const manifest = build?.manifest;
  const byState = manifest?.totals?.by_state ?? {};
  const dirByState = manifest?.totals?.directory_by_state ?? {};

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "batch_rank" || key === "zip");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-[#B8860B]" />
            <h1 className="text-[24px] font-bold text-[#1A1A1A]" style={HEADING}>
              Office Census
            </h1>
          </div>
          <p className="mt-2 max-w-3xl text-[13px] text-[#6B6B60]">
            Which general dental offices exist and operate today, ZIP by ZIP. Every row below is a{" "}
            <strong>research candidate</strong>, not a verified office. A candidate becomes a confirmed
            office only when a dated research-ledger decision cites a phone call, a DSO locator, or two
            independent sources seen within the last year. A website alone, an NPI alone, or absence
            from a directory never settles it.
          </p>
        </div>
        {build && (
          <div className="text-right text-[11px] text-[#9C9C90]" style={MONO}>
            <div>build {build.build_id}</div>
            <div>rules {build.rules_version}</div>
            <div>built {build.built_at.slice(0, 10)} · published {build.published_at.slice(0, 10)}</div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-[#C23B3B]/30 bg-[#C23B3B]/5 px-4 py-3 text-[13px] text-[#C23B3B]">
          <strong>Error loading the office census:</strong> {error}
        </div>
      )}

      {!error && coverage.length === 0 && (
        <div className="mt-6 rounded-md border border-[#E8E5DE] bg-white px-4 py-3 text-[13px] text-[#6B6B60]">
          The office-census queue has not been published yet.
        </div>
      )}

      {coverage.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Confirmed operating GP"
              value={formatNumber(totals.confirmed)}
              suffix={`/ ${formatNumber(totals.directory)}`}
              subtitle="directory rows confirmed by a ledger decision"
              accentColor="#2D8B4E"
              tooltip="Only research-ledger decisions move a candidate here. The directory row count is the denominator, not a claim that all of those offices exist."
            />
            <KpiCard
              icon={<HelpCircle className="h-4 w-4" />}
              label="Likely, unverified"
              value={formatNumber(totals.needs)}
              subtitle="no contradiction on file, no current confirmation"
              accentColor="#2563EB"
            />
            <KpiCard
              icon={<GitMerge className="h-4 w-4" />}
              label="Identity review"
              value={formatNumber(totals.identity)}
              subtitle="row may merge several offices or duplicate another"
              accentColor="#7C3AED"
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Status unresolved"
              value={formatNumber(totals.status)}
              subtitle="closure / move / dead-site signals on file"
              accentColor="#C23B3B"
            />
            <KpiCard
              icon={<SearchX className="h-4 w-4" />}
              label="Source gaps"
              value={formatNumber(totals.source)}
              subtitle="raw records at addresses the directory lacks"
              accentColor="#B8860B"
              tooltip="Data Axle, NPPES and DSO-locator records at a street address with no directory row. Candidates only: many are stale or duplicates of a row under a different spelling."
            />
            <KpiCard
              icon={<MapPinOff className="h-4 w-4" />}
              label="Rows without coords"
              value={formatNumber(totals.missingCoords)}
              subtitle={`${formatNumber(totals.recoverableCoords)} recoverable; stored coords are unverified`}
              accentColor="#D4920B"
              tooltip="Map pins are placed only after the address is verified. No ZIP-centroid placeholders."
            />
          </div>

          <p className="mt-3 text-[12px] text-[#9C9C90]">
            {formatNumber(totals.zips)} watched Chicagoland ZIPs · {formatNumber(totals.started)} started ·{" "}
            {formatNumber(totals.open)} open candidates · {formatNumber(totals.noResearch)} directory rows never
            researched in any prior pass · {formatNumber(manifest?.totals?.ledger_decisions ?? 0)} ledger decisions
          </p>

          {selectedZip && (
            <ZipDrilldown
              zip={selectedZip}
              coverage={selectedCoverage}
              candidates={candidates ?? []}
              definitions={manifest?.state_definitions ?? {}}
            />
          )}

          <SectionHeader
            title="ZIP gap table"
            description="Click a ZIP to open its candidates. Batch # is the order the planner works through."
            tooltip="Pilot ZIPs come first, then ZIPs with the most review items. Sorting here does not change the planner's order."
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ZIP or city"
              className="h-8 w-56 rounded-md border border-[#E8E5DE] bg-[#F5F5F0] px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#B8860B]"
            />
            <label className="flex items-center gap-2 text-[12px] text-[#6B6B60]">
              <input type="checkbox" checked={pilotOnly} onChange={(e) => setPilotOnly(e.target.checked)} />
              Pilot ZIPs only
            </label>
            <span className="text-[12px] text-[#9C9C90]">{rows.length} ZIPs</span>
          </div>
          <div className="mt-3 max-h-[560px] overflow-auto rounded-lg border border-[#E8E5DE] bg-white">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#F7F7F4]">
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      title={c.title}
                      onClick={() => onSort(c.key)}
                      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[#6B6B60]"
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortKey === c.key &&
                          (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[#6B6B60]">
                    Stage
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.zip}
                    className={cn(
                      "border-t border-[#E8E5DE] hover:bg-[#F7F7F4]",
                      r.zip === selectedZip && "bg-[#B8860B]/10"
                    )}
                  >
                    <td className="px-3 py-1.5 text-[#9C9C90]" style={MONO}>{r.batch_rank}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Link
                        href={`/office-census?zip=${r.zip}`}
                        scroll={false}
                        className="font-semibold text-[#B8860B] hover:underline"
                        style={MONO}
                      >
                        {r.zip}
                      </Link>
                      <span className="ml-2 text-[#6B6B60]">{r.city ?? ""}</span>
                      {r.pilot && (
                        <span className="ml-2 rounded bg-[#B8860B]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8a6508]">
                          pilot
                        </span>
                      )}
                    </td>
                    {COLUMNS.slice(2).map((c) => (
                      <td key={c.key} className="px-3 py-1.5 text-right text-[#1A1A1A]" style={MONO}>
                        {formatNumber(r[c.key] as number)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 whitespace-nowrap text-[#6B6B60]">{STAGE_LABELS[r.stage] ?? r.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader
            title="Queue states"
            description="Every candidate sits in exactly one state. Counts are live from the published build."
          />
          <div className="mt-3 overflow-hidden rounded-lg border border-[#E8E5DE] bg-white">
            <table className="w-full text-[12px]">
              <thead className="bg-[#F7F7F4]">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-[#6B6B60]">
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Meaning</th>
                  <th className="px-3 py-2 text-right">All candidates</th>
                  <th className="px-3 py-2 text-right">Directory rows</th>
                </tr>
              </thead>
              <tbody>
                {STATE_ORDER.map((s) => (
                  <tr key={s} className="border-t border-[#E8E5DE] align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatePill state={s} />
                    </td>
                    <td className="px-3 py-2 text-[#6B6B60]">{manifest?.state_definitions?.[s] ?? ""}</td>
                    <td className="px-3 py-2 text-right" style={MONO}>{formatNumber(byState[s] ?? 0)}</td>
                    <td className="px-3 py-2 text-right" style={MONO}>{formatNumber(dirByState[s] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatePill({ state }: { state: OfficeCensusQueueState }) {
  const meta = STATE_META[state] ?? { label: state, color: "#6B6B60" };
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color: meta.color, backgroundColor: `color-mix(in srgb, ${meta.color} 12%, #FFFFFF)` }}
    >
      {meta.label}
    </span>
  );
}

function ZipDrilldown({
  zip,
  coverage,
  candidates,
  definitions,
}: {
  zip: string;
  coverage: OfficeCensusZipCoverage | null;
  candidates: OfficeCensusCandidate[];
  definitions: Record<string, string>;
}) {
  const [showExcluded, setShowExcluded] = useState(false);
  const groups = useMemo(() => {
    const m = new Map<OfficeCensusQueueState, OfficeCensusCandidate[]>();
    for (const c of candidates) {
      if (!showExcluded && (c.queue_state === "LIKELY_SPECIALIST_ONLY" || c.queue_state === "PROBABLE_NON_OFFICE"))
        continue;
      const list = m.get(c.queue_state) ?? [];
      list.push(c);
      m.set(c.queue_state, list);
    }
    return STATE_ORDER.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const);
  }, [candidates, showExcluded]);
  const hidden = candidates.filter(
    (c) => c.queue_state === "LIKELY_SPECIALIST_ONLY" || c.queue_state === "PROBABLE_NON_OFFICE"
  ).length;

  return (
    <div className="mt-6 rounded-lg border border-[#B8860B]/40 bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[18px] font-bold text-[#1A1A1A]" style={HEADING}>
            ZIP {zip} {coverage?.city ? `· ${coverage.city}` : ""}
          </h2>
          {coverage ? (
            <p className="mt-1 text-[12px] text-[#6B6B60]">
              Batch #{coverage.batch_rank} · {STAGE_LABELS[coverage.stage] ?? coverage.stage} ·{" "}
              {coverage.directory_rows} directory rows · {coverage.confirmed} confirmed · {coverage.open_items} open ·{" "}
              {coverage.source_candidates} source candidates · {coverage.excluded_rows} excluded rows
              {coverage.sources_searched.length > 0 && ` · sources searched: ${coverage.sources_searched.join(", ")}`}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[#C23B3B]">ZIP {zip} is not in the watched Chicagoland set.</p>
          )}
          <p className="mt-1 text-[11px] text-[#9C9C90]" style={MONO}>
            python3 scrapers/office_census.py next-batch --zip {zip}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hidden > 0 && (
            <label className="flex items-center gap-2 text-[12px] text-[#6B6B60]">
              <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
              Show {hidden} probable non-office / specialist-only
            </label>
          )}
          <Link
            href="/office-census"
            scroll={false}
            className="inline-flex items-center gap-1 rounded border border-[#E8E5DE] px-2 py-1 text-[12px] text-[#6B6B60] hover:bg-[#F7F7F4]"
          >
            <X className="h-3 w-3" /> Close
          </Link>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="mt-4 text-[13px] text-[#6B6B60]">No candidates to show for this ZIP.</p>
      )}

      {groups.map(([state, list]) => (
        <div key={state} className="mt-5">
          <div className="flex items-center gap-2">
            <StatePill state={state} />
            <span className="text-[12px] text-[#9C9C90]">{list.length}</span>
          </div>
          {definitions[state] && <p className="mt-1 text-[11px] text-[#9C9C90]">{definitions[state]}</p>}
          <div className="mt-2 divide-y divide-[#E8E5DE] rounded-md border border-[#E8E5DE]">
            {list.map((c) => (
              <CandidateRow key={c.candidate_id} c={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CandidateRow({ c }: { c: OfficeCensusCandidate }) {
  const pe = c.prior_evidence ?? {};
  const links: Array<{ label: string; url: string }> = [];
  const addLink = (label: string, url: string | null | undefined) => {
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (!links.some((l) => l.url === href)) links.push({ label, url: href });
  };
  addLink("website on file", c.website);
  pe.job_hunt_check?.evidence_urls?.forEach((u) => addLink("site check", u));
  pe.ownership_census?.evidence_urls?.forEach((u) => addLink("ownership review", u));
  pe.ai_dossier?.urls?.forEach((u) => addLink("dossier", u));

  const suites = c.suites_seen ?? [];
  const npis = c.source_refs?.npis ?? [];
  const samePhone = c.source_refs?.same_phone_rows ?? [];
  const variants = c.source_refs?.address_variant_rows ?? [];

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#1A1A1A]">{c.name ?? "(no name)"}</div>
          <div className="text-[12px] text-[#6B6B60]">
            {c.address ?? "(no address)"}
            {c.suite ? `, suite ${c.suite}` : ""}
            {suites.length > 1 && ` · suites seen: ${suites.join(", ")}`}
            {c.phone ? ` · ${c.phone}` : ""}
          </div>
        </div>
        <div className="text-right text-[11px] text-[#9C9C90]">
          <div>
            {ORIGIN_LABELS[c.origin] ?? c.origin} · priority {c.priority} · {c.effort.replace("_", " ")}
          </div>
          <div>
            {EVIDENCE_LABELS[c.prior_evidence_level] ?? c.prior_evidence_level} ·{" "}
            {COORD_LABELS[c.coord_status] ?? c.coord_status}
          </div>
        </div>
      </div>
      {c.flags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {c.flags.map((f) => (
            <span
              key={f}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px]",
                WARN_FLAGS.has(f) ? "bg-[#C23B3B]/10 text-[#C23B3B]" : "bg-[#F5F5F0] text-[#6B6B60]"
              )}
            >
              {FLAG_LABELS[f] ?? f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B6B60]">
        {c.provider_count != null && <span>{c.provider_count} NPI providers</span>}
        {npis.length > 0 && <span>{npis.length} NPIs on file</span>}
        {(c.phones_at_street ?? 0) > 1 && <span>{c.phones_at_street} phones at this street</span>}
        {(c.da_records_at_street ?? 0) > 0 && (
          <span>
            {c.da_records_at_street} Data Axle records
            {c.da_latest_update ? ` (latest ${c.da_latest_update.slice(0, 4)}-${c.da_latest_update.slice(4)})` : ""}
          </span>
        )}
        {samePhone.length > 0 && <span>same phone as {samePhone.join(", ")}</span>}
        {variants.length > 0 && <span>address variant of {variants.join(", ")}</span>}
        {pe.job_hunt_check && (
          <span>
            site check {pe.job_hunt_check.checked_at ?? ""}: {pe.job_hunt_check.website_status ?? "?"}
          </span>
        )}
        {pe.ai_dossier && (
          <span>
            dossier {pe.ai_dossier.researched_at ?? ""} ({pe.ai_dossier.quality ?? "?"}
            {pe.ai_dossier.google_recent_review ? `, last review ${pe.ai_dossier.google_recent_review}` : ""})
          </span>
        )}
        {pe.ownership_census && <span>ownership review {pe.ownership_census.reviewed_at ?? ""}</span>}
        {c.observations > 0 && <span>{c.observations} ledger observations</span>}
        <span className="text-[#9C9C90]" style={MONO}>{c.candidate_id}</span>
      </div>
      {links.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {links.slice(0, 6).map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#B8860B] hover:underline"
              title={l.url}
            >
              <ExternalLink className="h-3 w-3" />
              {l.label}: {l.url.replace(/^https?:\/\/(www\.)?/i, "").slice(0, 40)}
            </a>
          ))}
          {links.length > 6 && <span className="text-[#9C9C90]">+{links.length - 6} more</span>}
        </div>
      )}
    </div>
  );
}
