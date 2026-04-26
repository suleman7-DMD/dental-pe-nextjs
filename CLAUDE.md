# Dental PE Intelligence Platform — Claude Code Guide

## What This Project Is

A Next.js 16 + Supabase + Vercel web application that tracks private equity consolidation in US dentistry. It connects to a Supabase Postgres database populated by a Python scraper pipeline, visualizes 400k+ dental practices, 2,895 PE deals, and 290 scored markets. The frontend provides 9 pages of market intelligence — including the **Warroom** god-mode command surface and **Launchpad** for first-job finding — with maps, charts, data tables, and deep-dive research tools.

**Live app:** https://dental-pe-nextjs.vercel.app
**Data pipeline repo:** github.com/suleman7-DMD/dental-pe-tracker (Python scrapers write to SQLite, sync to Supabase)
**Frontend repo:** github.com/suleman7-DMD/dental-pe-nextjs

## Architecture

```
src/
  app/                    Next.js App Router — 9 page routes + API routes
    _components/          Home page shell
    warroom/              Chicagoland command surface (Hunt + Investigate, 4 lenses, 11 scopes)
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

- **practices**: 402,004 rows (per SQLite live 2026-04-25). NPI (PK), practice_name, doing_business_as, address, city, state, zip, phone, entity_type, taxonomy_code, ownership_status, entity_classification, classification_reasoning, affiliated_dso, affiliated_pe_sponsor, buyability_score, classification_confidence, data_source, latitude, longitude, parent_company, ein, franchise_name, website, year_established, employee_count, estimated_revenue, num_providers, location_type, data_axle_import_date
- **deals**: 2,895 rows. PE dental deals from PESP, GDN, PitchBook (per Supabase live 2026-04-25; SQLite has 2,861 — a +34 surplus in Supabase from prior scraper experiments — see audit §15 #11)
- **practice_changes**: 5,100+ rows. Change log for name/address/ownership changes (acquisition detection).
- **zip_scores**: 290 rows. Per-ZIP consolidation stats with 40+ columns including saturation metrics (dld_gp_per_10k, buyable_practice_ratio, corporate_share_pct, corporate_highconf_count, market_type, metrics_confidence, opportunity_score, etc.)
- **watched_zips**: 290 ZIPs (269 Chicagoland + 21 Boston). Includes population, median_household_income.
- **dso_locations**: 408 scraped DSO office locations from ADSO websites.
- **ada_hpi_benchmarks**: 918 rows. State-level DSO affiliation rates by career stage (2022-2024).
- **pe_sponsors**: 33 known PE sponsor profiles.
- **platforms**: 69 known DSO platform profiles.

### Current Data Stats
- 402,004 practices (14,053 NPI rows in watched ZIPs, all with entity_classification — live 2026-04-25)
- **4,889 GP clinic locations in watched ZIPs** (CHI 4,575 + BOS 314 — `SUM(zip_scores.total_gp_locations)`, post-`dc18d24` ULTRA-FIX dedup classifier rewrite, verified live Supabase 2026-04-26) — the location-deduped denominator after collapsing NPI-1 + NPI-2 + suite-variant rows at the same physical building. ~2.7× smaller than the raw NPI count. Surfaced as a subtitle on Home + Job Market "Total Practices" KPI cards (Phase A, 2026-04-25, commit `732894f`). **Pre-`dc18d24` baseline was 5,265** — the dedup pipeline collapsed an additional ~376 stale residential/duplicate rows out of zip_scores; quote 4,889 in all current docs.
- 2,895 deals (coverage Oct 2020 – 2026-03-02; per Supabase live 2026-04-25). GDN's April roundup was 404 as of 2026-04-25, so 03-02 is current per source. SQLite has 2,861 (+34 ghost rows in Supabase, audit §15 #11).
- 2,992 Data Axle enriched practices (with lat/lon, revenue, employees, year established)
- 290 scored ZIPs (279 with saturation metrics)
- 226 retirement risk practices (independent, established before 1995, in watched ZIPs)
- 34 buyability targets (buyability_score >= 50, in watched ZIPs)
- **322 corporate (~2.3%) post-Phase B (2026-04-25): 213 dso_national + 109 dso_regional**. Down from 1,392 (-1,072) after the phone-only `dso_regional` signal was demoted in `dso_classifier.py` Pass 3. The reclassified rows landed in `small_group` / `large_group` / `family_practice`. Phone-sharing is now a FLAG (`shared_phone_flag` in `classification_reasoning`), not a sole classification trigger.

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
| `/warroom` | **Warroom** | Chicagoland command surface. 2 modes (Hunt / Investigate), 4 lenses (consolidation, density, buyability, retirement), 11 scopes (chicagoland, 7 subzones, 3 saved presets). Always-visible Sitrep KPI strip. Intent bar (⌘K), Living Map, ranked target list, ZIP + practice dossier drawers, pinboard tray, signal flag overlays, keyboard shortcuts overlay (?), URL-synced state. |
| `/deal-flow` | **Deal Flow** | 2,895 PE deals — KPIs, monthly stacked bar timeline, top 15 sponsors/platforms, state choropleth, searchable deals table with CSV. All queries paginated (no 1000-row truncation). |
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
| `mode` | `hunt` \| `investigate` | Top-level task (prospecting vs. pattern analysis). Sitrep KPI strip is always visible above the mode panel. |
| `lens` | `consolidation` \| `density` \| `buyability` \| `retirement` | What to color/rank by |
| `scope` | `chicagoland` \| `chicago_west_loop` \| `chicago_south_loop` \| `woodridge` \| `bolingbrook` \| `oak_park` \| `evanston` \| `naperville` \| `saved_high_risk` \| `saved_retirement` \| `saved_whitespace` | Which ZIP set to load |

### Library layer (`src/lib/warroom/`)

| File | Purpose |
|------|---------|
| `mode.ts` | `WARROOM_MODES` (hunt, investigate) + `WARROOM_LENSES` (4 lenses) constants with labels/icons |
| `scope.ts` | 11 scope definitions (chicagoland, 7 subzones, 3 saved) + `normalizeWarroomDataScope()` |
| `geo.ts` | Geographic helpers — subzone ZIP lookups, bounding boxes |
| `signals.ts` | `WarroomPracticeRecord`, `WarroomSitrepBundle`, `RankedTarget` types + signal flag definitions |
| `data.ts` | `getSitrepBundle()` — batch-fetches practices/zip_scores/signals by scope, computes `topSignals.stealthClusters` |
| `intent.ts` | `buildIntentFromFilter()`, `PRACTICE_FLAG_LABELS`, `ZIP_FLAG_LABELS` — natural-language intent parsing |
| `ranking.ts` | `rankTargets()` — composite scoring across lens, flag count, enrichment, buyability |
| `briefing.ts` | `buildBriefingItems()` — contextual alerts + suggested actions per scope |

### UI layer (`src/app/warroom/_components/`)

| Component | Role |
|-----------|------|
| `warroom-shell.tsx` | Orchestrator — holds state hook, renders conditional mode panels + drawers, wires keyboard shortcuts |
| `scope-selector.tsx` | Scope dropdown with 11 options grouped into Chicagoland / Subzones / Saved |
| `intent-bar.tsx` | ⌘K-focusable intent input — parses natural language into filter state |
| `sitrep-kpi-strip.tsx` | Persistent KPI strip (practices, corporate %, retirement risk, etc.) above mode panels |
| `living-map.tsx` | Mapbox ZIP choropleth colored by active lens with signal flag overlays |
| `briefing-rail.tsx` | Scope-specific alerts + suggested intent chips |
| `target-list.tsx` | Ranked practices in Hunt mode with flag badges |
| `dossier-drawer.tsx` | Practice deep dive — signals, flags, intel dossier if present, action buttons |
| `zip-dossier-drawer.tsx` | ZIP deep dive — saturation, ownership mix, top practices, qualitative intel |
| `investigate-mode-panel.tsx` | Signal co-occurrence analysis + compound-flag target list + stealth DSO sample card |
| `pinboard-tray.tsx` | Bottom tray showing pinned targets across sessions |
| `keyboard-shortcuts-overlay.tsx` | `?`-triggered shadcn Dialog listing all shortcuts |

### Signal flags (8 practice + 1 ZIP after triage)

Computed at load time in `data.ts` and merged into `signals` array on each practice record. Used for rank boosts, drawer badges, and investigate-mode clustering.

Practice-level: `stealth_dso_flag`, `phantom_inventory_flag`, `revenue_default_flag`, `family_dynasty_flag`, `micro_cluster_flag`, `retirement_combo_flag`, `last_change_90d_flag`, `high_peer_retirement_flag`.

ZIP-level: `zip_ada_benchmark_gap_flag` (only). Decorative ZIP flags (white_space, compound_demand, mirror_pair, contested_zone) and the practice-level `intel_quant_disagreement_flag` / `high_peer_buyability_flag` were cut in the Apr 2026 product triage.

### Keyboard shortcuts

`?` toggles the overlay. `⌘K` / `/` focuses the intent bar. `1` switches to Hunt, `2` switches to Investigate (Sitrep and Profile modes were cut entirely; the two remaining modes were renumbered to `1`/`2` — the cheat-sheet overlay was previously stale showing `2`/`4`, fixed 2026-04-25 audit §15 #24). `R` resets filters + intent + selection. `P` toggles pin on the selected target. `V` toggles reviewed. `[` / `]` jump between targets in the dossier. `Esc` closes drawers / overlays. Single-key shortcuts are suppressed when focus is in an `<input>` / `<textarea>` / contenteditable.

### Cross-links from legacy pages

`/market-intel` and `/intelligence` render a `WarroomCrossLink` banner (`src/components/layout/warroom-cross-link.tsx`) with preset `hrefSuffix` — e.g., Market Intel → `?mode=hunt&lens=consolidation`, Intelligence → `?mode=investigate&lens=consolidation`. Legacy pages retain their full deep-dive functionality.

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
- `deals.ts` — getDealStats (paginated, fetches all 2,895 deals), getDealsByFilters, getTopSponsors (paginated), getTopPlatforms (paginated), getRecentDeals, getDistinctSponsors/Platforms/States (all paginated via fetchAllDealColumn helper)
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
| `dso_regional` | corporate | Shows STRONG corporate signals (parent company, shared EIN across 2+ ZIPs, real franchise, branch+parent_company). **Post-Phase B (2026-04-25): phone-sharing is no longer a sole signal — it's a flag in `classification_reasoning` (`shared_phone_flag`). Watched-ZIP count dropped from 1,181 → 109 (-91%).** |
| `dso_national` | corporate | Known national/regional DSO brand (Aspen, Heartland, etc.) |
| `specialist` | other | Specialist practice (Ortho, Endo, Perio, OMS, Pedo) |
| `non_clinical` | other | Dental lab, supply company, billing entity |

### Watched ZIP Coverage (14,053 NPI rows / 4,889 GP clinic locations — post-`dc18d24` 2026-04-26)
All practices in watched ZIPs have entity_classification set (0 null). Distribution:
- solo_established: 3,575 | solo_new: 17 | solo_inactive: 170 | solo_high_volume: 709
- family_practice: 1,708 | small_group: 2,727 | large_group: 2,456
- **dso_regional: 109 | dso_national: 213**
- specialist: 2,353 | non_clinical: 16

**Pre-Phase B baseline (for regression detection):** dso_regional was 1,181 (-91% drop). The classifier rewrite (commit `dc18d24` for the location-dedup pass + classifier audit `2026-04-25` for Phase B demotion of phone-only signal) reclassified ~1,072 rows into small_group / large_group / family_practice — see `NPI_VS_PRACTICE_AUDIT.md` Appendix C in the parent repo.

### Tiered Consolidation (Phase B resolved 2026-04-25)

**Status: RESOLVED.** The pre-Phase B problem — 92% (1,091 of 1,181) of `dso_regional` classifications were triggered by shared phone numbers alone — has been fixed in `scrapers/dso_classifier.py` Pass 3. Phone-sharing is now a flag (`shared_phone_flag` in `classification_reasoning`), not a sole classification trigger.

**Headline corporate count (~2.3% = ~322 practices):**
- dso_national with real DSO brands (213, includes some taxonomy leaks — frontend filter still excludes those)
- dso_regional with STRONG signals (109) — parent_company, EIN-shared-across-2+-zips, real franchise, branch+parent_company
- DSO-owned specialists (≈40, entity_classification=specialist + ownership_status=dso_affiliated/pe_backed)

**`getPracticeStats()` tier wiring still applies:**
- `corporateHighConf`: high-confidence count for headline KPI
- `corporate`: all dso_regional + dso_national (after Phase B these numbers are nearly identical — the gap collapsed)
- KPI card "Known Corporate" subtitle now shows the convergence

**Backwards-compat note:** Some legacy KPI strings still reference "1.9% / 9.9%" — those numbers were the pre-Phase B all-signals tier. After this sync lands in Supabase, headline corporate % should drop to ~2.3% across Home, Market Intel, and Job Market.

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
- **Corporate Share:** corporate_share_pct = % of GP offices classified as dso_regional or dso_national. Post-Phase B (2026-04-25), phone-only signals no longer inflate this — see Tiered Consolidation.
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
- `getDealStats()` paginates through all 2,895 deals (3 pages of 1000)
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

## Bug Fixes Applied (2026-04-26 Cross-Page KPI Audit) — Do Not Regress

User reported "each page is showing different numbers for the same chicagoland zip" across Home, Job Market, Market Intel, Warroom, Launchpad, and Buyability. Root cause: each surface defined "scope" differently AND several headlines counted raw NPI rows instead of physical clinics. Five surgical fixes restore agreement; commit `0e67fc5`.

| File | Fix |
|------|-----|
| `src/app/job-market/page.tsx` | `defaultLocationKey` now resolves to `"All Chicagoland"` (269 ZIPs) via explicit lookup. Was `Object.keys(LIVING_LOCATIONS)[0]` which silently returned `"West Loop / South Loop"` (142 ZIPs) — Job Market's KPIs disagreed with every other "Chicagoland" surface |
| `src/lib/supabase/queries/practices.ts::getBuyabilityPractices` | New optional `zips?: string[]` parameter. When provided, scopes the query via `.in("zip", zips)`. Backward compatible — omitting `zips` preserves the global behavior |
| `src/app/buyability/page.tsx` | Now fetches `getWatchedZips()` and passes the ZIP set into `getBuyabilityPractices`. Was pulling a global 500-row sample that ignored scope entirely |
| `src/lib/launchpad/signals.ts` | `LaunchpadSummary` interface gains `totalGpLocations: number \| null` — location-deduped GP count (sum of `zip_scores.total_gp_locations` across scope ZIPs) |
| `src/lib/supabase/queries/launchpad.ts` | `getLaunchpadBundle` now sums `total_gp_locations` from the existing `zipScores` fetch — no extra Supabase query needed. `null` when no scope ZIPs have a `zip_scores` row |
| `src/app/launchpad/_components/launchpad-kpi-strip.tsx` | "GP clinics in scope" KPI displays `totalGpLocations` as the headline value with `totalPracticesInScope` as a subtitle ("X NPI rows"). Was showing the NPI count as the headline (~11,894 for All Chicagoland — ~2.7× the actual ~4,575 CHI / 4,889 combined CHI+BOS clinics) |
| `src/lib/supabase/queries/warroom.ts::getScopedPractices` | Wired the previously-orphaned `dedupPracticesByLocation()` helper into the fetch path (after polygon filter, before sort/slice). Hunt mode was showing 14k NPI rows for Chicagoland while the Sitrep KPI strip (sourced from `practice_locations`) showed ~5.5k — same prospect appeared 2-3× in the target list |

### Headline-denominator policy (do not regress)

All "practice count" headline KPIs MUST use the location-deduped count as the primary number. Acceptable sources:
- `zip_scores.total_gp_locations` (summed across scope ZIPs) — cheapest, used by Home / Market Intel / Job Market / Launchpad
- `practice_locations` count query — used by Warroom Sitrep + Job Market server KPIs
- `dedupPracticesByLocation(rows)` — used in-memory by Warroom Hunt list AFTER fetching raw `practices` rows

The raw NPI row count belongs in subtitles only (e.g., "4,889 GP clinics · 14,053 NPI rows"). Phase A pattern from `732894f` is the model — read that commit if extending this to a new surface.

### Scope-default policy (do not regress)

Any page surfacing a Chicagoland headline KPI MUST resolve "Chicagoland" to the canonical 269-ZIP set. Acceptable resolutions:
- `getWatchedZips()` filtered to `state IN ('IL')` (Home + Buyability)
- `LIVING_LOCATIONS["All Chicagoland"].commutable_zips` (Job Market — explicit named lookup, NEVER `Object.keys(...)[0]`)
- `LAUNCHPAD_SCOPES["chicagoland"]` resolved through `resolveLaunchpadZipCodes()` (Launchpad)
- `WARROOM_SCOPES["chicagoland"]` (Warroom default scope)

Single-subzone defaults (West Loop, Naperville, Bolingbrook, etc.) are valid for explicit user selection but MUST NOT be the page-load default.

### Live deploy verification (2026-04-26 04:45 UTC, commit `9e3375c`)

Three commits chained on `main` to land the audit:
- `0e67fc5` — primary KPI consistency fixes (7 files)
- `40f7056` — CLAUDE.md regression rules
- `9e3375c` — Warroom signal layer chunked at 50 ZIPs to dodge Supabase 8s `statement_timeout`

Vercel deploy `dpl_nSdvkjofARjt9ukxYbktq5dKTe4N` is live on https://dental-pe-nextjs.vercel.app — production alias updated. All 6 affected pages return 200. Live numeric verification:

| Page | Headline | NPI count | Verified value |
|------|----------|----------:|---------------:|
| Home (290 watched ZIPs) | 4,889 GP clinics | 14,053 | 254 retirement risk · 22 acquisition targets · 2,861 deals |
| Job Market (269 ZIPs default) | 14,053 NPIs | 14,053 | All Chicagoland resolved correctly (was 142-ZIP West Loop pre-fix) |
| Market Intel (269 ZIPs) | 14,053 NPIs | 14,053 | matches Job Market |
| Warroom Hunt (269 ZIPs) | **5,491 location-deduped** | 14,053 | dedup helper now wired in — was 14k pre-fix |
| Warroom Sitrep | `signalsAvailable: true` | n/a | empty `warnings: []` — `practice_signals` chunked-50 dodge worked |
| Launchpad (269 Chicagoland, excl specialists) | 4,575 GP clinics | 11,894 | 1,380 best-fit · 104 hiring (was 0/0 in user complaint) |
| Buyability (watched ZIPs) | 308 acq targets · 87 dead ends · 531 jobs · 74 specialists | 1,000 (page cap) | scoped to watched ZIPs (was global 500-row sample pre-fix) |

The variance between 4,575 (Launchpad) ↔ 4,889 (Home) ↔ 5,491 (Warroom) is expected: Home includes Boston (290 ZIPs), Launchpad excludes specialists/non-clinical, Warroom counts unique-by-(address,zip) with no taxonomy filter. All three are honest denominators for their respective scopes.

## NPI vs Practice Conflation Fix (2026-04-25) — Do Not Regress

A 3-part fix for the long-running NPI-row-as-practice vs physical-clinic-location confusion. NPPES emits 1 row per provider (NPI-1) AND 1 row per organization (NPI-2) at the same address — counting NPI rows as "practices" was inflating the watched-ZIP total ~2.7× (14,053 NPIs vs 4,889 GP clinic locations post-`dc18d24` / 5,265 pre-dedup). Compounding this, the legacy `dso_classifier.py` Pass 3 was over-counting providers at shared phone numbers, classifying ~1,072 small/large/family groups as `dso_regional` purely because they shared a switchboard.

### Foundational — Location-as-practice schema (parallel agent, commit `dc18d24`)

- New `practice_locations` SQLite table — one row per (normalized address, ZIP) tuple. Joins NPI rows back via `practice_to_location_xref`.
- Classifier Pass 3 (`classify_entity_types()` in `scrapers/dso_classifier.py`) now counts DISTINCT providers per location via `practice_locations`, EXCLUDING NPI-2 organization rows. The provider count is the foundation for `family_practice` / `small_group` / `large_group` thresholds.
- `merge_and_score.py::compute_saturation_metrics()` now reads `total_gp_locations` from `practice_locations`, not from `practices` row counts. The location-deduped count is the honest "how many GP clinics" denominator.

### Phase A — Surface location-deduped count in Next.js (this commit `732894f`)

| File | Change |
|------|--------|
| `src/lib/supabase/queries/practices.ts` | `getPracticeStats()` adds a `zip_scores` sub-query summing `total_gp_locations` for watched ZIPs and returns `totalGpLocations` on the result |
| `src/lib/supabase/types.ts` | `PracticeStats` interface gets `totalGpLocations?: number` with docstring explaining the location-dedup semantics |
| `src/lib/types/index.ts` | `PracticeStats` + `HomeSummary` interfaces both gain `totalGpLocations?: number` |
| `src/app/page.tsx` | `summary.totalGpLocations = practiceStats.totalGpLocations`; inline error fallback returns `totalGpLocations: undefined` to match the union |
| `src/app/_components/home-shell.tsx` | "Total Practices" KPI card adds a subtitle: `<n> GP clinics in watched ZIPs` (only when `totalGpLocations > 0`) |
| `src/app/job-market/_components/job-market-shell.tsx` | KPI strip computes `gpLocations` from filtered `zip_scores` and renders the subtitle on the matching KPI |

The raw NPI count stays as the headline number on each card; the location-deduped count is the subtitle, so we don't break any cross-references to existing dashboards while making the discrepancy legible.

### Phase B — Demote phone-only dso_regional signal (commit chain into `main`)

`scrapers/dso_classifier.py` Pass 3 was treating "≥3 NPIs share a phone number across the watched ZIPs" as sufficient to label ALL of them `dso_regional`. In practice this was usually a multi-dentist group practice or family practice — same building, shared front desk — NOT a DSO. The phone-sharing pattern now writes a `shared_phone_flag: phone=<n> shared with <m> practices across <k>+ buildings` line to `classification_reasoning` but no longer overrides the structural classification (provider count, last-name match, taxonomy code, real corporate signals).

**Verified counts (SQLite, 2026-04-25 post-Phase B):**

| Classification | Pre-Phase B | Post-Phase B | Δ |
|---|---:|---:|---:|
| dso_regional | 1,181 | **109** | -1,072 |
| small_group | 2,443 | 2,727 | +284 |
| large_group | 1,678 | 2,456 | +778 |
| family_practice | 1,243 | 1,708 | +465 |
| solo_established | 3,959 | 3,575 | -384 |
| **Total watched-ZIP NPIs** | **14,027** | **14,053** | +26 |

The +26 net total comes from a small NPPES delta unrelated to Phase B.

### Phase B Supabase commit (sync resilience)

`sync_to_supabase.py::_sync_watched_zips_only` wraps TRUNCATE CASCADE + 14k inserts in a single atomic `pg_engine.begin()` block. Direct connection (port 5432) drops after ~4-5 min of sustained inserts, rolling back the whole transaction. Verified twice in this session — practices stayed at the OLD (pre-Phase B) state in Supabase even after sync claimed completion.

**Workaround shipped:** `scrapers/upsert_practices_phaseB.py` — per-batch transactions (each 500-row batch in its own `connect()` + `commit()`), `pool_pre_ping=True`, upsert ON CONFLICT(npi) DO UPDATE (no TRUNCATE). Pattern lifted from `scrapers/fast_sync_watched.py`. Survives SSL drops because each batch is independently committed.

**Future:** rewrite `_sync_watched_zips_only` to use the per-batch pattern. The atomic TRUNCATE+INSERT design was inherited from fresh-install bootstrap; for incremental updates it's strictly worse than upsert.

## Warroom Ship Log (2026-04-24 → 2026-04-25) — Do Not Regress

Phases 0-7 of the Chicagoland Warroom shipped 2026-04-24, then trimmed and extended on 2026-04-25 (commits `ff5a7f1`, `9fd171f`, `f8beecb`, `50aecbb`).

| Area | Delivered |
|------|-----------|
| Scope model | 11 scope IDs (chicagoland, 7 subzones, 3 saved presets) — `US` and `Profile` cut in the 04-25 triage. `normalizeWarroomDataScope()` maps saved presets to ZIP arrays |
| Modes | 2 modes: Hunt and Investigate. Sitrep KPI strip is always-visible above both panels. (Profile mode and standalone Sitrep mode were cut 04-25; Profile's compare workflow lives in the new `pin-compare-drawer`.) |
| Lenses | 4 lenses: consolidation, density, buyability, retirement (was 8 — pe_exposure / saturation / whitespace / disagreement cut as low-signal) |
| Hunt mode | Intent-driven filtering, tier floors, flag badges, enrichment-aware ranking, intel-availability + reviewed-only filter chips, "In pipeline · N" lifecycle filter |
| Investigate mode | `investigate-mode-panel.tsx` — signal co-occurrence + compound-flag list (flagCount ≥ 2) + stealth DSO cluster / intel-disagreement sample cards |
| Pin lifecycle | `use-warroom-pin-lifecycle.ts` localStorage hook (cross-tab sync via `storage` event) — 6 stages: Untouched / Researching / Contacting / In dialogue / Passed / Won. Stage selector in dossier header (only when pinned). Per-row stage badge in TargetList. "In pipeline · N" filter chip counts non-`untouched` stages. |
| Reviewed tracking | `use-warroom-reviewed.ts` localStorage hook + Mark/Unmark Reviewed toggle in dossier header (timestamp tooltip). TargetList "Reviewed · N" filter chip; reviewed rows get a muted tint. Keyboard `V` toggles reviewed on the active target. |
| Dossier nav | Prev/Next arrows + "X of Y" indicator in dossier header — index walks `visibleTargets` so it tracks the active filter chain. Keyboard `[` and `]` jump between targets. |
| Pin compare drawer | `pin-compare-drawer.tsx` — replaces the deleted Profile mode. Multi-target side-by-side metrics + intel snippet. |
| Pin notes | `use-warroom-pin-notes.ts` — per-NPI freeform notes attached to the dossier. |
| Intel availability | `getPracticeIntelAvailability()` query + `useIntelAvailability` hook → drives Sparkles "Intel" badges + intel-only TargetList filter. |
| ZIP dossier | `zip-dossier-drawer.tsx` — separate drawer for ZIP selections (saturation, ownership mix, top practices) |
| Keyboard shortcuts | `?`, `⌘K`/`/`, `1`=Hunt, `2`=Investigate, `R`, `P`, `[`, `]`, `V`, `Esc`. Single-key guards for typing contexts (input/textarea/contenteditable). Overlay was stale `2`/`4` until 2026-04-25 audit §15 #24 fix. |
| Legacy cross-links | `warroom-cross-link.tsx` banner on `/market-intel` and `/intelligence` with preset `hrefSuffix` deep-links |
| Geo helpers | `src/lib/warroom/geo.ts` — subzone ZIP lookups + bounding boxes |

Do not regress:
- `use-warroom-state.ts` MUST keep URL-param sync for all 7 state dimensions (mode, lens, scope, filters, selectedEntity, pins, intent) — breaks share links otherwise
- Single-key shortcuts MUST check `isTypingTarget()` before firing — typing in forms should never switch modes
- `normalizeWarroomDataScope()` MUST return concrete ZIP arrays for saved presets — downstream `getSitrepBundle()` assumes no preset IDs leak through
- Cross-link banners are soft entry points — don't replace them with hard redirects; legacy pages retain their functionality
- Investigate mode flag co-occurrence is computed client-side from `rankedTargets.flags` — server-side aggregation isn't needed until target count exceeds ~500
- Pin lifecycle, reviewed tracking, and pin notes are all **per-device localStorage** — don't migrate to Supabase without a user-auth design pass
- `dossierIndex` MUST be derived from `visibleTargets` (the post-filter list), not raw `bundle.rankedTargets` — otherwise prev/next walks targets the user has filtered out

### Phase 3 Triage Audit Trail (2026-04-25) — Read Before Resuming

Debug record for the multi-session Warroom triage so a future agent can rebuild context without re-reading 50 commits.

**Original audit scope (3 phases):**
1. Phase 1 — Verdict (assess what's earning its complexity in Warroom). Shipped 2026-04-25 in commit `ff5a7f1`.
2. Phase 2 — Cuts (delete low-signal modes/lenses/flags). Shipped in same `ff5a7f1`: modes 4→2 (Sitrep + Profile cut), lenses 8→4 (pe_exposure / saturation / whitespace / disagreement cut), scopes 12→11 (US cut), 4 ZIP-level decorative flags + 2 weak practice flags removed.
3. Phase 3 — Grow (3 new proposals to deepen the surface). User-approved priority C → A → B.

**Phase 3 proposal status:**

| Proposal | Description | Status | Owner | Commits |
|----------|-------------|--------|-------|---------|
| C | Score breakdown panel inside dossier (show why a target ranked) | ✅ Shipped | Parallel session | Landed before this session — verified live in `dossier-drawer.tsx` |
| A | Pipeline lifecycle stages on pinned targets (per-device, 6 stages) | ✅ Shipped (this session) | Me (Opus) | Hook + dossier wiring + target-list integration on `main` (rolled into `9fd171f` / `50aecbb` chain by parallel session's rebase; CLAUDE.md fix shipped as `c41e0dd`) |
| B | "What's new since you last visited" briefing | ⏳ NOT STARTED | — | — |

**Proposal A — what got built (this session):**

Source-of-truth files for debug:
- `src/lib/hooks/use-warroom-pin-lifecycle.ts` — the hook. localStorage key `dental-pe-warroom-pin-lifecycle-v0`. Exports `LIFECYCLE_STAGES`, `LIFECYCLE_STAGE_LABELS`, `LIFECYCLE_STAGE_COLORS`, `LifecycleStage`, `LifecycleMap`, `useWarroomPinLifecycle`. Hook returns `{ stages, hydrated, getStage, setStage, clearStage, clearAll, counts }`.
- 6 stages (canonical order): `untouched`, `researching`, `contacting`, `in_dialogue`, `passed`, `won`. Labels in `LIFECYCLE_STAGE_LABELS` are "Untouched / Researching / Contacting / In dialogue / Passed / Won". Anything else in the docs is a bug — fix it.
- Cross-tab sync via `window.addEventListener('storage', ...)`. No entry cap. `setStage(npi, "untouched")` deletes the key (untouched is the default, never persisted).
- `src/app/warroom/_components/dossier-drawer.tsx` — accepts `currentStage?: LifecycleStage` + `onStageChange?: (npi, stage) => void`. Renders the stage selector dropdown (with colored dot + bg/border/text from `LIFECYCLE_STAGE_COLORS[stage]`) ONLY when `isPinned && onStageChange`. Selector is gated on pin status because un-pinned targets shouldn't have lifecycle state.
- `src/app/warroom/_components/target-list.tsx` — accepts `lifecycleStages?: LifecycleMap`. Renders per-row stage badge (next to tier badge) using same color set. New `pipelineOnly` toggle + "In pipeline · N" header chip filters rows whose NPI has a non-`untouched` stage. `pipelineCount` is derived from `Object.keys(lifecycleStages).length` (because untouched is never persisted).
- `src/app/warroom/_components/warroom-shell.tsx` — calls `useWarroomPinLifecycle()`, threads `lifecycleStages` to TargetList and `currentStage` + `onStageChange` to DossierDrawer.

**Why localStorage and not Supabase:** No user auth in the app yet. Per-device is acceptable; same pattern as `use-warroom-reviewed.ts` and `use-warroom-pin-notes.ts` from the parallel session. Migrating to Supabase requires a user-auth design pass first.

**Vercel deploy chain (2026-04-25):**

| SHA | Time (UTC) | Status | Notes |
|-----|------------|--------|-------|
| `ff5a7f1` | 04:01 | ❌ FAILED | Phase 2 triage commit. Build error truncated in Vercel logs but irrelevant — self-healed by the next push |
| `f8beecb` | 04:13 | ✅ success | Parallel session's target-list intel + reviewed filters |
| `9fd171f` | (earlier) | ✅ success | Parallel session's Launchpad Phase 3 + initial pin lifecycle wiring |
| `50aecbb` | 05:08 | ✅ success | Dossier prev/next nav + reviewed tracking + my pipeline badge |
| `e615bb8` | 05:11 | ✅ success | Parallel session's anti-hallucination docs |
| `c41e0dd` | 05:30 | ✅ success | This session's CLAUDE.md stage-name fix |

The "failed Vercel deploy" email the user received was `ff5a7f1`. Resolved automatically by `f8beecb` 12 minutes later. No manual rollback needed.

**Coexistence rules with parallel session (do not break):**

This Warroom work was developed across two simultaneous Claude sessions. Files owned by the **other** session — DO NOT stage or modify without coordination:
- `src/app/warroom/_components/pinboard-tray.tsx`
- `src/app/warroom/_components/pin-compare-drawer.tsx`
- `src/lib/hooks/use-warroom-intel.ts`
- `src/lib/hooks/use-warroom-pin-notes.ts`
- `src/lib/hooks/use-warroom-reviewed.ts`
- `src/lib/hooks/use-warroom-intel-availability.ts`

Files owned by **this** session (safe to modify):
- `src/lib/hooks/use-warroom-pin-lifecycle.ts`

Shared files (modified by both — read first, edit small, commit fast):
- `src/app/warroom/_components/warroom-shell.tsx`
- `src/app/warroom/_components/dossier-drawer.tsx`
- `src/app/warroom/_components/target-list.tsx`
- `dental-pe-nextjs/CLAUDE.md`

**Known docs drift caught in this session:**

- Parallel session wrote stage names as "Untouched / Reviewed / Following / Contacted / Pursuing / Passed" in this Warroom Ship Log table — those names do NOT exist in the hook. Real names per `LIFECYCLE_STAGE_LABELS`: "Untouched / Researching / Contacting / In dialogue / Passed / Won". Fixed in `c41e0dd`. If you see those wrong names anywhere else, treat as drift and fix.
- Parallel session also claimed "(5,000 entries, cross-tab sync)" — there is no entry cap in the hook. Fixed in same commit.

**Next steps (resume here):**

1. **Proposal B — "What's new since you last visited" briefing (3-4d effort).** Plan:
   - New hook `src/lib/hooks/use-warroom-last-visit.ts` with localStorage key `dental-pe-warroom-last-visit-v0`. Map: `{ [scopeId]: ISO timestamp }`. `markVisited(scope)` on Warroom mount, `getLastVisit(scope)` for the briefing.
   - New component `src/app/warroom/_components/since-last-visit-card.tsx` — renders above `target-list.tsx` when `lastVisit` exists for the active scope. Shows: new deals in scope (`deals.deal_date > lastVisit AND deal.state in scope's states`), new practice_changes in scope (`changes.changed_at > lastVisit AND change.zip in scope's ZIPs`), NPIs that crossed `buyability_score >= 50` since lastVisit, ZIPs whose `corporate_share_pct` moved ≥3pp since lastVisit (requires snapshotting prior corporate_share — punt or compute from `practice_changes`).
   - Briefing data fetch: extend `getSitrepBundle()` in `src/lib/warroom/data.ts` with optional `since?: string` param. When provided, runs supplemental queries and returns `briefing.sinceLastVisit: { newDealCount, newChangeCount, newBuyabilityCount, newCorporateShiftCount, items: [...] }`.
   - "Mark as seen" button bumps the timestamp.
   - Dim the badge after 7 days idle (don't shame skipped weeks).
2. Optional polish before Proposal B: eyeball-verify Proposal C's score breakdown is rendering inside the live dossier (haven't tested visually — parallel session shipped it).
3. If Proposal B is deferred, alternative work pile: intel coverage push (only 23/401k practices have `practice_intel` rows — running `weekly_research.py --budget 30` would meaningfully grow the dataset).

**Source-of-truth files for resuming Phase 3:**
- This audit trail (you are reading it)
- `FIRST_JOB_FINDER_PLAN.md` at repo root — untracked, contains the original Launchpad design notes (parallel session's plan)
- Commit log: `git log --oneline ff5a7f1..HEAD` shows the full Phase 2 → Phase 3 chain

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

### Phase 3 shipped (2026-04-25) — qualitative-intel-driven first-job copilot

> **Debug checkpoint:** see `dental-pe-tracker/PHASE3_RESUME.md` for the full mandate, commit-by-commit status board, verification commands, and symptom→fix runbook. Read that first if anything looks off.

Six Claude API routes layered onto the existing rank-and-score scaffold, plus a signal-firing audit that fixed several silently-broken signals.

| Area | Delivered |
|------|-----------|
| Shared types | `src/lib/launchpad/ai-types.ts` — 6 request/response pairs (PracticeSnapshot, ZipContext, IntelContext, TrackScores, AskIntel, CompoundNarrative, InterviewPrep, ZipMood, SmartBriefing, ContractParse). Single source of truth for both routes and clients. |
| Routes | 6 new POST routes under `src/app/api/launchpad/`. All Node runtime, force-dynamic, raw HTTP fetch (no SDK), 503 on missing `ANTHROPIC_API_KEY`. Models: Haiku 4.5 for `ask`, `compound-narrative`, `interview-prep`, `zip-mood`, `contract-parse`; Sonnet 4.6 for `smart-briefing`. `contract-parse` has 5/hr per-IP rate limit. |
| Ask Intel drawer | `ask-intel-drawer.tsx` — Sheet triggered from dossier header. Free-form Q&A about a practice/ZIP. 3 starter chips. Model attribution badge. |
| Interview Prep AI | `interview-prep-ai.tsx` — replaces the static Phase 1 Interview Prep tab. `useQuery` cached per `(npi, track)`, 5min staleTime. Categorized questions with bold Q + italic listenFor. Regenerate button. |
| Contract Parser | `contract-parser.tsx` — new 6th dossier tab. Textarea (≥500 chars to submit, matches route minimum), structured output (non-compete, comp, termination, CE, restrictive covenants, severity-color flags). 429 → "Rate limit reached, retry in N min". Lock disclaimer ("text is not saved"). |
| Compound Thesis | `compound-thesis.tsx` — collapsible 2-3-sentence thesis embedded in each track-list card. Lazy fetch on expand only. AI badge. |
| ZIP Mood badge | `zip-mood-badge.tsx` — auto-fetches in ZIP dossier header. 2-sentence vibe + colored confidence dot. 30min cache. |
| Smart Briefing | `smart-briefing-builder.tsx` — Sheet triggered when ≥2 NPIs pinned. Multi-select up to 5 (matches route cap). Sonnet 4.6 returns side-by-side strengths/risks/questions + top-pick recommendation with rationale. |
| DSO Tier card | `dso-tier-card.tsx` — extracted reusable card showing tier badge, comp band, rationale, citations. Graceful fallback with mailto for unknown DSOs. |
| Living Map upgrade | Default ZIP view, 2 new lenses (Mentor Density, DSO Avoid) with color ramps, data-quality amber banner when `metrics_confidence === 'low'` for selected ZIP. |
| Boston Metro presets | 4 new scopes added to `LAUNCHPAD_SCOPES`: `boston_core` (8 ZIPs), `cambridge_somerville` (6), `brookline_fenway` (3), `newton_waltham` (4). All 21 ZIPs verified against `watched_zips` table. |
| Intel Coverage KPI | `launchpad-kpi-strip.tsx` — replaced "comp range" KPI (always-flat) with `withIntelCount / totalCount` Brain-icon KPI. Tooltip explains 0% case → run `python3 scrapers/practice_deep_dive.py`. |
| Saved searches removed | `saved-searches-menu.tsx` + `use-launchpad-saved-searches.ts` deleted. Pinboard + Smart Briefing replaced its job with stronger UX. |

### Signal-firing audit fixes (Phase 3)

| File | Bug | Fix |
|------|-----|-----|
| `queries/launchpad.ts:269` | `recent_acquisition_warning` SQL filter `.ilike("change_type", "%ownership%")` matched 0 rows because actual column values are `acquisition` | `.ilike("change_type", "%acquisition%")` — 4,258 rows now fire |
| `ranking.ts:239` | `ffs_concierge` only checked `intel?.ppo_heavy === false` — missed practices that take Medicaid (which is the FFS-killer signal) | `intel?.ppo_heavy === false && intel?.accepts_medicaid === false` |
| `ranking.ts:273` | `mentor_density` threshold `>= 5` too high for the dataset's actual provider distribution | Threshold `>= 3` (still meaningful, fires more often) |
| `ranking.ts:334` | `pe_recap_volatility` had a ZIP-proximity check that blocked it from firing on the actual practice with PE sponsorship | Removed the proximity check; fires on `practice.affiliated_pe_sponsor` truthy |
| `signals.ts:191` | `succession_published` baseWeight `35` was overweight — it's a strong signal but not 35-points strong | Baseline `15` |
| `signals.ts:270` | New export `SIGNALS_REQUIRING_INTEL` (5 IDs: `hiring_now`, `succession_published`, `tech_modern`, `ffs_concierge`, `medicaid_mill`) — gates these signals from firing on practices without `practice_intel` row, preventing false positives in the absence of qualitative research |
| `red-flag-patterns.tsx` | Heatmap matrix wasn't earning its complexity — most ZIPs had sparse co-occurrence, so the matrix rendered as a near-empty grid | Removed heatmap (293 → 172 lines), kept compound-targets list which is the actually-useful part |

### Backend (Python scrapers)

- `research_engine.py` — added `JOB_HUNT_SYSTEM` + `JOB_HUNT_PRACTICE_USER` prompts, `research_practice_jobhunt()` method, `build_batch_requests_jobhunt()` for batch API
- `research_engine.py` (Phase 3 anti-hallucination, commit `59e8403`): rewrote `PRACTICE_SYSTEM` prompt to require ≥2 web searches, per-field `_source_url`, mandatory `verification` block. Added `force_search=True` parameter that sets `tool_choice` to require `web_search`. `research_practice()` and `build_batch_requests()` use `force_search=True` + `max_searches=5` for practice items.
- `weekly_research.py` (Phase 3 anti-hallucination): new `validate_dossier()` quarantine gate. Practice dossiers that fail evidence rules (missing verification block, 0 searches executed, evidence_quality=insufficient, website.url without `_source_url`, google metrics without `_source_url`) are NOT stored. Rejection reasons aggregated and reported in batch summary. Per-row try/except so one bad dossier can't kill the batch.
- `database.py` — 10 new `PracticeIntel` columns: 7 jobhunt (`succession_intent_detected`, `new_grad_friendly_score`, `mentorship_signals`, `associate_runway`, `compensation_signals`, `red_flags_for_grad`, `green_flags_for_grad`) + 3 verification (`verification_searches`, `verification_quality`, `verification_urls`)
- `intel_database.py` — `store_practice_intel()` updated to map all 10 new columns
- `migrations/2026_04_24_launchpad_jobhunt_columns.sql` — Postgres DDL for all 10 new columns + index on `verification_quality`. **Must be applied manually before first sync.**

### Cost reality (verified, supersedes earlier estimates)

- Haiku per ZIP: ~$0.024 (NOT $0.04-0.06 as CLAUDE.md previously claimed)
- Haiku per practice: ~$0.011 (NOT $0.08-0.12)
- $30 budget → ~2,000 practice deep dives (NOT 300)
- 258 of 290 `zip_qualitative_intel` rows are synthetic placeholders (cost_usd=0) — only 32 ZIPs are actually researched
- 23 of 401k practices have real `practice_intel` — Intel Coverage KPI honestly reflects this small denominator

### Do not regress (Phase 3)

- All 6 AI routes MUST return 503 (not 500) when `ANTHROPIC_API_KEY` missing; the UI surfaces the message verbatim.
- All 6 AI routes MUST use raw HTTP `fetch` (not `@anthropic-ai/sdk`). Matches `narrative/route.ts` pattern. Fewer dependencies, faster cold starts.
- `contract-parse` MUST keep the 5/hr per-IP rate limit. Sonnet/Haiku contract analysis is expensive AND the input is large; rate-limit prevents a single user spending the whole monthly budget.
- `smart-briefing` cap is 5 practices server-side AND client-side — keep them in sync (`MAX_SELECTED = 5` in client, `> 5` reject in route).
- `contract-parser` `MIN_CHARS = 500` MUST match route's `MIN_CONTRACT_LEN = 500` — the button shouldn't enable until the route would accept the input.
- `SIGNALS_REQUIRING_INTEL` MUST gate the 5 named signals from firing without intel — prevents false positives on the 99.99% of practices without research.
- `recent_acquisition_warning` SQL filter MUST use `%acquisition%` — `%ownership%` matches 0 rows in `practice_changes.change_type`.
- Boston Metro 4 presets MUST cover the 21 watched ZIPs — `boston_core` (8) + `cambridge_somerville` (6) + `brookline_fenway` (3) + `newton_waltham` (4) = 21 ✓

### User actions required after deploy

1. Add `ANTHROPIC_API_KEY` to Vercel env vars (production + preview environments)
2. Apply `dental-pe-tracker/scrapers/migrations/2026_04_24_launchpad_jobhunt_columns.sql` to Supabase Postgres (SQL editor → paste → run). Migration now includes the 3 verification columns from commit `59e8403`.
3. Authorize an initial seeding run: `python3 scrapers/weekly_research.py --budget 30 --jobhunt`. The new `validate_dossier()` gate will quarantine any dossier that fails the anti-hallucination checks and report the rejection breakdown in the batch summary.

### Deploy verification (2026-04-25 05:08 UTC)

- Commits `9fd171f` (Phase 3 frontend), `f8beecb` (target-list filters), `50aecbb` (dossier nav + reviewed tracking) all pushed to `main`
- Live URL: https://dental-pe-nextjs.vercel.app — `/launchpad` returns 200 OK from Vercel CDN
- Vercel deploy `4480719868` for `ff5a7f1` was the failed-deploy email — transient; `f8beecb` (12 min later) and `50aecbb` deployed successfully on retry
- AI route smoke test: `POST /api/launchpad/ask` → 503 with `"AI Q&A disabled: ANTHROPIC_API_KEY is not set. Add it to Vercel env vars to enable."` — wired correctly, awaiting env var
- Parent repo `dental-pe-tracker`: `8b68777` + `73ad4fd` + `59e8403` + `9508865` all on `main`

## 2026-04-25 Session Audit — Warroom "Make What's Left 20x Better"

Multi-session work — a parallel session ran Phase 2 surgical cuts (modes 4→2, lenses 8→4, scopes 12→11, dead flags removed) while this session deepened what survived. Documented here so the next reader can debug exactly what shipped, what didn't, and where to look.

### Original directive (verbatim, "ultrathink" used 2x by user)

> 1) especially further improving what remains and how to further make this more next level and usable especially the practice dossier searcher tool i have i want that to be extremely optimized in war room. creatively ultrathink what you can do to make what remains bulletproof debugged working, further enhanced
> 2) Flip the phantom_inventory flag's weight (it currently boosts scores when it should penalize)
> 3) Cap classification confidence at 70 for thin-data practices (Launchpad already does this)
> 4) Exclude specialists + non-clinical from the default Hunt list

### What shipped (files, commits, behavior)

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| Phantom inventory flag weight flip (+10 → -12) | ✅ | `9fd171f` | `src/lib/warroom/ranking.ts` — search for `phantom_inventory_flag` in flag weight map |
| Confidence cap at 70 for thin-data practices | ✅ | `9fd171f` | `src/lib/warroom/ranking.ts::hasThinData()` + cap applied in `rankTargets()`. Mirrors Launchpad's `CONFIDENCE_FLOOR=40`/`CONFIDENCE_CAP=70` pattern |
| Exclude specialists + non_clinical from Hunt | ✅ | `9fd171f` | `src/lib/warroom/ranking.ts::rankTargets()` accepts `excludeNonGp: true` (default). Hunt mode passes the flag from `warroom-shell.tsx` |
| Intel availability badge layer | ✅ | `9fd171f` | `src/lib/supabase/queries/intel.ts::getPracticeIntelAvailability()` (chunked 200 NPIs) + `src/lib/hooks/use-warroom-intel-availability.ts` React Query wrapper. Drives Sparkles badge on TargetList rows + intel-only filter chip |
| Pin lifecycle (6 stages) | ✅ | `9fd171f` | `src/lib/hooks/use-warroom-pin-lifecycle.ts` (5,000-cap localStorage, cross-tab sync). Stage selector in dossier header + per-row stage badge in TargetList. Stages: Untouched / Reviewed / Following / Contacted / Pursuing / Passed |
| Pin notes (per-NPI freeform) | ✅ | `9fd171f` | `src/lib/hooks/use-warroom-pin-notes.ts` localStorage hook + textarea in dossier |
| Pin compare drawer (replaces deleted Profile mode) | ✅ | `9fd171f` | `src/app/warroom/_components/pin-compare-drawer.tsx` — multi-target side-by-side metrics + intel snippet |
| TargetList intel + reviewed filter chips | ✅ | `f8beecb` | `src/app/warroom/_components/target-list.tsx` — "Intel · N" + "Reviewed · N" chips toggle visibility |
| Reviewed tracking | ✅ | `50aecbb` | `src/lib/hooks/use-warroom-reviewed.ts` — 5,000-cap localStorage, cross-tab sync. Mark/Unmark button in dossier header (timestamp tooltip), `V` keyboard shortcut |
| Dossier prev/next navigation | ✅ | `50aecbb` | `src/app/warroom/_components/dossier-drawer.tsx` — ChevronLeft/ChevronRight + "X of Y" indicator. `[`/`]` keyboard shortcuts. Index walks `visibleTargets` (post-filter), not raw `bundle.rankedTargets` |
| Pipeline filter chip + lifecycle badge | ✅ | `50aecbb` | `src/app/warroom/_components/target-list.tsx` — "In pipeline · N" chip filters by lifecycle stage ≠ untouched. Per-row Handshake badge with stage label/color |

### Bugs fixed this session (do not regress)

| File:Line | Bug | Fix |
|-----------|-----|-----|
| `warroom-shell.tsx:512` | TS error: `Block-scoped variable 'goToNextTarget' used before its declaration` in keyboard `useEffect` dep array | Moved `rankedTargets`/`npisForIntel`/`intelAvailable`/`visibleTargets`/`dossierIndex`/`goToPrevTarget`/`goToNextTarget` block from after summary section UP to BEFORE the keyboard useEffect (line ~399). Removed duplicate at original location |
| `warroom-shell.tsx` keyboard handler | `V` shortcut needed reviewed-set check to toggle correctly | Calls `isReviewed(npi) ? unmarkReviewed(npi) : markReviewed(npi)` |

### Verification

- **Build**: `npm run build` passes after each commit (TypeScript strict, no warnings)
- **Vercel deploys**: `9fd171f` deploy `4480769033` succeeded; `f8beecb` deploy `4480829871` succeeded; `50aecbb` deploy `4480981505` succeeded (state="success", https://dental-pe-nextjs-555wisizz-suleman7-dmds-projects.vercel.app)
- **Failed-deploy email** the user got was for `ff5a7f1` (deploy `4480719868`, parallel session's Phase 2 triage) — self-healed by next push 12 min later. Not a code bug; transient Vercel issue
- **Live smoke check**: https://dental-pe-nextjs.vercel.app/warroom returns 200, Hunt mode loads with TargetList visible

### What's next (specifics, so next session can pick up cold)

**Awaiting user action (no code change needed):**

1. **`ANTHROPIC_API_KEY` in Vercel** — without it, all 6 Launchpad AI routes return 503. Test with `curl -X POST https://dental-pe-nextjs.vercel.app/api/launchpad/ask -H "Content-Type: application/json" -d '{"question":"test","npi":"1234567890"}'` — currently returns `{"error":"AI Q&A disabled: ANTHROPIC_API_KEY is not set..."}`. Once added, response should include `answer` + `model`
2. **Apply migration** `dental-pe-tracker/scrapers/migrations/2026_04_24_launchpad_jobhunt_columns.sql` in Supabase SQL editor. Adds 10 columns to `practice_intel` (7 jobhunt + 3 verification). Without this, next `sync_to_supabase.py` run will fail on the new columns. Verify with `SELECT column_name FROM information_schema.columns WHERE table_name='practice_intel'` — should see `succession_intent_detected`, `verification_quality`, etc.
3. **GitHub Actions secrets** for `keep-supabase-alive.yml`: add `SUPABASE_URL` + `SUPABASE_ANON_KEY` at https://github.com/suleman7-DMD/dental-pe-nextjs/settings/secrets/actions. Without them the cron fires every 3 days but gets 401. Workflow logs at /actions tab will confirm
4. **Seed real intel**: `python3 scrapers/weekly_research.py --budget 30 --jobhunt` (in parent repo). Currently 23 of 401k practices have `practice_intel` — Intel Coverage KPI honestly shows ~0%. Quarantine reasons land in `/tmp/full_batch_summary.json`

