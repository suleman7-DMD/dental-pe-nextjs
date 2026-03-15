# Dental PE Intelligence Platform — Claude Code Guide

## What This Project Is

A Next.js 16 + Supabase + Vercel web application that tracks private equity consolidation in US dentistry. It connects to a Supabase Postgres database populated by a Python scraper pipeline, visualizes 400k+ dental practices, 2,500+ PE deals, and 290 scored markets. The frontend provides 7 pages of market intelligence with maps, charts, data tables, and deep-dive research tools.

**Live app:** Deployed on Vercel (auto-deploys on push to `main`)
**Data pipeline repo:** github.com/suleman7-DMD/dental-pe-tracker (Python scrapers write to SQLite, sync to Supabase)
**Frontend repo:** This repo (Next.js dashboard reading from Supabase)

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
    types/                TypeScript interfaces (Deal, Practice, ZipScore, etc.)
    utils/                Formatting, scoring, CSV export, color helpers
  providers/              QueryProvider (React Query), SidebarProvider
```

Push to `main` → Vercel auto-deploys.

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

- **practices**: 400k+ rows. NPI (PK), practice_name, doing_business_as, address, city, state, zip, phone, entity_type, taxonomy_code, ownership_status, entity_classification, classification_reasoning, affiliated_dso, affiliated_pe_sponsor, buyability_score, classification_confidence, data_source, latitude, longitude, parent_company, ein, franchise_name, website, year_established, employee_count, estimated_revenue, num_providers, location_type, data_axle_import_date
- **deals**: 2,500+ rows. PE dental deals from PESP, GDN, PitchBook
- **practice_changes**: Change log for name/address/ownership changes (acquisition detection). 5,100+ rows.
- **zip_scores**: Per-ZIP consolidation stats (290 scored ZIPs). One row per ZIP (deduped). Includes saturation metrics: dld_gp_per_10k, buyable_practice_ratio, corporate_share_pct, people_per_gp_door, market_type, metrics_confidence. Also includes city field.
- **watched_zips**: 290 ZIPs (268 Chicagoland + 21 Boston + 1 other). Includes population, median_household_income.
- **dso_locations**: 408 scraped DSO office locations from ADSO websites.
- **ada_hpi_benchmarks**: 918 rows. State-level DSO affiliation rates by career stage (2022-2024).
- **pe_sponsors**: 33 known PE sponsor profiles.
- **platforms**: 69 known DSO platform profiles.

### Current Data Stats
- 400,962 practices (362k independent, 2.8k DSO-affiliated, 401 PE-backed, 35k unknown)
- 2,512 deals
- 2,992 Data Axle enriched practices (with lat/lon, revenue, employees, year established)
- 290 scored ZIPs

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

## Dashboard Pages (7 total)

| Route | Page | What It Shows |
|-------|------|---------------|
| `/` | **Home** | Hero, 6 nav cards with key stats, recent deals strip, data freshness bar |
| `/deal-flow` | **Deal Flow** | Every PE dental deal — KPIs, timeline chart, deal type/specialty breakdowns, top sponsors/platforms, state choropleth, searchable table |
| `/market-intel` | **Market Intel** | Watched ZIPs — saturation table, consolidation map, ownership breakdown, ZIP scores, practice changes, ADA benchmarks, city practice tree |
| `/buyability` | **Buyability** | Individual practice scoring — filters by ZIP, verdict categories, confidence ratings, entity classification |
| `/job-market` | **Job Market** | Post-graduation job hunting — living location selector, KPI grid, pydeck density map, market overview charts, searchable practice directory, opportunity signals, ownership landscape, market analytics |
| `/research` | **Research** | Deep dives — PE sponsor profiles, platform profiles, state analysis, SQL explorer with presets |
| `/system` | **System** | Data freshness indicators, source coverage, completeness bars, pipeline log viewer, manual entry forms (add deal, edit practice) |

### Job Market Page Structure (most complex page)
- Living location selector: West Loop/South Loop (142 ZIPs), Woodridge (129 ZIPs), Bolingbrook (127 ZIPs), All Chicagoland (268 ZIPs)
- 9 KPI cards: Total Practices, Independent %, Consolidated %, Avg Buyability, 10+ Staff, Retirement Risk, Avg DLD, Avg Buyable Ratio, Avg Corporate Share
- Pydeck practice density map with Mapbox GL (green = independent, red = corporate, gray = unknown)
- Market Overview: ownership donut (11 entity types), consolidation by ZIP bar chart, practice age histogram, top DSOs bar chart
- Searchable Practice Directory with entity classification filters, sort options, CSV download, pagination
- Opportunity Signals: Retirement Risk table, High Buyability scatter, Recent Changes
- Ownership Landscape: entity classification bar chart, top DSOs table, DSO penetration by ZIP
- Market Analytics: dentist density by ZIP, consolidation breakdown, competitive landscape

## Data Flow Pattern

### Server Components (pages)
All `page.tsx` files are async Server Components. They fetch initial data from Supabase server-side and pass it to Client Component shells via props.

### Client Components (shells)
Page shells (e.g., `deal-flow-shell.tsx`) are `'use client'`. They handle filters, UI state, and refetching via React Query (TanStack). React Query config: 5min staleTime, 30min gcTime, no refetch on window focus.

### Supabase Query Layer
`src/lib/supabase/queries/` contains all query functions organized by table:
- `deals.ts` — getDealStats, getDealsByFilters, getTopSponsors, etc.
- `practices.ts` — getPracticesByZips, searchPractices, getPracticeStats, getBuyabilityPractices, getRetirementRiskCount, getAcquisitionTargetCount, etc. Uses entity_classification with ownership_status fallback for retirement risk, acquisition targets, and practice stats.
- `zip-scores.ts` — getZipScores, getSaturationMetrics
- `watched-zips.ts` — getWatchedZips, getDistinctMetroAreas, getZipsByMetro
- `system.ts` — getDataFreshness, getSourceCoverage, getCompletenessMetrics
- `ada-benchmarks.ts`, `changes.ts`, `practice-changes.ts`

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/deals` | POST | Create new deal (manual entry) |
| `/api/practices/[npi]` | PATCH | Update practice ownership, DSO affiliation |
| `/api/sql-explorer` | POST | Execute SQL queries (admin research) |
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
| `dso_regional` | corporate | Shows corporate signals (parent company, shared EIN, franchise field) |
| `dso_national` | corporate | Known national/regional DSO brand (Aspen, Heartland, etc.) |
| `specialist` | other | Specialist practice (Ortho, Endo, Perio, OMS, Pedo) |
| `non_clinical` | other | Dental lab, supply company, billing entity |

