# Cross-Page KPI Audit Handoff — 2026-04-26

**Status:** Original session shipped + verified live. **An independent coder/analyst is asked to (a) re-audit the work documented here, (b) re-audit any fixes they themselves apply, and (c) investigate a residual numeric anomaly that this session did NOT fully resolve.**

**Author session:** Claude Opus 4.7 (1M context), invoked at /Users/suleman/dental-pe-tracker/dental-pe-nextjs

---

## Part 1 — ELI5 (plain English)

### What was wrong

Imagine your dashboard showed completely different numbers on each page for the same neighborhood. Like Yelp says there are 50 restaurants in your zip code, Google Maps says 200, and DoorDash says 80. That was happening across our 6 pages.

Two root causes:

1. **NPI vs clinic confusion.** The federal database (NPPES) gives one ID number to each individual dentist AND a separate ID to each dental-office entity. A single clinic with 3 dentists shows up as 4 entries (3 person-IDs + 1 office-ID). When we counted "practices in Chicagoland," we were counting these duplicates ~2.7× more than reality.
2. **Each page defined "Chicagoland" differently.** Job Market thought Chicagoland = West Loop only (142 ZIPs). Home thought it = all 290 watched ZIPs (which secretly included Boston!). Launchpad and Warroom each had their own definitions. So even when the math was right, every page was answering a different question.

### What I fixed (plain English)

| Page | Before | After |
|---|---|---|
| Home | Showed inflated practice count, included Boston in "Chicagoland" | Shows 4,889 GP clinics (location-deduped) with NPI subtitle |
| Job Market | Defaulted to West Loop (142 ZIPs) — disagreed with everything | Defaults to All Chicagoland (269 ZIPs) — matches everyone |
| Market Intel | OK already | Unchanged |
| Buyability | Showed a global 500-row sample ignoring scope entirely | Filtered to watched ZIPs — 308 acquisition targets, 87 dead ends |
| Launchpad | "0 best-fit / 0 hiring" — broken; headline showed inflated NPI count | 1,380 best-fit, 104 hiring; headline shows 4,575 GP clinics |
| Warroom Hunt | Listed 14k duplicate prospects (same office 2-3 times) | Lists 5,491 unique locations (dedup helper now wired in) |
| Warroom Sitrep | Crashed with "Signal layer unavailable" timeout | Healthy — chunked the query at 50 ZIPs to dodge Supabase's 8-second timeout |

### What still needs investigation (the user's question)

> "How are you tracking 14,000 practices if only ~5,500 practices exist in Chicagoland — and Dentagraphics, the gold standard, says there are only 3,900 practices in ALL of Illinois?"

This is the real puzzle. Even after dedup, we show ~4,500–5,500 GP clinics in Chicagoland. But Dentagraphics says all of Illinois (Chicago + downstate + rural) totals 3,900. So either:
- NPPES over-represents reality (counts inactive providers, hygiene-only sites, mailing-address entities)
- Our location-dedup is still too generous
- Dentagraphics uses a stricter definition we should adopt
- We're including specialists or non-clinical entities in the "GP" bucket

This is the auditor's primary investigation target. Details in Part 3.

---

## Part 2 — Engineer-grade detailed report (specific files, lines, commits)

### Repo

- Frontend: https://github.com/suleman7-DMD/dental-pe-nextjs (Next.js 16 + Supabase + Vercel)
- Pipeline: https://github.com/suleman7-DMD/dental-pe-tracker (Python scrapers + SQLite → Supabase sync)
- Live URL: https://dental-pe-nextjs.vercel.app
- Production deploy at time of writing: `dpl_nSdvkjofARjt9ukxYbktq5dKTe4N` (alias `dental-pe-nextjs.vercel.app`)

### Commit chain (4 commits, all on `main`, all live in production)

