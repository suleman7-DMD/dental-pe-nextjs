# Dental PE Intelligence Platform — Claude Code Guide

## What This Project Is

A Next.js 16 + Supabase + Vercel web application that tracks private equity consolidation in US dentistry. It connects to a Supabase Postgres database populated by a Python scraper pipeline, visualizes 400k+ dental practices, 2,500+ PE deals, and 290 scored markets. The frontend provides 7 pages of market intelligence with maps, charts, data tables, and deep-dive research tools.

**Live app:** https://dental-pe-nextjs.vercel.app
**Data pipeline repo:** github.com/suleman7-DMD/dental-pe-tracker (Python scrapers write to SQLite, sync to Supabase)
**Frontend repo:** github.com/suleman7-DMD/dental-pe-nextjs

## Architecture

```
src/
  app/                    Next.js App Router — 7 page routes + API routes
    _components/          Home page shell
    deal-flow/            PE deal tracking (timeline, sponsors, state choropleth)
    market-intel/         ZIP consolidation analysis (maps, saturation, changes)
    buyability/           Acquisition target scoring
    job-market/           Career opportunity finder (density maps, directory)
    research/             Deep dives (sponsor/platform profiles, SQL explorer)
    system/               Pipeline health, data freshness, manual entry
    api/                  Route handlers (deals, practices, sql-explorer, watched-zips)
  components/             Shared UI components
    charts/               Recharts wrappers (bar, donut, scatter, histogram, etc.)
    data-display/         DataTable, KPI cards, badges, confidence stars
    filters/              Filter bar, multi-select, date range, search
    layout/               Sidebar, sticky section nav
    maps/                 Mapbox GL container
    ui/                   shadcn base components (button, card, dialog, etc.)
  lib/
    constants/            Entity classifications, colors, design tokens, locations
    hooks/                useSidebar, useUrlFilters, useSectionObserver
    supabase/             Client/server Supabase setup + query functions
    types/                TypeScript interfaces (Deal, Practice, ZipScore w/ 40+ fields, etc.)
    utils/                Formatting, scoring, CSV export, color helpers
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
- 400,962 practices (14,027 in watched ZIPs, all with entity_classification)
- 2,512 deals (105 YTD 2026)
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

## Dashboard Pages (7 total)

| Route | Page | What It Shows |
|-------|------|---------------|
| `/` | **Home** | 8 KPI cards (deals, sponsors, practices, ZIPs, corporate %, retirement risk, YTD deals, freshness), 6 nav cards, recent deals table, data freshness bar |
| `/deal-flow` | **Deal Flow** | 2,512 PE deals — KPIs, monthly stacked bar timeline, top 15 sponsors/platforms, state choropleth, searchable deals table with CSV. All queries paginated (no 1000-row truncation). |
| `/market-intel` | **Market Intel** | Tiered consolidation KPIs (high-confidence corporate ~2.3% vs all-signals ~9.9%), DSO penetration table, consolidation map, ZIP score table, city practice tree with pre-loaded counts, ownership breakdown with per-classification counts |
| `/buyability` | **Buyability** | Data-driven KPIs (Acquisition Targets, Dead Ends, Job Targets, Specialists computed from entity_classification + buyability_score), 25-row paginated table with category badges, color-coded by category |
| `/job-market` | **Job Market** | Living location selector, 9 KPI cards with **tiered consolidation display** (high-confidence 1.9% + all-signals 9.9% + industry estimate), pydeck density map, market overview (donut, bar, histogram, top DSOs), paginated practice directory with 4 tabs, opportunity signals, ownership landscape, market analytics |
| `/research` | **Research** | 4 tabs — PE sponsor profiles, platform profiles, state deep dive, SQL explorer with preset queries |
| `/system` | **System** | Data source coverage table, freshness timestamps, completeness bars, pipeline log viewer, manual entry forms (add deal, update practice, add ZIP) |

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
| Deal Flow | `deal-flow/_components/deal-flow-shell.tsx` | deal-kpis, deal-volume-timeline, specialty-charts, sponsor-platform-charts, state-choropleth, deals-table |
| Market Intel | `market-intel/_components/market-intel-shell.tsx` | consolidation-map, zip-score-table, city-practice-tree, dso-penetration-table |
| Buyability | `buyability/_components/buyability-shell.tsx` | Data-driven categorization, 25-row paginated table with category badges |
| Job Market | `job-market/_components/job-market-shell.tsx` | living-location-selector, practice-density-map, market-overview-charts, practice-directory, opportunity-signals, ownership-landscape, market-analytics, practice-detail-drawer |
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

## Development

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # TypeScript check + production build
npm start       # Production server
npm run lint    # ESLint
```