### Classification Helpers (src/lib/constants/entity-classifications.ts)
- `isIndependentClassification(ec)` — true for solo_*, family_practice, small_group, large_group
- `isCorporateClassification(ec)` — true for dso_regional, dso_national
- `classifyPractice(entityClassification, ownershipStatus)` — returns "independent" | "corporate" | "specialist" | "non_clinical" | "unknown" with ownership_status fallback
- `getEntityClassificationLabel(value)` — returns human-readable label
- `DSO_FILTER_KEYWORDS` — taxonomy descriptions that leak into affiliated_dso field

### Corporate Detection Rules
```
Corporate = entity_classification IN ('dso_regional', 'dso_national')
Independent = entity_classification IN ('solo_established', 'solo_new', 'solo_inactive', 'solo_high_volume', 'family_practice', 'small_group', 'large_group')
Specialist = entity_classification = 'specialist'
Non-clinical = entity_classification = 'non_clinical'
Unknown = entity_classification IS NULL OR entity_classification = ''
```

### Saturation Metrics (in zip_scores)
- **DLD (Dentist Location Density):** dld_gp_per_10k = GP offices per 10,000 residents. National avg ~6.1.
- **Buyable Practice Ratio:** buyable_practice_ratio = % of GP offices classified as solo_established, solo_inactive, or solo_high_volume.
- **Corporate Share:** corporate_share_pct = % of GP offices classified as dso_regional or dso_national.
- **Market Type:** market_type = computed classification (9 possible values). NULL when metrics_confidence is 'low'.
- **People per GP Door:** people_per_gp_door = population / GP locations.

