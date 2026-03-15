# Dental PE Intelligence Platform

A market intelligence dashboard tracking private equity consolidation in US dentistry. Built with Next.js 16, Supabase, and deployed on Vercel.

Monitors 400,962 dental practices across 290 markets, 2,500+ PE deals, and provides acquisition risk scoring, market saturation analysis, and career opportunity intelligence.

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
| `/` | Home | Navigation hub with key stats and recent deals |
| `/deal-flow` | Deal Flow | PE deal tracking — timeline, sponsors, platforms, state map, deal table |
| `/market-intel` | Market Intel | ZIP-level consolidation — saturation metrics, ownership maps, practice changes |
| `/buyability` | Buyability | Acquisition target scoring — searchable practice list with confidence ratings |
| `/job-market` | Job Market | Career opportunity finder — density maps, practice directory, retirement risk signals |
| `/research` | Research | Deep dives — sponsor profiles, platform profiles, state analysis, SQL explorer |
| `/system` | System | Pipeline health — data freshness, completeness, logs, manual entry forms |

## Data Sources

| Source | Records | What It Provides |
|--------|---------|-----------------|
| NPPES (CMS) | 400k+ practices | Federal dental provider registry — NPI, name, address, taxonomy |
| Data Axle | 2,992 enriched | Revenue, employees, year established, lat/lon, parent company, EIN |
| PESP | ~1,200 deals | PE deal announcements from activist research org |
| GDN | ~800 deals | DSO deal roundups from industry publication |
| PitchBook | ~500 deals | PE deal data from financial research platform |
| ADSO | 408 locations | DSO office locations scraped from member websites |
| ADA HPI | 918 benchmarks | State-level DSO affiliation rates by career stage |
| Census ACS | 279 ZIPs | Population and median household income by ZIP |

## Entity Classification System

11-type classification system for dental practices (replaces legacy 3-value `ownership_status`):

**Solo Practices:** solo_established, solo_new, solo_inactive, solo_high_volume
**Group Practices:** family_practice, small_group, large_group
**Corporate:** dso_regional, dso_national
**Other:** specialist, non_clinical

Assigned by the DSO classifier using provider count, last name matching, taxonomy codes, corporate signals (parent company, EIN clustering, franchise field), and Data Axle enrichment data.

## Market Metrics

- **DLD (Dentist Location Density):** GP offices per 10,000 residents (national avg ~6.1)
- **Buyable Practice Ratio:** % of GP offices that are solo_established, solo_inactive, or solo_high_volume
- **Corporate Share:** % of GP offices classified as dso_regional or dso_national
- **Market Type:** 9 classifications (e.g., corporate_dominant, growing_undersupplied, balanced_mixed)
- **Buyability Score:** 0-100 acquisition likelihood per practice

## Primary Metro Coverage

**Chicagoland** (268 ZIPs across 7 sub-zones): West Loop/South Loop, Woodridge, Bolingbrook, Naperville, Schaumburg, Joliet, Aurora
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

Push to `main` → Vercel auto-deploys.

## Data Pipeline

The Python scraper pipeline (separate repo: `dental-pe-tracker/scrapers/`) populates Supabase:

1. **Weekly cron** (Sunday 8am): Scrape PESP, GDN → Classify DSOs → Score ZIPs → Sync to Supabase
2. **Monthly** (first Sunday 6am): Download NPPES federal provider data updates
3. **Manual**: Data Axle CSV imports, PitchBook deal imports

Sync uses incremental strategies — only changed rows are pushed to Supabase.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # Route handlers (deals, practices, sql-explorer)
│   ├── deal-flow/          # Deal tracking page + components
│   ├── market-intel/       # Market analysis page + components
│   ├── buyability/         # Acquisition scoring page + components
│   ├── job-market/         # Career opportunities page + components (most complex)
│   ├── research/           # Deep dive page + components
│   └── system/             # System health page + components
├── components/
│   ├── charts/             # Recharts wrappers (bar, donut, scatter, histogram, etc.)
│   ├── data-display/       # DataTable, KpiCard, StatusBadge, ConfidenceStars
│   ├── filters/            # FilterBar, MultiSelect, DateRangePicker, SearchInput
│   ├── layout/             # Sidebar, StickySectionNav
│   ├── maps/               # Mapbox GL container
│   └── ui/                 # shadcn base components
├── lib/
│   ├── constants/          # Entity classifications, colors, design tokens, locations
│   ├── hooks/              # useSidebar, useUrlFilters, useSectionObserver
│   ├── supabase/           # Client setup + query functions (deals, practices, zips, etc.)
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Formatting, scoring, CSV export
└── providers/              # React Query + Sidebar context providers
```