| SHA | Subject | Files touched |
|---|---|---|
| `0e67fc5` | fix(kpi-consistency): align Job Market, Buyability, Launchpad, and Warroom on watched-ZIP + location-deduped scope | 7 files |
| `40f7056` | docs(claude.md): lock in 2026-04-26 cross-page KPI audit fixes — do not regress | `dental-pe-nextjs/CLAUDE.md` |
| `9e3375c` | fix(warroom): chunk practice_signals query to 50 ZIPs to dodge Supabase 8s statement_timeout | 2 files |
| `bb9d56f` | docs(claude.md): record live deploy verification for 2026-04-26 KPI audit | `dental-pe-nextjs/CLAUDE.md` |

Reproduce locally:
```bash
cd /Users/suleman/dental-pe-tracker/dental-pe-nextjs
git log --oneline 0e67fc5^..bb9d56f
git show 0e67fc5 --stat
git show 9e3375c --stat
```

### File-by-file change log

**`0e67fc5` — primary KPI consistency fix (7 files)**

| File:Line | Bug | Fix |
|---|---|---|
| `src/app/job-market/page.tsx` (`defaultLocationKey` resolution) | `Object.keys(LIVING_LOCATIONS)[0]` silently returned `"West Loop / South Loop"` (142 ZIPs). Job Market's KPIs disagreed with every other "Chicagoland" surface | Explicit `LIVING_LOCATIONS["All Chicagoland"]` lookup → 269 ZIPs |
| `src/lib/supabase/queries/practices.ts` (`getBuyabilityPractices`) | Fetched a global 500-row sample, no scope filter | Added optional `zips?: string[]` param; when provided, applies `.in("zip", zips)`. Backward compatible |
| `src/app/buyability/page.tsx` | Called `getBuyabilityPractices()` with no scope — global random 500 rows | Now calls `getWatchedZips()` first and threads the ZIP set into `getBuyabilityPractices(supabase, { zips })` |
| `src/lib/launchpad/signals.ts` (`LaunchpadSummary` interface) | No location-deduped count field — KPI strip showed raw NPI | Added `totalGpLocations: number \| null` with docstring |
| `src/lib/supabase/queries/launchpad.ts` (`getLaunchpadBundle`) | No location-deduped sum | Sums `total_gp_locations` from already-fetched `zipScores` (no extra query). Returns `null` when no scope ZIP has a row in `zip_scores` |
| `src/app/launchpad/_components/launchpad-kpi-strip.tsx` (first KPI card) | Headline was raw NPI count (~11,894) | Headline is `totalGpLocations` (4,575); subtitle reads "X NPI rows" |
| `src/lib/supabase/queries/warroom.ts` (`getScopedPractices`) | `dedupPracticesByLocation()` helper existed in the file but was never called — Hunt list shipped 14k NPI rows | Wired the helper after polygon filter, before sort/slice. Hunt list now ships ~5.5k deduped rows |

**`9e3375c` — Warroom signal layer chunking fix (2 files)**

| File:Line | Bug | Fix |
|---|---|---|
| `src/lib/supabase/queries/warroom.ts` (`PaginationOptions`, `fetchRowsByZipScope`) | `ZIP_FILTER_CHUNK_SIZE = 200` sent ~10k rows × 40 columns per chunk for All Chicagoland; hit Supabase free-tier 8s `statement_timeout` | Added optional `chunkSize?: number` to `PaginationOptions`; `fetchRowsByZipScope` uses `options.chunkSize ?? ZIP_FILTER_CHUNK_SIZE` |
| `src/lib/warroom/data.ts` (`loadSignalsSafely`) | Inherited 200-ZIP chunks; Sitrep banner crashed with "Signal layer unavailable: canceling statement due to statement timeout" | `getScopedPracticeSignals(scope, { chunkSize: 50 }, supabase)` — 50-ZIP chunks finish well under 8s |

### Live verification (commit `bb9d56f` documents the same)

Performed via `curl https://dental-pe-nextjs.vercel.app/<page>` + Python regex over the served HTML to extract 28px-font KPI values (the JetBrains-Mono headline numbers).