### Confidence System
- **metrics_confidence** on zip_scores: 'high' (coverage >80% AND unknown <20%), 'medium' (>50% AND <40%), 'low' (anything else)
- **market_type_confidence**: 'confirmed' (high), 'provisional' (medium), 'insufficient_data' (low)
- **classification_confidence** on practices: 0-100 score from DSO name/pattern matching

## Bug Fixes Applied (2026-03-15)

1. **Home page icons** — KpiCard icons now use Lucide JSX components (`<BarChart3 />`, `<Clock />`, etc.), not strings (`"bar-chart"`, `"clock"`)
2. **Home page consolidatedPct** — `getPracticeStats()` now returns values with `%` suffix (e.g., "9.9%" not "9.9")
3. **getRetirementRiskCount()** — Now uses ALL 7 independent entity classifications (not just 3 solo types), queries globally (no watched ZIP filter), adds `.not("year_established", "is", null)` guard
4. **getAcquisitionTargetCount()** — Now uses `entity_classification` with `ownership_status` fallback (two queries summed)
5. **Market Intel KPIs** — `market-intel/page.tsx` now computes server-side `classificationCounts` prop using entity_classification-based queries. MarketIntelShell accepts and uses this for KPIs instead of zip_scores.dso_affiliated_count/pe_backed_count (which are legacy ownership_status-based). Shows ~9.7% not 2.3%.
6. **ZIP Score table** — `zip-score-table.tsx` now computes derived rows (consolidation_pct, independent_pct, unknown_pct, confidence, opportunity_score) from existing ZipScore fields. Uses `corporate_share_pct * total_gp_locations` for more accurate corporate count when available.
7. **City practice tree** — `city-practice-tree.tsx` loadPractices() now paginates within each ZIP chunk (100 ZIPs per chunk, 1000 rows per page) to avoid Supabase's 1000-row default limit.
8. **Consolidation map** — `consolidation-map.tsx` now computes consolPct and pctUnknown from existing ZipScore fields instead of referencing non-existent `consolidation_pct_of_total`, `pct_unknown`, `data_confidence` fields.
9. **Opportunity signals icons** — Now uses Lucide JSX: `<Clock />`, `<Calendar />`, `<Target />`, `<RefreshCw />`, `<Pencil />`, `<MapPin />`, `<AlertCircle />`
10. **DSO penetration city column** — `ownership-landscape.tsx` now accepts `watchedZips` prop, builds city lookup map, shows actual city names. Also filters to only show ZIPs where `corporate_share_pct > 0` and sorts descending.
11. **Job Market enrichment count** — `job-market/page.tsx` now uses `.not('data_axle_import_date', 'is', null)` instead of `.like('import_batch_id', 'DA_%')`. Shows 2,992 enriched.
12. **scoring.ts** — `computeJobOpportunityScore()` and `isRetirementRisk()` now use `entity_classification` with `ownership_status` fallback via `isIndependentClassification()` and `isCorporateClassification()`.

## Critical Rules

### Entity Classification Is Primary
- ALWAYS use `entity_classification` (11 values) for ownership analysis, NOT `ownership_status` (legacy 3 values: independent, dso_affiliated, pe_backed)
- Use `classifyPractice()` helper which provides ownership_status fallback for practices missing entity_classification
- "Known Consolidated %" should show ~8-10% (corporate / total), NOT 1.7% (the old ownership_status count)
- Top DSOs charts MUST filter by `isCorporateClassification()` AND exclude `DSO_FILTER_KEYWORDS` from affiliated_dso
- Server-side entity_classification counts are preferred over zip_scores legacy counts for KPIs
- `corporate_share_pct * total_gp_locations` gives entity_classification-based corporate count per ZIP (more accurate than dso_affiliated_count + pe_backed_count)
- scoring.ts uses entity_classification — no need to separately handle ownership_status in components

### Market Intel Transparency
- Consolidation percentages MUST use total practices as denominator (conservative)
- Never use classified_count as denominator for headline KPIs — that inflates numbers
- Always show unknown count when >30% of practices are unclassified
- Labels must say "Known Consolidated" not just "Consolidated"

