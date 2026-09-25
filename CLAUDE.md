# dental-pe-nextjs — Frontend Guide

> **Keep this file short** — it is re-injected into context after every auto-compaction once any
> file in this directory is read. Project-wide rules, numbers, and routing live in the root
> `../CLAUDE.md`. Slimmed 2026-09-25 (94k → ~7k chars); the full verbatim prior version (ship logs,
> audit trails, bug-fix history) is `CLAUDE_ARCHIVE.md` in this directory — grep it when you need
> the history behind a "do not regress" rule.

**Ownership truth first:** before touching any ownership/consolidation display, read
`../data/dso_research/RESEARCH_HOME/SESSION_CHARTER_FABLE_TRUTH_APP_20260704.md` §2 (binding) and
reconcile against `src/lib/census/ownership-truth.ts` (canonical census contract + truth-law
tests). Census `ownership_tier` is the only ownership truth; the detector floor is context.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5, Supabase Postgres (read-only mirror of the
pipeline SQLite), TanStack React Query + Table, Recharts 3, Mapbox GL, Tailwind CSS 4, shadcn UI,
Lucide React. Deploys to Vercel on push to `main` (this dir is its own git repo).
Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`,
`ANTHROPIC_API_KEY` (only for `/api/launchpad/compound-narrative`; 503 without it).

## Layout

- `src/app/<route>/page.tsx` — async Server Component, `export const dynamic = 'force-dynamic'`, fetches Supabase, try/catch fallback UI, passes props to a `'use client'` `*-shell.tsx` in `_components/`.
- Routes: `/` home, `launchpad`, `warroom`, `deal-flow`, `market-intel`, `buyability`, `job-market`, `research`, `intelligence`, `system`, `data-breakdown`, `directory`, `practice/[locationId]`, `office-census`.
- `src/lib/supabase/queries/` — one module per table; every function takes a `SupabaseClient`.
- `src/lib/census/` — census truth layer (`ownership-truth`, `headline-stats`, `zip-census`, `funnel`, `job-lane`, `display-name`).
- `src/lib/constants/` — `entity-classifications.ts` (`classifyPractice`, `isCorporateClassification`, `INDEPENDENT_CLASSIFICATIONS`…), `consolidation-honesty.ts` (`getCorporateBand` floor→ADA band), `living-locations.ts`, `design-tokens.ts`, `sql-presets.ts`.
- `src/lib/warroom/`, `src/lib/launchpad/` — domain logic (see below). `src/lib/hooks/` — URL/state hooks (`use-url-filters`, `use-warroom-state`, `use-launchpad-state`…).
- `src/components/` — `data-display/` (DataTable, KpiCard, CorporateBandBar), `charts/`, `maps/`, `layout/sidebar.tsx`, `ui/` (shadcn).
- Home loads in two phases (parallel stats, then sequential retirement/acquisition queries) to avoid serverless concurrency issues.
- React Query defaults 30 min stale/gc, 1 retry, no refetch-on-focus; warroom/launchpad hooks override per query.

## Critical rules

- **`entity_classification` is primary**, `ownership_status` only as fallback when NULL — always via `classifyPractice()`. `src/__tests__/classification-primary.test.ts` (F27) fails on unpaired `ownership_status` references. Exclude `da_unverified` and `duplicate_location` from every count/filter surface (both map to "unknown").
- **Denominators:** headline practice counts are location-deduped — `zip_scores.total_gp_locations` (summed over scope), a `practice_locations` count query, or `dedupPracticesByLocation(rows)` in memory. Raw NPI row counts go in subtitles only, labeled "NPI records."
- **Corporate share is a floor, not a rate** — render via `getCorporateBand` / `CorporateBandBar` / `corporateBandSubtitle` with the runtime floor from synced `zip_scores`. Never hardcode census or floor numbers. Label "Known Corporate"; consolidation % uses total GP locations, never `classified_count`.
- **Fractions vs percents:** `corporate_share_pct` and `buyable_practice_ratio` are stored as FRACTIONS (0.0558) — multiply by 100 for display.
- **Scope default:** "Chicagoland" always resolves to the canonical 269-ZIP set — `getWatchedZips()` filtered to IL, `LIVING_LOCATIONS["All Chicagoland"].commutable_zips` (named lookup, never `Object.keys(...)[0]`), `LAUNCHPAD_SCOPES["chicagoland"]` via `resolveLaunchpadZipCodes()`, `WARROOM_SCOPES["chicagoland"]`. Sub-zones are never the page-load default.
- **Supabase 1000-row cap:** paginate with `.range()`; chunk ZIP arrays at 100 and paginate within each chunk. Prefer count queries over fetching rows for KPIs.
- **Rendering:** DataTable render functions return primitives (`string | number | null`), never objects/elements. Null → muted "—". KPI icons are Lucide JSX components, never strings.
- **Dates:** `formatDate()` (`lib/utils/formatting.ts`) must use `timeZone: "UTC"` for `YYYY-MM-DD` strings (else off-by-one in US time zones). Recharts: no negative left margins (garbles tick labels).
- **URL state:** filters/tabs sync through `useUrlFilters` / the page's state hook — keep views shareable by URL.
- Run `npm run build` after every change; run `npx vitest run` before claiming done.

## Warroom (`/warroom`)

Chicagoland command surface. All state is URL-serialized in `src/lib/hooks/use-warroom-state.ts`:
`mode` hunt|investigate · `lens` consolidation|density|buyability|retirement · `scope` (11: chicagoland,
6 sub-zones, saved_high_risk/retirement/whitespace) · filters · selection · pins.
- Lib (`src/lib/warroom/`): `mode`, `scope`, `geo`, `signals`, `data` (merges signal flags onto practices), `intent` (⌘K parser), `ranking`, `briefing`.
- UI (`_components/`): `warroom-shell`, `sitrep-kpi-strip`, `intent-bar`, `living-map`, `target-list`, `dossier-drawer`, `zip-dossier-drawer`, `pinboard-tray`, `pin-compare-drawer`, `briefing-rail`, `keyboard-shortcuts-overlay`.
- Flags: 8 practice (`stealth_dso`, `phantom_inventory`, `revenue_default`, `family_dynasty`, `micro_cluster`, `retirement_combo`, `last_change_90d`, `high_peer_retirement`, each `_flag`) + 1 ZIP (`zip_ada_benchmark_gap_flag`). Other flags were deliberately cut — don't resurrect.
- Keys: `?` help, `⌘K`/`/` intent bar, `1` Hunt, `2` Investigate, `R` reset, `P` pin, `V` reviewed, `[`/`]` step targets, `Esc` close.

## Launchpad (`/launchpad`)

First-job finder. Lib in `src/lib/launchpad/` (`signals`, `ranking`, `scope`, `dso-tiers`, `display`, `intel-audit`, `ai-*`).
- Score: base 50 + Σ `baseWeight × TRACK_MULTIPLIERS[track][signalId]`, clamped 0–100; three tracks (Succession/Apprentice, High-Volume Ethical, DSO Associate), "All" = max.
- Tiers: best_fit ≥80, strong ≥65, maybe ≥50, low ≥35, avoid <35. Confidence cap 70 when `intel == null` or `classification_confidence < 40` (trims only, never boosts).
- `dso-tiers.ts` is hand-curated with citations — a tier change must update rationale + citations together.
- Compound thesis route reads `practice_intel`; hedges when evidence is `partial`/`insufficient`, cites `[source: domain]`.

## Design

Warm light theme: bg #FAFAF7, cards #FFFFFF, sidebar #2C2C2C, accent goldenrod #B8860B; corporate #C23B3B, independent #2563EB, specialist #0D9488, group #6366F1. DM Sans headings, Inter body, JetBrains Mono KPI values. Tokens: `src/lib/constants/design-tokens.ts`.

## Commands

```bash
npm run dev       # localhost:3000
npm run build     # TypeScript check + production build — run after every change
npm run lint
npx vitest run    # regression + truth-law tests (incl. F27)
```