| Page | Scope | Headline | NPI count | Other KPIs |
|---|---|---:|---:|---|
| Home | 290 watched ZIPs (Chicago + Boston) | **4,889 GP clinics** | 14,053 | 254 retirement risk · 22 acquisition targets · 2,861 deals · 1.7% corporate · last deal 2026-03-02 |
| Job Market | 269 Chicagoland (default fixed) | 14,053 NPIs | 14,053 | All Chicagoland default resolved correctly |
| Market Intel | 269 Chicagoland | 14,053 NPIs | 14,053 | matches Job Market |
| Warroom Hunt | 269 Chicagoland | **5,491 deduped** | 14,053 | dedup helper live |
| Warroom Sitrep | 269 Chicagoland | n/a | n/a | `signalsAvailable: true`, `warnings: []` (verified by parsing RSC payload for `signalsError\":null`) |
| Launchpad | 269 Chicagoland (excl specialists/non-clinical) | **4,575 GP clinics** | 11,894 | 1,380 best-fit · 144 mentor-rich · 104 hiring · 41 avoid-tier |
| Buyability | watched ZIPs | 308 acq targets | 1,000 (Supabase page cap) | 87 dead ends · 531 jobs · 74 specialists |

The 4,575 ↔ 4,889 ↔ 5,491 GP-location variance is **intentional**: Home includes Boston, Launchpad excludes specialists+non-clinical, Warroom dedups by `(normalized_address, zip)` only with no taxonomy filter.

### Documentation locked in

- `dental-pe-nextjs/CLAUDE.md` lines 424–456: "2026-04-26 Cross-Page KPI Audit" section with file fix table + Headline-denominator policy + Scope-default policy
- `dental-pe-nextjs/CLAUDE.md` lines 457+: "Live deploy verification" sub-section with the verified-numbers table

### Vercel deploy proof

```bash
$ vercel inspect https://dental-pe-nextjs.vercel.app
  id      dpl_nSdvkjofARjt9ukxYbktq5dKTe4N
  target  production
  status  ● Ready
  url     dental-pe-nextjs-27vqchg1q-suleman7-dmds-projects.vercel.app
  created Sun Apr 26 2026 00:45:35 GMT-0400 [matches commit 9e3375c at 00:45:32]
  Aliases:
    - dental-pe-nextjs.vercel.app
    - dental-pe-nextjs-git-main-suleman7-dmds-projects.vercel.app
```

All 6 pages return HTTP 200 (`curl -o /dev/null -w "%{http_code}\n"`).

---

## Part 3 — Handoff prompt for the independent coder/analyst

### Your dual mandate

You are being brought in as an independent reviewer to:

1. **Audit your own fixes** (whatever you ship in this engagement). Apply the same discipline you'd apply to mine: file paths, line numbers, before/after numeric evidence from the live deploy, regression-rule entries in `CLAUDE.md`.
2. **Re-audit my work** documented in Parts 1 & 2 above. Don't trust my self-report. Pull each commit (`0e67fc5`, `40f7056`, `9e3375c`, `bb9d56f`), read the diffs, walk the code paths, and confirm the numbers I claim are still live. If anything has drifted or I missed a code path, flag it in a follow-up commit.
3. **Investigate the residual anomaly** below. This is the customer's actual outstanding concern and was NOT resolved by my session.

### The numeric anomaly to investigate

Customer's verbatim question:

> *"How are you tracking 14,000 practices if only about 5.5k practices exist in Chicagoland? Also Dentagraphics — the gold standard — says there are 3,900 practices in all of Illinois. What the hell is going on with the crazy wonky numbers?"*

Numbers in play (what we currently surface):
- 14,053 NPI rows in 290 watched ZIPs (`SELECT COUNT(*) FROM practices WHERE zip IN (SELECT zip_code FROM watched_zips)`)
- 11,894 NPI rows in 269 Chicagoland ZIPs (excludes Boston)
- 5,732 location rows in `practice_locations` (Supabase, watched ZIPs only)
- 5,265 GP clinic locations from `SUM(zip_scores.total_gp_locations)` (per CLAUDE.md, may have drifted — verify)
- 4,889 GP clinics on Home page (live)
- 4,575 GP clinics on Launchpad (Chicagoland-only, excludes specialists)
- 5,491 deduped practices on Warroom Hunt list (Chicagoland)
- **3,900: Dentagraphics's count of dental practices in ALL OF ILLINOIS** (customer asserts this is the gold standard)

