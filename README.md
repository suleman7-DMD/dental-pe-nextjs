# Dental PE Intelligence Platform

A market intelligence dashboard tracking private equity consolidation in US dentistry. Built with Next.js 16, Supabase, and deployed on Vercel.

**Live:** https://dental-pe-nextjs.vercel.app

Monitors **400,962 dental practices** across **290 markets**, **2,512 PE deals**, and provides acquisition risk scoring, market saturation analysis, and career opportunity intelligence for the Chicagoland and Boston metro areas.

## Stack

- **Frontend:** Next.js 16 (App Router, React 19, TypeScript 5)
- **Database:** Supabase (Postgres)
- **Styling:** Tailwind CSS 4 + shadcn UI
- **Charts:** Recharts 3
- **Maps:** Mapbox GL
- **Tables:** TanStack React Table
- **State:** TanStack React Query + URL params
- **Deploy:** Vercel (auto-deploy on push to `main`)

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Home** | 8 KPI cards (deals, sponsors, practices, corporate %, retirement risk, YTD), 6 navigation cards, recent deals, data freshness |
| `/deal-flow` | **Deal Flow** | 2,512 PE deals — timeline, top sponsors/platforms, state choropleth, searchable table with CSV |
| `/market-intel` | **Market Intel** | Tiered consolidation analysis (high-confidence ~2.3% vs all-signals ~9.9%), DSO penetration table, ZIP scores, city practice tree, consolidation map, ownership breakdown with per-classification counts |
| `/buyability` | **Buyability** | Data-driven acquisition scoring — 4 category KPIs (Acquisition Targets, Dead Ends, Job Targets, Specialists), 25-row paginated table with filters |
| `/job-market` | **Job Market** | Career opportunity finder — living location selector, density maps, practice directory with 4 tabs, retirement risk signals, DSO penetration |
| `/research` | **Research** | Deep dives — PE sponsor profiles, platform profiles, state analysis, SQL explorer with presets |
| `/system` | **System** | Pipeline health — data source coverage, freshness timestamps, completeness bars, pipeline logs, manual entry forms |

## Key Data

| Source | Records | What It Provides |
|--------|---------|-----------------|
| NPPES (CMS) | 400,962 practices | Federal dental provider registry — NPI, name, address, taxonomy |
| Data Axle | 2,992 enriched | Revenue, employees, year established, lat/lon, parent company, EIN |
| PESP | ~1,200 deals | PE deal announcements from activist research org |
| GDN | ~800 deals | DSO deal roundups from industry publication |
| PitchBook | ~500 deals | PE deal data from financial research platform |
| ADSO | 408 locations | DSO office locations scraped from member websites |
| ADA HPI | 918 benchmarks | State-level DSO affiliation rates by career stage (2022-2024) |
| Census ACS | 279 ZIPs | Population and median household income by ZIP |

## Entity Classification

11-type classification system for dental practices (replaces legacy 3-value `ownership_status`):

| Category | Types | Count (watched ZIPs) |
|----------|-------|---------------------|
| **Solo** | solo_established, solo_new, solo_inactive, solo_high_volume | 4,908 |
| **Group** | family_practice, small_group, large_group | 5,364 |
| **Corporate** | dso_regional, dso_national | 1,392 |
| **Other** | specialist, non_clinical | 2,363 |

### Tiered Consolidation

Analysis on 2026-03-15 revealed that **92% of dso_regional** classifications were triggered by shared phone numbers alone — a weak signal that often just means multiple dentists at the same address, not a DSO.

| Tier | Count | % of 14,027 | Signal |
|------|-------|-------------|--------|
| **High-confidence corporate** | 328 | **2.3%** | Real DSO brands + EIN clusters + DSO specialists |
| **Including phone signals** | 1,392 | **9.9%** | Adds 1,091 practices sharing a phone # |

The dashboard shows both tiers: primary KPI at 2.3%, secondary note at 9.9% with explanation. Phone-only dso_regional practices are queued for reclassification back to small_group/large_group.

## Market Metrics

- **DLD (Dentist Location Density):** GP offices per 10,000 residents (national avg ~6.1)
- **Buyable Practice Ratio:** % of GP offices that are solo_established, solo_inactive, or solo_high_volume
- **Corporate Share:** % of GP offices classified as dso_regional or dso_national
- **Market Type:** 9 classifications (e.g., corporate_dominant, growing_undersupplied, balanced_mixed)
- **Buyability Score:** 0-100 acquisition likelihood per practice
- **Retirement Risk:** 226 independent practices established before 1995

## Metro Coverage

**Chicagoland** (269 ZIPs across 7 sub-zones): West Loop/South Loop, Woodridge, Bolingbrook, Naperville, Schaumburg, Joliet, Aurora
**Boston Metro** (21 ZIPs)

## Setup

### Prerequisites
- Node.js 18+
- Supabase project with populated database
- Mapbox access token

### Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

### Install & Run

```bash
npm install
npm run dev     # http://localhost:3000
```

### Build & Deploy

```bash
npm run build   # TypeScript check + production build
npm start       # Production server
```

Push to `main` → Vercel auto-deploys in ~90s.

## Data Pipeline

The Python scraper pipeline (separate repo: `dental-pe-tracker/scrapers/`) populates Supabase:

1. **Weekly cron** (Sunday 8am): Scrape PESP, GDN → Import PitchBook → Scrape ADSO → Download ADA HPI → Classify DSOs → Score ZIPs → Sync to Supabase
2. **Monthly** (first Sunday 6am): Download NPPES federal provider data updates
3. **Manual**: Data Axle CSV imports, PitchBook deal imports

All queries paginated — Supabase's 1000-row default limit is handled throughout. Sync uses incremental strategies — only changed rows are pushed to Supabase.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # Route handlers (deals, practices, sql-explorer, watched-zips)
│   ├── deal-flow/          # Deal tracking page + 6 components
│   ├── market-intel/       # Market analysis page + 4 components
│   ├── buyability/         # Acquisition scoring page + shell
│   ├── job-market/         # Career opportunities page + 9 components (most complex)
│   ├── research/           # Deep dive page + 4 components
│   └── system/             # System health page + 5 components
├── components/
│   ├── charts/             # 8 Recharts wrappers (bar, donut, scatter, histogram, etc.)
│   ├── data-display/       # DataTable, KpiCard, StatusBadge, ConfidenceStars
│   ├── filters/            # FilterBar, MultiSelect, DateRangePicker, SearchInput
│   ├── layout/             # Sidebar, StickySectionNav
│   ├── maps/               # Mapbox GL container
│   └── ui/                 # shadcn base components
├── lib/
│   ├── constants/          # Entity classifications, colors, design tokens, locations
│   ├── hooks/              # useSidebar, useUrlFilters, useSectionObserver
│   ├── supabase/           # Client setup + query functions (all paginated)
│   ├── types/              # TypeScript interfaces (ZipScore: 40+ fields)
│   └── utils/              # Formatting, scoring, CSV export
└── providers/              # React Query + Sidebar context providers
```