### Data Integrity
- NPI is the unique key for practices (10-digit number)
- Deal dedup uses fuzzy matching on company name + date
- Data Axle dedup uses address normalization + fuzzy name matching
- Never delete from practices table — only update fields

### Rendering Safety
- DataTable render functions must return primitive values (string | number | null), never objects
- Always handle null/undefined: show "—" in muted color, never "[object Object]" or "null"
- Use `formatStatusLabel()` for inline text rendering, not `formatStatus()` (which returns an object with label + color)
- All DataTable column definitions should have type guards for unexpected object values
- KPI card icons MUST be Lucide JSX components (`<BarChart3 className="h-4 w-4" />`), not strings. String rendering still works but is discouraged.

### Supabase Query Safety
- When querying practices by ZIP codes, ALWAYS paginate with `.range()` — Supabase returns max 1000 rows per query
- For large result sets, chunk ZIP arrays (100 ZIPs per chunk) and paginate within each chunk (1000 rows per page)

### TypeScript
- Run `npm run build` after every change to verify TypeScript compilation
- All Supabase query functions accept a `SupabaseClient` parameter
- Practice interface has all fields including entity_classification — no need for `as unknown as Record<string, unknown>` casting hacks

## Shared Components

### Data Display
- `DataTable` — TanStack React Table wrapper with sorting, pagination, CSV export
- `KpiCard` — Metric card with icon, label, value, helper text, accent border
- `StatusBadge` / `StatusDot` — Ownership/entity classification indicators
- `ConfidenceStars` — Star rating (1-5) for classification confidence
- `DataFreshnessBar` — Progress bar for data completeness
- `SectionHeader` — Page section titles with Lucide icons

### Charts (Recharts wrappers)
- `BarChart`, `StackedBarChart`, `GroupedBarChart`
- `DonutChart`, `AreaChart`, `ScatterChart`, `HistogramChart`
- `ChartContainer` — Responsive wrapper

### Layout
- `Sidebar` — Left nav, collapsible (220px → 60px), dark theme
- `StickySectionNav` — Sticky tab navigation for page sections

### Filters
- `FilterBar`, `MultiSelect`, `DateRangePicker`, `SearchInput`

## Design System

### Colors (src/lib/constants/design-tokens.ts)
```
Background: #0A0F1E (deepest), #0F1629 (cards), #1A2035 (elevated)
Borders: #1E293B (subtle), #334155 (emphasis)
Text: #F8FAFC (primary), #94A3B8 (secondary), #64748B (muted)

Semantic:
  Green  #22C55E — independent, opportunity, positive
  Red    #EF4444 — corporate, PE-backed, risk
  Amber  #F59E0B — DSO-affiliated, moderate, warning
  Purple #A855F7 — specialist
  Blue   #3B82F6 — primary accent, links, interactive
  Gray   #64748B — unknown, insufficient data
```

### KPI Cards
- 3px accent border (left side)
- 32px JetBrains Mono bold values
- Subtle background tinting via `color-mix(in srgb, ${accentColor} 4%, #0F1629)`
- Icons MUST be Lucide JSX components (e.g., `<BarChart3 className="h-4 w-4" />`)

### DataTable
- Header row: `bg-[#0D1424]`, `font-semibold`, `text-[#94A3B8]`, `border-b-2`
- Alternating rows: `bg-[#0A0F1E]` / `bg-[#0F1629]`

### Maps
- Both consolidation map and practice density map have `boxShadow: '0 0 40px rgba(59, 130, 246, 0.08), 0 4px 24px rgba(0, 0, 0, 0.3)'`

### Typography
- Page titles: 24px DM Sans/Inter semibold
- KPI values: 32px JetBrains Mono bold
- KPI labels: 11px Inter uppercase tracking-wider
- Table headers: 11px Inter uppercase
- Table body: 13px Inter

### Fonts (loaded via next/font in layout.tsx)
- `--font-heading` → DM Sans
- `--font-sans` → Inter
- `--font-mono` → JetBrains Mono

## File Quick Reference