The arithmetic that needs explaining: even our most-aggressive dedup (4,575) for *Chicagoland alone* exceeds Dentagraphics's count for *the entire state*. That's a >1.17× overcount in just one metro.

### Hypotheses to test (suggested, not exhaustive)

1. **NPPES inactive providers.** NPPES doesn't auto-prune dentists who retired or moved out of state. Check: how many practices in our `practices` table have `data_source='NPPES'` AND no record of activity in the last 5 years? Is there a `last_updated` field we should be filtering on?
2. **NPI-2 organization rows still leaking.** The dedup is supposed to collapse NPI-1 (provider) + NPI-2 (organization) at the same address. Is `dedupPracticesByLocation()` in `src/lib/supabase/queries/warroom.ts` actually catching every case? Spot-check 10 random Chicagoland ZIPs: does the dedup count match `SELECT COUNT(DISTINCT normalized_address) FROM practice_locations WHERE zip_code = '<zip>'`?
3. **Suite/floor address variants.** "123 Main St Suite 4" vs "123 Main St #4" vs "123 Main Street, 4th Floor" — are these all collapsing? Look at `normalize_address()` in `scrapers/dso_classifier.py` (or wherever location normalization lives) and run a sample.
4. **Hygiene-only / mailing-address NPIs.** Dentagraphics likely counts only dental *offices*. NPPES gives NPIs to dental hygienists, denturists, dental therapists, lab-only entities. Check: what fraction of our 14,053 watched-ZIP NPIs have taxonomy codes that are NOT general dentistry (`122300000X`)?
5. **Specialists slipping into GP count.** `merge_and_score.py::compute_saturation_metrics()` claims to count GP-only locations. Is it actually filtering by `entity_classification != 'specialist'` AND by taxonomy code? Check the SQL.
6. **Dentagraphics methodology.** Pull their public methodology page and figure out their unit-of-count. Is it "physical dental offices with 1+ general dentist"? "Practices with active billing in Medicare/Medicaid"? Their definition determines whether we should match it or just acknowledge a definitional gap.
7. **Watched-ZIP boundary.** Our 269 Chicagoland ZIPs may be a much wider catchment than what Dentagraphics calls "Chicagoland" (or than reasonable people would). 269 ZIPs is geographically huge. Verify the ZIP list against a published Chicago metro definition (e.g., the Chicago-Naperville-Elgin MSA).

### Concrete first commands

```bash
# from /Users/suleman/dental-pe-tracker (parent repo, has SQLite + scrapers)

# 1. NPI-row breakdown by entity_classification in watched ZIPs
sqlite3 data/dental_pe_tracker.db "
  SELECT entity_classification, COUNT(*) AS npi_rows
  FROM practices
  WHERE zip IN (SELECT zip_code FROM watched_zips)
  GROUP BY entity_classification
  ORDER BY npi_rows DESC;"

# 2. How many of those NPI rows are NPI-2 (organizations) vs NPI-1 (providers)?
sqlite3 data/dental_pe_tracker.db "
  SELECT entity_type, COUNT(*) FROM practices
  WHERE zip IN (SELECT zip_code FROM watched_zips)
  GROUP BY entity_type;"

# 3. Distinct locations after the location-dedup pipeline ran
sqlite3 data/dental_pe_tracker.db "
  SELECT COUNT(DISTINCT location_id) FROM practice_locations
  WHERE zip_code IN (SELECT zip_code FROM watched_zips);"

# 4. Of those locations, how many are GP-only?
sqlite3 data/dental_pe_tracker.db "
  SELECT entity_classification, COUNT(*) FROM practice_locations
  WHERE zip_code IN (SELECT zip_code FROM watched_zips)
  GROUP BY entity_classification;"

# 5. Sum of zip_scores.total_gp_locations vs distinct practice_locations
sqlite3 data/dental_pe_tracker.db "
  SELECT
    (SELECT SUM(total_gp_locations) FROM zip_scores WHERE zip_code IN (SELECT zip_code FROM watched_zips)) AS sum_zip_scores,
    (SELECT COUNT(DISTINCT location_id) FROM practice_locations WHERE zip_code IN (SELECT zip_code FROM watched_zips)) AS distinct_locations;"

# 6. Sample 20 random Chicagoland addresses to eyeball-verify the normalization
sqlite3 data/dental_pe_tracker.db "
  SELECT zip_code, normalized_address, provider_count
  FROM practice_locations
  WHERE zip_code LIKE '606%'
  ORDER BY RANDOM()
  LIMIT 20;"
```