**Warroom polish (recommended next code work, 1-2 hr each):**

5. **Sitrep KPI strip extension** — `src/app/warroom/_components/sitrep-kpi-strip.tsx` doesn't surface `reviewedSet.size` or pipeline-stage counts. Both are tracked in localStorage but invisible to the user. Add 2 KPI cards: "Reviewed · N" + "In pipeline · N (by stage)". Will need to lift `useWarroomReviewed` + `useWarroomPinLifecycle` from `warroom-shell.tsx` → `sitrep-kpi-strip.tsx` or pass `reviewedCount`/`stageCounts` as props
6. **Cmd+Shift+P shortcut** to open pin compare drawer when 2+ pins exist. Add to keyboard handler in `warroom-shell.tsx` (after the existing `P` handler). Update `keyboard-shortcuts-overlay.tsx` Actions group with new row
7. **Bulk-pin button on Investigate compound-flag list** — currently one-by-one. `src/app/warroom/_components/investigate-mode-panel.tsx::CompoundFlagTargets` should add a "Pin all 12" button that calls `togglePin(npi)` in a loop

**Known limitations (documented, not bugs):**

- Pin lifecycle, reviewed tracking, and pin notes are **per-device localStorage**. Cross-device usage requires Supabase migration + auth design pass (not started)
- 1,091 phone-only `dso_regional` practices still distort the all-signals corporate KPI (9.9% vs 2.3% high-confidence). Reclassification is documented in CLAUDE.md → "Tiered Consolidation" section but not yet executed in `dso_classifier.py`
- `dossierIndex` walks `visibleTargets` not `bundle.rankedTargets` — by design, so prev/next respects active filters. If a target is filtered out while open, dossier closes (no graceful handoff to nearest visible target). Acceptable trade-off
- `pipelineCount` in `target-list.tsx` derives from `lifecycleStages` prop — if a pin is removed while its NPI is in `lifecycleStages`, the count includes orphaned stage entries. `use-warroom-pin-lifecycle.ts` doesn't auto-clean on unpin. Low-impact (5,000-cap, cross-tab sync handles drift)

### Bigger swings (if user wants to invest a day)

- Migrate localStorage state (pins, lifecycle, reviewed, notes) to Supabase behind lightweight auth (NextAuth or Clerk). Required for cross-device usage. Estimated 1-2 days
- Reclassify 1,091 phone-only `dso_regional` practices in `dso_classifier.py` Pass 3. Shared phone becomes a flag, not enough alone for `dso_regional`. Need to backfill `entity_classification` and re-sync. Estimated 4-6 hours including validation
- Bulk practice import via CSV upload on Warroom — would let user paste a target list from external research and pin them all at once. Net new feature. Estimated 1 day

## Development

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # TypeScript check + production build
npm start       # Production server
npm run lint    # ESLint
```
