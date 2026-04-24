# Dental PE Intelligence Platform — Claude Code Guide

## What This Project Is

A Next.js 16 + Supabase + Vercel web application that tracks private equity consolidation in US dentistry. It connects to a Supabase Postgres database populated by a Python scraper pipeline, visualizes 400k+ dental practices, 2,500+ PE deals, and 290 scored markets. The frontend provides 9 pages of market intelligence — including the **Warroom** god-mode command surface and **Launchpad** for first-job finding — with maps, charts, data tables, and deep-dive research tools.

**Live app:** https://dental-pe-nextjs.vercel.app
**Data pipeline repo:** github.com/suleman7-DMD/dental-pe-tracker (Python scrapers write to SQLite, sync to Supabase)
**Frontend repo:** github.com/suleman7-DMD/dental-pe-nextjs

## Architecture

```
src/
  app/                    Next.js App Router — 9 page routes + API routes
    _components/          Home page shell
    warroom/              Chicagoland god-mode command surface (4 modes, 8 lenses, 12 scopes)
    launchpad/              First-job finder for new grads (4 scopes, 3 tracks, 20 signals, 5-tab dossier)
    deal-flow/            PE deal tracking (timeline, sponsors, state choropleth)
    market-intel/         ZIP consolidation analysis (maps, saturation, changes)
    buyability/           Acquisition target scoring
    job-market/           Career opportunity finder (density maps, directory)
    intelligence/         AI qualitative dossiers (ZIP + practice intel)
    research/             Deep dives (sponsor/platform profiles, SQL explorer)
    system/               Pipeline health, data freshness, manual entry
    api/                  Route handlers (deals, practices, sql-explorer, watched-zips)
  components/             Shared UI components
    charts/               Recharts wrappers (bar, donut, scatter, histogram, etc.)
    data-display/         DataTable, KPI cards, badges, confidence stars
    filters/              Filter bar, multi-select, date range, search
    layout/               Sidebar, sticky section nav, warroom-cross-link banner
    maps/                 Mapbox GL container
    ui/                   shadcn base components (button, card, dialog, etc.)
  lib/
    constants/            Entity classifications, colors, design tokens, locations
    hooks/                useSidebar, useUrlFilters, useSectionObserver, useWarroomState, useWarroomData
    supabase/             Client/server Supabase setup + query functions
    types/                TypeScript interfaces (Deal, Practice, ZipScore w/ 40+ fields, etc.)
    utils/                Formatting, scoring, CSV export, color helpers
    warroom/              Warroom-specific: mode, scope, signals, intent, ranking, briefing, geo, data
    launchpad/              Launchpad-specific: scope (4 locations), dso-tiers (16 curated DSOs), signals (20 IDs + types), ranking (track multipliers + scoring engine)
  providers/              QueryProvider (React Query), SidebarProvider
```

Push to `main` → Vercel auto-deploys in ~90s.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Language | TypeScript 5 |
| Database | Supabase (Postgres) |
| State Management | TanStack React Query + URL params + localStorage |
| Styling | Tailwind CSS 4 + shadcn UI + CSS custom properties |
| Charts | Recharts 3 |
| Maps | Mapbox GL + react-map-gl |
| Tables | TanStack React Table |
| Icons | Lucide React |
| Fonts | DM Sans (headings), Inter (body), JetBrains Mono (data values) |
| Deployment | Vercel (serverless) |

## Database (Supabase Postgres)