### Self-audit checklist (you must complete before signing off)

- [ ] Read every commit listed in Part 2's commit chain and verify the diffs match the file-by-file change log
- [ ] Re-run the live verification from Part 2 (`curl` + KPI extraction) and confirm the numbers haven't drifted
- [ ] Run the SQL queries above and document the actual breakdown of 14,053 → location-deduped → GP-only → specialists-excluded
- [ ] Compare to Dentagraphics methodology and document either (a) the legitimate definitional gap or (b) the over-count we need to fix
- [ ] If you find an over-count, ship a fix with the same discipline: small commits, regression rules in `CLAUDE.md`, live verification, before/after numbers
- [ ] If you find no over-count and conclude NPPES is fundamentally inflated relative to Dentagraphics, document a "Methodology note" subtitle on the Home + Job Market + Launchpad GP-clinic KPI cards explaining the gap so users aren't blindsided
- [ ] Audit your own work using the same checklist before declaring victory

### What "done" looks like

A commit (or chain of commits) on `main` with:
1. A file-by-file table like Part 2's, in `dental-pe-nextjs/CLAUDE.md`, documenting whatever you found and changed
2. Live numeric verification (extract the new KPI values from `curl https://dental-pe-nextjs.vercel.app/...`)
3. A clear answer to the customer's question: "We show X clinics in Chicagoland because [definition]. Dentagraphics shows Y because [their definition]. The reconciled count under the same definition is Z."
4. Either a UI change that surfaces the reconciled number, OR a methodology note that explains the gap
5. A regression rule added to `CLAUDE.md` so the next agent doesn't re-introduce the issue

### Files most likely to need changes

- `dental-pe-nextjs/src/lib/supabase/queries/practices.ts` — `getPracticeStats`, `getBuyabilityPractices`, the location-dedup queries
- `dental-pe-nextjs/src/lib/supabase/queries/warroom.ts` — `getScopedPractices`, `dedupPracticesByLocation`, `locationDedupKey`
- `dental-pe-nextjs/src/lib/supabase/queries/launchpad.ts` — `getLaunchpadBundle` zip-score sum
- `dental-pe-tracker/scrapers/merge_and_score.py` — `compute_saturation_metrics`, `total_gp_locations` derivation
- `dental-pe-tracker/scrapers/dso_classifier.py` — Pass 3 entity classification, address normalization
- `dental-pe-tracker/scrapers/database.py` — `practice_locations` table schema, `practice_to_location_xref`

### Coordination notes

- A parallel session is occasionally active in this repo (commits `2b16848`, `547d575`, etc.). Don't assume any commit on `main` is mine. Check `git log --author=...` or read commit subjects to triage ownership.
- `CLAUDE.md` is a high-traffic file. Read it fully before editing. Several "Do Not Regress" tables already exist; add yours as a new section, don't restructure existing ones.
- `practice_signals` and `zip_signals` sync from SQLite to Supabase via `scrapers/sync_to_supabase.py`. As of 2026-04-26, `zip_signals` had 0 rows in Supabase but 290 in SQLite (sync gap — see CLAUDE.md). Don't get tripped up by missing zip-level flags.

### One more thing

If you discover the over-count is real and we need to filter more aggressively (e.g., drop NPI-2 organization rows entirely, or only count NPIs with a recent NPPES update timestamp), the change will reduce the headline numbers across **all 6 pages**. That's fine — it's the right thing — but make sure you (a) document the before/after numbers clearly, (b) explain the methodology shift in user-facing copy on at least Home and Launchpad, and (c) cross-link to whatever doc explains the new definition. Customers notice when numbers move.

Good luck. Be skeptical of everything, including this handoff.