| File | What It Does |
|------|-------------|
| `src/app/layout.tsx` | Root layout — fonts, providers (Query, Sidebar, Tooltip), sidebar |
| `src/app/page.tsx` | Home page server component — fetches stats, deals, freshness |
| `src/app/globals.css` | Tailwind 4 + CSS custom properties + dark theme |
| `src/lib/types/index.ts` | All TypeScript interfaces (Deal, Practice, ZipScore with `city: string \| null`, etc.) |
| `src/lib/supabase/client.ts` | Browser Supabase client (singleton) |
| `src/lib/supabase/server.ts` | Server Supabase client (per-request) |
| `src/lib/supabase/types.ts` | Full Supabase table type definitions |
| `src/lib/constants/entity-classifications.ts` | 11 entity types, helpers, classification logic |
| `src/lib/constants/design-tokens.ts` | Color system, ownership labels/colors |
| `src/lib/constants/colors.ts` | Entity classification color map |
| `src/lib/constants/living-locations.ts` | 4 Chicagoland living presets with ZIP arrays |
| `src/lib/utils/formatting.ts` | formatNumber, formatCurrency, formatPercent, formatDate, etc. |
| `src/lib/utils/scoring.ts` | computeJobOpportunityScore, isRetirementRisk, getPracticeAge |
| `src/lib/utils/csv-export.ts` | CSV download utility |
| `src/lib/hooks/use-url-filters.ts` | URL search params sync for shareable filter state |
| `src/components/data-display/data-table.tsx` | TanStack Table with sort, filter, paginate |
| `src/components/data-display/kpi-card.tsx` | KPI metric card component |
| `src/components/layout/sidebar.tsx` | Collapsible left navigation |
| `src/components/layout/sticky-section-nav.tsx` | Sticky tab navigation |
| `src/components/charts/*.tsx` | 8 Recharts wrapper components |
| `src/providers/query-provider.tsx` | React Query setup (5min stale, 30min gc) |

### Per-Page Components
| Page | Shell File | Key Components |
|------|-----------|----------------|
| Home | `_components/home-shell.tsx` | Nav cards, recent deals, freshness bar |
| Deal Flow | `deal-flow/_components/deal-flow-shell.tsx` | deal-kpis, deal-volume-timeline, specialty-charts, sponsor-platform-charts, state-choropleth, deals-table |
| Market Intel | `market-intel/_components/market-intel-shell.tsx` | consolidation-map, saturation-table, zip-score-table, city-practice-tree, recent-changes, ada-benchmarks |
| Buyability | `buyability/_components/buyability-shell.tsx` | Practice table with buyability scores, filters |
| Job Market | `job-market/_components/job-market-shell.tsx` | living-location-selector, practice-density-map, market-overview-charts, practice-directory, opportunity-signals, ownership-landscape, market-analytics, practice-detail-drawer |
| Research | `research/_components/research-shell.tsx` | sponsor-profile, platform-profile, state-deep-dive, sql-explorer |
| System | `system/_components/system-shell.tsx` | freshness-indicators, data-coverage, completeness-bars, pipeline-log-viewer, manual-entry-forms |

### Updated Component Props
- `MarketIntelShellProps` now includes `classificationCounts: { total: number, corporate: number, independent: number, unknown: number }`
- `OwnershipLandscapeProps` now includes `watchedZips: WatchedZip[]`
- `KpiCardProps.icon` accepts `React.ReactNode` (Lucide JSX) — string rendering still works but is discouraged

## Data Pipeline (Separate Repo)

The Python scraper pipeline lives in the parent repo (`dental-pe-tracker/scrapers/`). It runs weekly via cron:

1. Backup DB → 2. PESP scraper → 3. GDN scraper → 4. PitchBook importer → 5. ADSO scraper → 6. ADA HPI downloader → 7. DSO classifier → 8. Merge & score → 9. Sync to Supabase

Step 9 (`sync_to_supabase.py`) pushes changes incrementally from local SQLite to Supabase Postgres. Three sync strategies: incremental_updated_at (practices), incremental_id (deals, changes), full_replace (zip_scores, watched_zips, etc.).

Monthly NPPES refresh (first Sunday 6am): downloads federal provider data updates.

## Development

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # TypeScript check + production build
npm start       # Production server
npm run lint    # ESLint
```