Key tables (mirrored from Python pipeline's SQLite via `sync_to_supabase.py`):

- **practices**: 400,962 rows. NPI (PK), practice_name, doing_business_as, address, city, state, zip, phone, entity_type, taxonomy_code, ownership_status, entity_classification, classification_reasoning, affiliated_dso, affiliated_pe_sponsor, buyability_score, classification_confidence, data_source, latitude, longitude, parent_company, ein, franchise_name, website, year_established, employee_count, estimated_revenue, num_providers, location_type, data_axle_import_date
- **deals**: 2,512 rows. PE dental deals from PESP, GDN, PitchBook
- **practice_changes**: 5,100+ rows. Change log for name/address/ownership changes (acquisition detection).
- **zip_scores**: 290 rows. Per-ZIP consolidation stats with 40+ columns including saturation metrics (dld_gp_per_10k, buyable_practice_ratio, corporate_share_pct, corporate_highconf_count, market_type, metrics_confidence, opportunity_score, etc.)
- **watched_zips**: 290 ZIPs (269 Chicagoland + 21 Boston). Includes population, median_household_income.
- **dso_locations**: 408 scraped DSO office locations from ADSO websites.
- **ada_hpi_benchmarks**: 918 rows. State-level DSO affiliation rates by career stage (2022-2024).
- **pe_sponsors**: 33 known PE sponsor profiles.
- **platforms**: 69 known DSO platform profiles.

### Current Data Stats
- 401,645 practices (14,045 in watched ZIPs, all with entity_classification)
- 3,215 deals (164 YTD 2026, coverage Oct 2020 – Mar 2026)
- 2,992 Data Axle enriched practices (with lat/lon, revenue, employees, year established)
- 290 scored ZIPs (279 with saturation metrics)
- 226 retirement risk practices (independent, established before 1995, in watched ZIPs)
- 34 buyability targets (buyability_score >= 50, in watched ZIPs)
- 262 high-confidence corporate (1.9%): 199 real dso_national + 23 strong dso_regional + 40 DSO-owned specialists
- 1,392 all-signals corporate (9.9%): all dso_regional + all dso_national

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

## Dashboard Pages (9 total)

| Route | Page | What It Shows |
|-------|------|---------------|
| `/` | **Home** | 8 KPI cards (deals, sponsors, practices, ZIPs, corporate %, retirement risk, YTD deals, freshness), 6 nav cards, recent deals table, data freshness bar |
| `/launchpad` | **Launchpad** | First-job finder for new dental grads. Track-weighted 0-100 scoring across 3 tracks (Succession / Apprentice, High-Volume Ethical, DSO Associate). 20-signal catalog, 5-tier ranking (Best Fit / Strong / Maybe / Low / Avoid). 4 living-location scopes (West Loop, Woodridge, Bolingbrook, All Chicagoland). 5-tab practice dossier (Snapshot / Compensation / Mentorship / Red Flags / Interview Prep). Curated DSO tier list with comp bands + citations. Base score 50, signal×track multiplier, confidence cap at 70 for thin-data practices. |
| `/warroom` | **Warroom** | Chicagoland god-mode command surface. 4 modes (Sitrep / Hunt / Profile / Investigate), 8 lenses (consolidation, density, buyability, retirement, pe_exposure, saturation, whitespace, disagreement), 12 scopes (US, chicagoland, 7 subzones, 3 saved presets). Intent bar (⌘K), Living Map, ranked target list, ZIP + practice dossier drawers, pinboard tray, signal flag overlays, keyboard shortcuts overlay (?), URL-synced state. |
| `/deal-flow` | **Deal Flow** | 2,512 PE deals — KPIs, monthly stacked bar timeline, top 15 sponsors/platforms, state choropleth, searchable deals table with CSV. All queries paginated (no 1000-row truncation). |
| `/market-intel` | **Market Intel** | Tiered consolidation KPIs (high-confidence corporate ~2.3% vs all-signals ~9.9%), DSO penetration table, consolidation map, ZIP score table, city practice tree with pre-loaded counts, ownership breakdown with per-classification counts. Cross-link banner to Warroom. |
| `/buyability` | **Buyability** | Data-driven KPIs (Acquisition Targets, Dead Ends, Job Targets, Specialists computed from entity_classification + buyability_score), 25-row paginated table with category badges, color-coded by category |
| `/job-market` | **Job Market** | Living location selector, 9 KPI cards with **tiered consolidation display** (high-confidence 1.9% + all-signals 9.9% + industry estimate), pydeck density map, market overview (donut, bar, histogram, top DSOs), paginated practice directory with 4 tabs, opportunity signals, ownership landscape, market analytics |
| `/intelligence` | **Intelligence** | AI qualitative dossiers — 6 KPI cards (coverage, readiness, cost, confidence), ZIP market intel table with expandable 10-signal panels, practice dossier table with readiness/confidence badges. Cross-link banner to Warroom Investigate mode. |
| `/research` | **Research** | 4 tabs — PE sponsor profiles, platform profiles, state deep dive, SQL explorer with preset queries |
| `/system` | **System** | Data source coverage table, freshness timestamps, completeness bars, pipeline log viewer, manual entry forms (add deal, update practice, add ZIP) |

## Warroom Architecture

The Warroom (`/warroom`) is the unified command surface for Chicagoland acquisition intelligence. It collapses Market Intel, Buyability, Job Market, and Intelligence into one stateful dashboard driven by URL params.

### State model

URL-synced state lives in `src/lib/hooks/use-warroom-state.ts` and serializes the full viewport — mode, lens, scope, filters, selected entity, pins — into query params. Deep links always reproduce the exact view.

| Dimension | Values | Purpose |
|-----------|--------|---------|
| `mode` | `sitrep` \| `hunt` \| `profile` \| `investigate` | Top-level task (snapshot vs. prospecting vs. deep dive vs. pattern analysis) |
| `lens` | `consolidation` \| `density` \| `buyability` \| `retirement` \| `pe_exposure` \| `saturation` \| `whitespace` \| `disagreement` | What to color/rank by |
| `scope` | `us` \| `chicagoland` \| `chicago_west_loop` \| `chicago_south_loop` \| `woodridge` \| `bolingbrook` \| `oak_park` \| `evanston` \| `naperville` \| `saved_high_risk` \| `saved_retirement` \| `saved_whitespace` | Which ZIP set to load |

### Library layer (`src/lib/warroom/`)

| File | Purpose |
|------|---------|
| `mode.ts` | `WARROOM_MODES` + `WARROOM_LENSES` constants with labels/icons |
| `scope.ts` | 12 scope definitions (US, chicagoland, 7 subzones, 3 saved) + `normalizeWarroomDataScope()` |
| `geo.ts` | Geographic helpers — subzone ZIP lookups, bounding boxes |
| `signals.ts` | `WarroomPracticeRecord`, `WarroomSitrepBundle`, `RankedTarget` types + 15 signal flag definitions |
| `data.ts` | `getSitrepBundle()` — batch-fetches practices/zip_scores/signals by scope, computes `topSignals` (stealthClusters, intelDisagreements, whitespace, etc.) |
| `intent.ts` | `buildIntentFromFilter()`, `PRACTICE_FLAG_LABELS`, `ZIP_FLAG_LABELS` — natural-language intent parsing |
| `ranking.ts` | `rankTargets()` — composite scoring across lens, flag count, enrichment, buyability |
| `briefing.ts` | `buildBriefingItems()` — contextual alerts + suggested actions per scope |

### UI layer (`src/app/warroom/_components/`)

| Component | Role |
|-----------|------|
| `warroom-shell.tsx` | Orchestrator — holds state hook, renders conditional mode panels + drawers, wires keyboard shortcuts |
| `scope-selector.tsx` | Scope dropdown with 12 options grouped into US / Chicagoland / Subzones / Saved |
| `intent-bar.tsx` | ⌘K-focusable intent input — parses natural language into filter state |
| `sitrep-kpi-strip.tsx` | 6 KPIs in Sitrep mode (practices, corporate %, retirement risk, etc.) |
| `living-map.tsx` | Mapbox ZIP choropleth colored by active lens with signal flag overlays |
| `briefing-pane.tsx` | Scope-specific alerts + suggested intent chips |
| `target-list.tsx` | Ranked practices in Hunt mode with flag badges |
| `dossier-drawer.tsx` | Practice deep dive — signals, flags, intel dossier if present, action buttons |
| `zip-dossier-drawer.tsx` | ZIP deep dive — saturation, ownership mix, top practices |
| `profile-mode-panel.tsx` | Pinned-targets workspace with side-by-side compare |
| `investigate-mode-panel.tsx` | Signal co-occurrence analysis + compound-flag target list |
| `pinboard-tray.tsx` | Bottom tray showing pinned targets across sessions |
| `keyboard-shortcuts-overlay.tsx` | `?`-triggered shadcn Dialog listing all shortcuts |

### Signal flags (15 practice + 8 ZIP)

Computed at load time in `data.ts` and merged into `signals` array on each practice record. Used for rank boosts, drawer badges, and investigate-mode clustering.

Practice-level (examples): `stealth_dso_flag`, `phantom_inventory_flag`, `retirement_combo_flag`, `white_space_flag`, `intel_quant_disagreement_flag`, `high_opportunity_flag`, `pe_sponsor_recent_flag`.

ZIP-level: `saturation_imbalance_flag`, `confidence_divergence_flag`, `whitespace_flag`, etc. (see `signals.ts` for the full list).

### Keyboard shortcuts

`?` toggles the overlay. `⌘K` / `/` focuses the intent bar. `1`-`4` switches modes. `R` resets filters + intent + selection. `P` toggles pin on the selected target. `Esc` closes drawers / overlays. Single-key shortcuts are suppressed when focus is in an `<input>` / `<textarea>` / contenteditable.

### Cross-links from legacy pages

`/market-intel` and `/intelligence` render a `WarroomCrossLink` banner (`src/components/layout/warroom-cross-link.tsx`) with preset `hrefSuffix` — e.g., Market Intel → `?mode=sitrep&lens=consolidation`, Intelligence → `?mode=investigate&lens=disagreement`. Legacy pages retain their full deep-dive functionality.

## Launchpad File Reference

| File | What It Does |
|------|-------------|
| `src/app/launchpad/page.tsx` | Launchpad — `force-dynamic` Server Component calling `getLaunchpadBundle` |
| `src/app/launchpad/_components/launchpad-shell.tsx` | Launchpad orchestrator — holds state, wires top bar, list, dossier |
| `src/app/launchpad/_components/scope-selector.tsx` | 4-option living-location dropdown (West Loop, Woodridge, Bolingbrook, All Chicagoland) |
| `src/app/launchpad/_components/track-switcher.tsx` | All / Succession / High-Volume / DSO track toggle |
| `src/app/launchpad/_components/launchpad-kpi-strip.tsx` | 6 KPIs (practices, best-fit, mentor-rich, hiring, avoid, comp range) |
| `src/app/launchpad/_components/track-list.tsx` | Ranked list grouped by tier (Best Fit / Strong / Maybe / Low / Avoid) |
| `src/app/launchpad/_components/track-list-card.tsx` | Single ranked-practice card with score, tier badge, signals, warnings |
| `src/app/launchpad/_components/practice-dossier.tsx` | 5-tab drawer — Snapshot / Compensation / Mentorship / Red Flags / Interview Prep; header pin toggle, Snapshot tab embeds NarrativeCard |
| `src/app/launchpad/_components/living-map.tsx` | Mapbox living map — practice hexes or ZIP choropleth, lens toggle, selection-aware |
| `src/app/launchpad/_components/zip-dossier-drawer.tsx` | ZIP drawer (Overview / Top targets / PE activity) — auto-opens when selectedZip is set |
| `src/app/launchpad/_components/narrative-card.tsx` | Claude Haiku "Why this practice for me?" narrative — generate-on-demand, React-Query cached by (npi, track), copy + regenerate |
| `src/app/launchpad/_components/red-flag-patterns.tsx` | Co-occurrence heatmap of 8 warning signals + compound-red-flag target list |
| `src/app/launchpad/_components/pinboard-panel.tsx` | Horizontal pinned-target strip — score, tier, DSO tier, unpin on hover, clear-all |
| `src/app/launchpad/_components/saved-searches-menu.tsx` | Top-bar dropdown — save/load/delete named views (scope + track + pins), 12-search cap, localStorage-backed |
| `src/app/api/launchpad/narrative/route.ts` | POST Claude Haiku narrative endpoint — returns 503 if `ANTHROPIC_API_KEY` unset |
| `src/lib/launchpad/scope.ts` | LAUNCHPAD_SCOPES + resolveLaunchpadZipCodes (reuses LIVING_LOCATIONS) |
| `src/lib/launchpad/signals.ts` | 20 signal IDs, LaunchpadTrack types, tier thresholds, LaunchpadBundle type contract |
| `src/lib/launchpad/ranking.ts` | TRACK_MULTIPLIERS table, evaluateSignals, scoreForTrack, rankTargets orchestrator |
| `src/lib/launchpad/dso-tiers.ts` | 16 hand-curated DSO entries with tiers, rationale, citations, comp bands |
| `src/lib/hooks/use-launchpad-state.ts` | URL-synced Launchpad state — scope, track, selectedNpi, pinnedNpis, view, mapView, selectedZip + `togglePin`/`clearPins`/`loadSavedSearch` helpers |
| `src/lib/hooks/use-launchpad-data.ts` | React Query wrapper for LaunchpadBundle |
| `src/lib/hooks/use-launchpad-narrative.ts` | useMutation wrapper for narrative endpoint + `narrativeCacheKey(npi, track)` cache helper |
| `src/lib/hooks/use-launchpad-saved-searches.ts` | localStorage CRUD for named saved views (scope + track + pins), 12-entry cap, sanitized IDs |
| `src/lib/supabase/queries/launchpad.ts` | getLaunchpadBundle — parallel fetch + rankTargets + summary |


## Data Flow Pattern

### Server Components (pages)
All `page.tsx` files are async Server Components with `export const dynamic = 'force-dynamic'`. They fetch initial data from Supabase server-side and pass it to Client Component shells via props. All pages have try/catch error handling with fallback UIs.

### Home Page Two-Phase Loading
Phase 1 (parallel): getDealStats, getPracticeStats, getWatchedZipCount, getRecentDeals
Phase 2 (sequential): retirementRisk, acquisitionTargets — inlined Supabase queries run after Phase 1 to avoid concurrency issues on Vercel serverless.

### Client Components (shells)
Page shells (e.g., `deal-flow-shell.tsx`) are `'use client'`. They handle filters, UI state, and refetching via React Query (TanStack). React Query config: 5min staleTime, 30min gcTime, no refetch on window focus.

### Supabase Query Layer
`src/lib/supabase/queries/` contains all query functions organized by table:
- `deals.ts` — getDealStats (paginated, fetches all 2,512 deals), getDealsByFilters, getTopSponsors (paginated), getTopPlatforms (paginated), getRecentDeals, getDistinctSponsors/Platforms/States (all paginated via fetchAllDealColumn helper)
- `practices.ts` — getPracticesByZips, searchPractices, getPracticeStats (high-confidence corporate), getRetirementRiskCount, getAcquisitionTargetCount, getBuyabilityPractices, getPracticeCountsByStatus (per-status count queries), getPracticesWithCoords (chunked + paginated)
- `zip-scores.ts` — getZipScores (deduped by zip_code), getSaturationMetrics
- `watched-zips.ts` — getWatchedZips, getDistinctMetroAreas, getZipsByMetro
- `system.ts` — getDataFreshness, getSourceCoverage (per-source count queries, no row fetching), getCompletenessMetrics
- `ada-benchmarks.ts`, `changes.ts` (paginated NPI query), `practice-changes.ts`

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/deals` | POST | Create new deal (manual entry) |
| `/api/practices/[npi]` | PATCH | Update practice ownership, DSO affiliation |
| `/api/sql-explorer` | POST | Execute SQL queries (admin research, requires execute_sql RPC function) |
| `/api/watched-zips` | GET/POST | Manage watched ZIPs |

## Entity Classification System

The `entity_classification` field on practices provides granular practice-type labels beyond the legacy `ownership_status` field. This is the PRIMARY field for all ownership/consolidation analysis.

### All 11 Entity Classification Values
| Value | Category | Definition |
|-------|----------|-----------|
| `solo_established` | solo | Single-provider practice, operating 20+ years |
| `solo_new` | solo | Single-provider practice, established within last 10 years |
| `solo_inactive` | solo | Single-provider practice, missing phone and website |
| `solo_high_volume` | solo | Single-provider with 5+ employees or $800k+ revenue |
| `family_practice` | group | 2+ providers at same address share a last name |
| `small_group` | group | 2-3 providers at same address, different last names |
| `large_group` | group | 4+ providers at same address, not matching known DSO |
| `dso_regional` | corporate | Shows corporate signals (parent company, shared EIN, franchise field). **NOTE: 92% are phone-only signals — see Tiered Consolidation below.** |
| `dso_national` | corporate | Known national/regional DSO brand (Aspen, Heartland, etc.) |
| `specialist` | other | Specialist practice (Ortho, Endo, Perio, OMS, Pedo) |
| `non_clinical` | other | Dental lab, supply company, billing entity |

### Watched ZIP Coverage (14,027 practices)
All practices in watched ZIPs have entity_classification set (0 null). Distribution:
- solo_established: 3,959 | solo_new: 20 | solo_inactive: 172 | solo_high_volume: 757
- family_practice: 1,243 | small_group: 2,443 | large_group: 1,678
- dso_regional: 1,181 | dso_national: 211
- specialist: 2,346 | non_clinical: 17

### Tiered Consolidation (critical — verified 2026-03-15)

The `dso_regional` classification has a signal quality problem: **92% (1,091 of 1,181)** were triggered by shared phone numbers alone, which often just means multiple dentists at the same address — NOT a DSO.

**High-confidence corporate (~2.3% = 328 practices):**
- dso_national with real DSO brands (199, excludes 12 taxonomy leaks like "General Dentistry")
- dso_regional with shared EIN (67) or generic brand/parent company/franchise (22)
- DSO-owned specialists (40, entity_classification=specialist + ownership_status=dso_affiliated/pe_backed)

**All-signals corporate (~9.9% = 1,392 practices):**
- Above + 1,091 dso_regional classified by shared phone alone (weak signal)

**Frontend shows both tiers:**
- KPI card: "Known Corporate: 2.3%" (high-confidence)
- Below: "Including shared-phone signals: 9.9%" (amber, with explanation)
- Tooltip on KPI explains methodology

**FUTURE TODO:** Reclassify 1,091 phone-only dso_regional back to small_group/large_group. Shared phone should be a FLAG, not enough alone for dso_regional. See memory: project_dso_reclassify.md.

### Classification Helpers (src/lib/constants/entity-classifications.ts)
- `isIndependentClassification(ec)` — true for solo_*, family_practice, small_group, large_group
- `isCorporateClassification(ec)` — true for dso_regional, dso_national
- `classifyPractice(entityClassification, ownershipStatus)` — returns "independent" | "corporate" | "specialist" | "non_clinical" | "unknown" with ownership_status fallback
- `getEntityClassificationLabel(value)` — returns human-readable label
- `DSO_FILTER_KEYWORDS` — taxonomy descriptions that leak into affiliated_dso field (General Dentistry, Oral Surgery, etc.)

### Buyability Categories (computed in buyability-shell.tsx)
Practices are categorized from entity_classification + buyability_score (NOT from notes/verdict extraction):
- **Acquisition Target**: independent with buyability_score >= 50, or any independent practice
- **Dead End**: corporate (dso_regional/dso_national) or non_clinical
- **Job Target**: small_group, large_group, or 5+ employees
- **Specialist**: entity_classification = specialist

### Saturation Metrics (in zip_scores)
- **DLD (Dentist Location Density):** dld_gp_per_10k = GP offices per 10,000 residents. National avg ~6.1.
- **Buyable Practice Ratio:** buyable_practice_ratio = % of GP offices classified as solo_established, solo_inactive, or solo_high_volume.
- **Corporate Share:** corporate_share_pct = % of GP offices classified as dso_regional or dso_national. (includes phone-only signals — see Tiered Consolidation)
- **Market Type:** market_type = computed classification (9 possible values). NULL when metrics_confidence is 'low'.
- **People per GP Door:** people_per_gp_door = population / GP locations.
- **Opportunity Score:** opportunity_score = pre-computed in DB, used by ZIP Score table.

### Confidence System
- **metrics_confidence** on zip_scores: 'high' (coverage >80% AND unknown <20%), 'medium' (>50% AND <40%), 'low' (anything else)
- **market_type_confidence**: 'confirmed' (high), 'provisional' (medium), 'insufficient_data' (low)
- **classification_confidence** on practices: 0-100 score from DSO name/pattern matching

## Critical Rules

### Tiered Consolidation Is Primary
- ALWAYS use high-confidence corporate count for headline KPIs (~2.3%), NOT all-signals (~9.9%)
- High-confidence = dso_national (real brands, not taxonomy leaks) + dso_regional (EIN/brand signals, not phone-only) + DSO-owned specialists
- Show all-signals number as secondary/tooltip with amber color and explanation
- `getPracticeStats()` in practices.ts returns the high-confidence number
- Market Intel page shows both tiers side-by-side with signal explanations

### Entity Classification Is Primary
- ALWAYS use `entity_classification` (11 values) for ownership analysis, NOT `ownership_status` (legacy 3 values)
- Use `classifyPractice()` helper which provides ownership_status fallback for practices missing entity_classification
- Top DSOs charts MUST filter by `isCorporateClassification()` AND exclude `DSO_FILTER_KEYWORDS` from affiliated_dso
- Independent = solo_*, family_practice, small_group, large_group (7 types). Specialist and non_clinical are counted separately.

### Market Intel Transparency
- Consolidation percentages MUST use total practices as denominator (conservative)
- Never use classified_count as denominator for headline KPIs — that inflates numbers
- Labels must say "Known Corporate" not just "Consolidated"
- Show signal quality breakdown (high-confidence vs phone-only)

### Date Display Safety
- `formatDate()` in `lib/utils/formatting.ts` MUST use `timeZone: "UTC"` for date-only strings (`YYYY-MM-DD`). Without it, `new Date("2026-03-01")` in EST shows as "Feb 28" (off-by-one).
- The regex `/^\d{4}-\d{2}-\d{2}$/` detects date-only strings. If Supabase ever returns timestamps, update the regex.
- Recharts small sparkline charts: never use negative left margins (e.g., `left: -20`) — clips Y-axis tick labels into garbled characters. Use `left: 0` minimum.

### Rendering Safety
- DataTable render functions must return primitive values (string | number | null), never objects
- DataTable `toColumnDefs` tries cell-value first, falls back to row.original if result is "—" for non-null values. This prevents React error #31 (objects as children) while supporting both render function signatures.
- DataTable CSV export applies `SimpleColumn.render()` for formatted values. For tanstack `ColumnDef` columns, falls back to raw accessor values. React elements from render functions are coerced to raw values.
- Always handle null/undefined: show "—" in muted color, never "[object Object]" or "null"
- KPI card icons MUST be Lucide JSX components (`<BarChart3 className="h-4 w-4" />`), never strings

### Supabase Query Safety
- Supabase returns max 1000 rows per query — ALWAYS paginate with `.range()` for tables that could exceed this
- For large result sets, chunk ZIP arrays (100 ZIPs per chunk) and paginate within each chunk (1000 rows per page)
- `getDealStats()` paginates through all 2,512 deals (3 pages of 1000)
- `getSourceCoverage()` uses per-source count queries (no row fetching)
- `getPracticeCountsByStatus()` uses per-status count queries (no row fetching)

### TypeScript
- Run `npm run build` after every change to verify TypeScript compilation
- All Supabase query functions accept a `SupabaseClient` parameter
- ZipScore type has 40+ fields matching the full Supabase zip_scores table (including metro_area, opportunity_score, state, etc.)

## Per-Page Components

| Page | Shell File | Key Components |
|------|-----------|----------------|
| Home | `_components/home-shell.tsx` | Nav cards, recent deals, freshness bar |
| Launchpad | `launchpad/_components/launchpad-shell.tsx` | scope-selector, track-switcher, launchpad-kpi-strip, track-list, track-list-card, practice-dossier |
| Warroom | `warroom/_components/warroom-shell.tsx` | scope-selector, intent-bar, sitrep-kpi-strip, living-map, briefing-pane, target-list, dossier-drawer, zip-dossier-drawer, profile-mode-panel, investigate-mode-panel, pinboard-tray, keyboard-shortcuts-overlay |
| Deal Flow | `deal-flow/_components/deal-flow-shell.tsx` | deal-kpis, deal-volume-timeline, specialty-charts, sponsor-platform-charts, state-choropleth, deals-table |
| Market Intel | `market-intel/_components/market-intel-shell.tsx` | consolidation-map, zip-score-table, city-practice-tree, dso-penetration-table, warroom-cross-link |
| Buyability | `buyability/_components/buyability-shell.tsx` | Data-driven categorization, 25-row paginated table with category badges |
| Job Market | `job-market/_components/job-market-shell.tsx` | living-location-selector, practice-density-map, market-overview-charts, practice-directory, opportunity-signals, ownership-landscape, market-analytics, practice-detail-drawer |
| Intelligence | `intelligence/_components/intelligence-shell.tsx` | ZIP intel table, practice dossier table, expandable 10-signal panels, warroom-cross-link |
| Research | `research/_components/research-shell.tsx` | sponsor-profile, platform-profile, state-deep-dive, sql-explorer |
| System | `system/_components/system-shell.tsx` | freshness-indicators, data-coverage, completeness-bars, pipeline-log-viewer, manual-entry-forms |

### Key Component Props
- `MarketIntelShellProps.classificationCounts`: `{ total, corporate, corporateHighConf, independent, unknown }` — includes high-confidence tier
- `MarketIntelShellProps.entityCounts`: `Record<string, number>` — per-entity-classification practice counts for Ownership tab (11 parallel queries)
- `OwnershipLandscapeProps` includes `watchedZips: WatchedZip[]`
- `KpiCardProps.icon` accepts `React.ReactNode` (Lucide JSX) — string rendering still works but is discouraged
- `KpiCardProps.tooltip` accepts string for hover tooltip (used for tiered consolidation explanation)

## Data Pipeline (Separate Repo)

The Python scraper pipeline lives in the parent repo (`dental-pe-tracker/scrapers/`). It runs weekly via cron:

1. Backup DB → 2. PESP scraper → 3. GDN scraper → 4. PitchBook importer → 5. ADSO scraper → 6. ADA HPI downloader → 7. DSO classifier → 8. Merge & score → 9. Sync to Supabase

Step 9 (`sync_to_supabase.py`) pushes changes incrementally from local SQLite to Supabase Postgres. Three sync strategies: incremental_updated_at (practices), incremental_id (deals, changes), full_replace (zip_scores, watched_zips, etc.).

Monthly NPPES refresh (first Sunday 6am): downloads federal provider data updates.

## Bug Fixes Applied (2026-03-15 Full Audit) — Do Not Regress

| File | Fix |
|------|-----|
| `practices.ts` | `getRetirementRiskCount()` now filters by watched ZIPs + `year_established < 1995` + 7 independent EC types (was missing ZIP filter → returned 0) |
| `practices.ts` | `getAcquisitionTargetCount()` now filters by watched ZIPs + `buyability_score >= 50` (was missing ZIP filter → returned 0) |
| `practices.ts` | `getPracticeStats()` returns full `PracticeStats` with tiered corporate counts: `corporate` (all-signals 1,392), `corporateHighConf` (262), `independent`, `unknown`, `enriched` |
| `practices.ts` | `getPracticeCountsByStatus()` uses entity_classification as primary with ownership_status fallback (was purely ownership_status-based) |
| `page.tsx` (Home) | Calls fixed `getRetirementRiskCount()` and `getAcquisitionTargetCount()` instead of inline queries; fetches enrichment count |
| `home-shell.tsx` | Defensive `%` suffix on consolidatedPct; enrichment bar shows `2,992 enriched (0.7%)` |
| `kpi-card.tsx` | Added `subtitle?: React.ReactNode` prop for tiered consolidation display |
| `job-market-shell.tsx` | Tiered consolidation KPI: "High-Confidence Corporate: 1.9%" primary, "All detected signals: 9.9%" secondary (amber), "Industry estimate: 25-35%" subtitle |
| `entity-classifications.ts` | Added `INDEPENDENT_CLASSIFICATIONS`, `DSO_NATIONAL_TAXONOMY_LEAKS`, `DSO_REGIONAL_STRONG_SIGNAL_FILTER` constants |
| `zip-score-table.tsx` | Fixed `fmtPct` helper for percentage columns; fixed confidence/opportunity_score renderers to handle both cell-value and row-object patterns |
| `sql-presets.ts` | "ZIP ownership" preset uses entity_classification; "High-Vol Solos" removes redundant ownership_status filter |
| `system.ts` | "Ownership Classified" completeness metric counts entity_classification (primary) + ownership_status fallback |
| `types.ts` + `types/index.ts` | Added `PracticeStats` interface; added `enrichedCount` to `HomeSummary` |

## Bug Fixes Applied (2026-04-05 Market Intel Audit) — Do Not Regress

| File | Fix |
|------|-----|
| `consolidation-map.tsx` | XSS: Added `escapeHtml()` on all interpolated props in `.setHTML()` tooltip |
| `consolidation-map.tsx` | Tooltip color threshold changed from binary `>20` to 3-tier `>=30`/`>=15` matching table |
| `data-table.tsx` | CSV export now applies `SimpleColumn.render()` functions instead of dumping raw `row.original` |
| `city-practice-tree.tsx` | PE/DSO dedup: `pe_backed` practices excluded from DSO filter (PE takes priority) |
| `page.tsx` (market-intel) | Added 11 parallel entity_classification count queries for Ownership tab |
| `market-intel-shell.tsx` | Ownership tab shows per-classification practice counts; ecBreakdown includes `count` field |
| `market-intel-shell.tsx` | Metro-filtered KPI uses `independent_count` from zip_scores (was absorbing unknown into independent) |
| `market-intel-shell.tsx` | Metro-filtered high-conf KPI uses `corporate_highconf_count` from zip_scores (was hardcoded 0) |
| `use-url-filters.ts` | Array filter values trimmed before filtering (`"a, b"` → `["a","b"]` not `["a"," b"]`) |
| `database.py` | Added `corporate_highconf_count` column to ZipScore model |
| `merge_and_score.py` | Computes high-conf corporate count (real DSO brands + EIN/strong dso_regional + DSO-owned specialists) |
| `types/index.ts` + `supabase/types.ts` | Added `corporate_highconf_count: number \| null` to ZipScore |
| Deleted | `market-intel/saturation-table.tsx`, `ada-benchmarks.tsx`, `recent-changes.tsx` (0 imports), `constants/metro-centers.ts` (stale, 0 imports) |

## Bug Fixes Applied (2026-04-22 Pipeline Audit) — Do Not Regress

| File | Fix |
|------|-----|
| `system.ts::getSourceCoverage()` | Added `dso_locations.scraped_at` query exposed under `"ADSO Scraper"` key — System page's Data Source Coverage panel previously showed "--" for ADSO |
| `system.ts::getSourceCoverage()` | Swapped `ada_hpi_benchmarks.updated_at` → `ada_hpi_benchmarks.created_at` for "ADA HPI" key. All 918 rows have `updated_at=NULL` because `ada_hpi_importer.py` only sets `created_at`; ordering by `updated_at DESC` returned NULL → UI showed "--" |
| `system.ts::getSourceCoverage()` | Fixed `knownTotal` to use counted scalars (nppesCount + dataAxleCount + manualCount + nullCount) instead of summing `.count` across the result map — the map got polluted with `count: 0` entries once we added freshness-only keys (ADSO Scraper, ADA HPI) |
| `system.ts::getSourceCoverage()` | Added `dso_locations` + `ada_hpi_benchmarks` head-count queries to the Promise.all and wired `adsoCount`/`adaCount` into `result["ADSO Scraper"].count` and `result["ADA HPI"].count`. Previously hardcoded `count: 0` on those two keys, so the Data Source Coverage panel rendered 0 rows for both even though 92 DSO locations and 918 ADA benchmark rows are live |

Paired with `scrapers/sync_to_supabase.py` per-row savepoint fix so deals with `uix_deal_no_dup` IntegrityError hits don't abort the whole batch transaction. Before this pair of fixes, a single duplicate in the deals sync would roll back every queued row — so recent deal scrapes never reached Supabase.

## Warroom Ship Log (2026-04-24) — Do Not Regress

Phases 0-7 of the Chicagoland god-mode Warroom are all shipped. Earlier rounds (Phase 0 scaffold, Rounds 1-4 wiring) landed in six commits between `13b129b` and `62e7651`. This ship closes the remaining phases:

| Area | Delivered |
|------|-----------|
| Scope model | 12 scope IDs wired end-to-end (US, chicagoland, 7 subzones, 3 saved presets); `normalizeWarroomDataScope()` maps saved presets to ZIP arrays |
| Hunt mode | Intent-driven filtering, tier floors, flag badges, enrichment-aware ranking |
| Profile mode | New `profile-mode-panel.tsx` — pinboard workspace for comparing 2-6 targets side-by-side |
| Investigate mode | New `investigate-mode-panel.tsx` — signal co-occurrence analysis + compound-flag list (flagCount ≥ 2) + stealth DSO cluster / intel-disagreement sample cards |
| ZIP dossier | New `zip-dossier-drawer.tsx` — separate drawer for ZIP selections (saturation, ownership mix, top practices) |
| Pinboard | `pinboard-tray.tsx` bottom tray shows pinned targets across sessions; persisted in URL |
| Keyboard shortcuts | New `keyboard-shortcuts-overlay.tsx` — `?`, `⌘K`/`/`, `1-4`, `R`, `P`, `Esc`. Single-key guards for typing contexts |
| Legacy cross-links | New `warroom-cross-link.tsx` banner rendered on `/market-intel` and `/intelligence` with preset `hrefSuffix` deep-links |
| Geo helpers | New `src/lib/warroom/geo.ts` — subzone ZIP lookups + bounding boxes |

Do not regress:
- `use-warroom-state.ts` MUST keep URL-param sync for all 7 state dimensions (mode, lens, scope, filters, selectedEntity, pins, intent) — breaks share links otherwise
- Single-key shortcuts MUST check `isTypingTarget()` before firing — typing in forms should never switch modes
- `normalizeWarroomDataScope()` MUST return concrete ZIP arrays for saved presets — downstream `getSitrepBundle()` assumes no preset IDs leak through
- Cross-link banners are soft entry points — don't replace them with hard redirects; legacy pages retain their functionality
- Investigate mode flag co-occurrence is computed client-side from `rankedTargets.flags` — server-side aggregation isn't needed until target count exceeds ~500

## Launchpad Ship Log (2026-04-24) — Do Not Regress

Phase 1 MVP of Launchpad (first-job finder for new dental grads) shipped on 2026-04-24.

| Area | Delivered |
|------|-----------|
| Foundation | `src/lib/launchpad/{scope,dso-tiers,signals,ranking}.ts` — 4 scope options, 16 curated DSO entries, 20 signal definitions, TRACK_MULTIPLIERS scoring engine |
| Data layer | `src/lib/supabase/queries/launchpad.ts::getLaunchpadBundle()` — fetches practices/intel/zip_scores/watched_zips/recent_deals in parallel, runs rankTargets, returns LaunchpadBundle |
| Shell | `src/app/launchpad/page.tsx` (force-dynamic Server Component) + `_components/launchpad-shell.tsx` orchestrator |
| Hooks | `src/lib/hooks/use-launchpad-state.ts` (URL-synced scope/track/selectedNpi/pinnedNpis) + `use-launchpad-data.ts` (React Query) |
| Top bar | `scope-selector.tsx` (4 locations), `track-switcher.tsx` (All/Succession/High-Volume/DSO), `launchpad-kpi-strip.tsx` (6 KPIs), `track-list.tsx` + `track-list-card.tsx` |
| Dossier | `practice-dossier.tsx` — 5-tab drawer (Snapshot / Compensation / Mentorship / Red Flags / Interview Prep) |
| Sidebar | Added Launchpad to OVERVIEW group between Dashboard and Warroom with `Rocket` icon |

### Scoring contract (do not regress)

- Base score: 50. Each active signal: `baseWeight × TRACK_MULTIPLIERS[track][signalId]`. Clamp 0-100.
- Tier thresholds: best_fit 80-100, strong 65-79, maybe 50-64, low 35-49, avoid 0-34.
- Confidence cap at 70 applied when `intel == null` OR `classification_confidence < 40` — only trims scores above 70, never boosts low scores.
- Three track scores computed for every practice; "All" track picks max, specific tracks use their own score.
- DSO tier list is hand-curated in `dso-tiers.ts` with citations — changing tier = material change, update rationale + citations together.
- Avoid-tier DSOs: Aspen, Sage, Western, Smile Brands, Risas. Tier 1: Mortenson, MB2, Dental Associates WI. See full list in `dso-tiers.ts`.

### Phase 2 shipped (2026-04-24)

| Area | Delivered |
|------|-----------|
| Living Map | `living-map.tsx` — Mapbox hex density (practices view) + ZIP choropleth (ZIPs view), lens toggle, selection-aware. Optional `onOpenZipDossier` prop — omitted by shell so map click sets `selectedZip` and the ZIP dossier auto-opens. |
| ZIP dossier | `zip-dossier-drawer.tsx` — three-tab Sheet (Overview saturation, Top targets, PE activity). Shell auto-opens whenever `selectedZip` flips truthy; `onClose` clears selectedZip. |
| AI narrative | `api/launchpad/narrative/route.ts` (Node runtime, `force-dynamic`) calls Claude Haiku 4.5 (`claude-haiku-4-5-20251001`, 500 max_tokens, 0.4 temp) with a dental-career-advisor system prompt. `use-launchpad-narrative.ts` wraps it in useMutation and caches per `(npi, track)` via `queryClient.setQueryData`. `narrative-card.tsx` inlined into Snapshot tab: generate-on-demand (not auto-fire), regenerate (clears cache via `removeQueries`), copy to clipboard. 503 + actionable message when `ANTHROPIC_API_KEY` missing. |
| Red-flag matrix | `red-flag-patterns.tsx` — collapsible section between KPI strip and list. Computes marginals + pairwise co-occurrence across 8 warning signals (dso_avoid, family_dynasty, ghost_practice, recent_acquisition, associate_saturated, medicaid_mill, non_compete_radius, pe_recap_volatility). Heatmap intensity by co-occurrence count. Compound-red-flag sidebar lists top 12 practices with 2+ warnings, click opens dossier. |
| Pinboard | `pinboard-panel.tsx` — horizontal strip between KPI strip and red-flags. Only renders when `pinnedNpis.length > 0`. Hover-X unpin, Clear all; gracefully handles out-of-scope pins. Pin toggle added to `track-list-card.tsx` (next to score) and `practice-dossier.tsx` header. |
| Saved searches | `saved-searches-menu.tsx` in top bar — dropdown with count badge, Save-current-view input, saved list (scope + track + pin-count badges + delete), 12-entry cap. `use-launchpad-saved-searches.ts` backs it via localStorage (`dental-pe-launchpad-saved-searches-v0`) with coerce/sanitize validation. Loading a view commits `{scope, track, pinnedNpis}` via `loadSavedSearch` state helper. |

### Do not regress (Phase 2)

- Pin click inside `track-list-card.tsx` MUST call `e.stopPropagation()` — otherwise toggling a pin also opens the dossier.
- Narrative endpoint MUST return 503 (not 500) when `ANTHROPIC_API_KEY` missing; the UI error state surfaces the message verbatim.
- `narrativeCacheKey(npi, track)` is the single source of truth for narrative cache reads and writes — don't hand-roll new query keys.
- Saved searches and pinboard are both **per-device** (localStorage) — don't upgrade to Supabase without planning user auth.
- `loadSavedSearch` MUST clear `selectedNpi` and `selectedZip` when committing — otherwise a stale drawer leaks across views.
- `PinboardPanel` MUST render nothing when pin list is empty (don't show an empty "no pins" placeholder above the red-flag matrix).
- Red-flag heatmap uses `presentSignals` (only rendered warnings with at least one hit), not the full 8-item `WARNING_SIGNALS` set — keeps matrix dense when signals are rare.

## Development

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # TypeScript check + production build
npm start       # Production server
npm run lint    # ESLint
```
