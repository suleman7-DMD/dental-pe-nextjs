# Launchpad — Full Audit & Debug Handoff

## 0. Operating contract (read first, do not negotiate)

You are the sole owner of `/launchpad` until every bug below is fixed AND the user has verified the page is materially better on the live URL `https://dental-pe-nextjs.vercel.app/launchpad`. You operate as a senior solo dev with maximum autonomy. The rules:

1. **Do not stop** until the live URL passes the verification protocol in §7. "It builds" is not done. "It deploys" is not done. "It looks fixed locally" is not done. The bar is: load the live page, click every feature, confirm it works as the user would experience it.
2. **No corner cutting.** Fix at the root cause. If a bug is caused by stale data shape three layers down, fix it three layers down — do not patch the symptom in the UI.
3. **No lying.** If you can't verify something, say so. If a fix is partial, say so. If a feature can't be tested without `ANTHROPIC_API_KEY`, say so AND tell the user what you need from them. The previous session left bugs because reports said "fixed" when only "merged."
4. **Use parallel agents liberally.** Whenever investigation has independent threads (e.g., "audit map" + "audit AI routes" + "audit ranking math"), launch them in parallel via the `Agent` tool with `subagent_type=Explore` for read-only research or `general-purpose` for surgery. Do not serialize independent work.
5. **Verify before reporting.** Trust-but-verify every agent return. Read the actual files they claim to have edited. Run the actual build. Open the actual live URL.
6. **Root-cause every crash.** Stack traces are not optional. If something throws, find which file:line, why, fix it, and add a regression note.
7. **Big picture before small picture.** Every feature on Launchpad serves a single user — a new dental grad picking a first job. If a feature does not serve that picture, fix it so it does, or recommend deletion. Do not preserve dead weight.
8. **You may modify any file in `dental-pe-nextjs/` and any Python in `dental-pe-tracker/scrapers/dossier_batch/` if and only if the bug traces back there. Do not touch the cron pipeline, scrapers, or Supabase schema without explicit confirmation from the user — those are a different blast radius.**

The user explicitly requested: *"deploy multiple parallel agents to do debugging when it's necessary"* and *"not stop working until everything is fixed and the user can verify on the live url that it's meaningfully improved."* That's the contract.

---

## 1. The big picture (what Launchpad is supposed to be)

Launchpad is a **first-job finder for new dental grads**. A grad lands on `/launchpad`, picks a living location (West Loop, Bolingbrook, Boston Core, etc.), picks a track (All / Succession / High-Volume / DSO Associate), and gets a ranked list of dental practices scored 0-100 for that track with explanations. They click any practice → 6-tab dossier with snapshot, comp expectations, mentorship signal, red flags, AI-generated interview questions, and a contract parser.

The data is real:
- **402,004 practices** in NPPES, 14,053 in watched ZIPs (269 Chicagoland + 21 Boston)
- **3,391 practices** have AI-researched `practice_intel` dossiers (891 verified / 2,269 partial / 7 sufficient / 224 insufficient quality)
- **20 signals** drive the scoring (`mentor_density`, `succession_published`, `pe_recap_volatility`, `ffs_concierge`, etc.)
- **3 tracks × signal weights** = composite score (`TRACK_MULTIPLIERS` in `ranking.ts`)
- **5 tiers**: best_fit (80-100) / strong (65-79) / maybe (50-64) / low (35-49) / avoid (0-34)

The user's verbatim diagnosis: *"the launchpad seems to be generally having the data but needs to be thoroughly debugged. It crashes, it's extremely slow … it's just generally extremely buggy. I'm not sure if the data propagation from the API search → launchpad UI is working properly. It's not telling me why something is getting a '100 best fit' so I have no way of verifying anything … the map is totally useless it does not even work, and generally it's just unusable."*

Translation: the data layer works, the UI is failing the user.

---

## 2. User-reported bugs (verbatim, fix all of these)

### 2.1 Crashes
- Page crashes "all the time"
- Symptom unspecified — you'll need to reproduce. Try: load page → switch scope → switch track → open dossier → switch tabs → close dossier → repeat. Use browser DevTools console to capture the actual error. Common Next.js crash causes:
  - React error #31 (object as React child) — DataTable render functions returning objects
  - Null pointer in `track-list-card.tsx` when `practice_intel` is missing
  - Mapbox-related throws when token missing or container not mounted
  - React Query mutation race when track switches mid-fetch

### 2.2 Slow / data load issues on track switching
- Switching All ↔ Succession ↔ High-Volume ↔ DSO is laggy and shows "data load issues"
- **Hypothesis**: track switch is invalidating the React Query cache or re-running `rankTargets()` synchronously on the main thread. The bundle is fetched ONCE per scope and ranking should be O(n) per render — verify this isn't being recomputed per keystroke
- Check `useLaunchpadData` hook — confirm it doesn't refetch on track change (track is a client-side filter/multiplier, not a server param)
- Check `getLaunchpadBundle` — it should return all data needed for all 4 tracks in one call. Track is applied client-side via `scoreForTrack(target, track)`

### 2.3 "Ask Intel" feature doesn't work at all
- The `ask-intel-drawer.tsx` Sheet, triggered from the dossier header
- Most likely cause: **`ANTHROPIC_API_KEY` not set in Vercel**. All 6 Launchpad AI routes return 503 without it. The route file is `src/app/api/launchpad/ask/route.ts`
- Verify: `curl -X POST https://dental-pe-nextjs.vercel.app/api/launchpad/ask -H "Content-Type: application/json" -d '{"question":"test","npi":"1234567890"}'`
  - Expected if key missing: `{"error":"AI Q&A disabled: ANTHROPIC_API_KEY is not set..."}`
  - Expected if key set: `{"answer":"...","model":"claude-haiku-4-5-20251001"}`
- If key IS set and it still 500s, the bug is in `route.ts` — read the request/response handler
- The drawer UI itself may also be broken — check that the form submits, the loading state shows, the error renders, the response renders. Test all 4 paths.

### 2.4 Practice naming bug — "all practices show up as a single provider's name"
- User says: "many are branded as like 'XYZ Dental' so there's no way every single practice on Launchpad is named after one doc"
- This is a **data display bug**, not a data bug — `practice_name` and `doing_business_as` ARE populated in the DB for branded practices. The UI is falling back to `provider_last_name` even when `practice_name` exists.
- Investigation targets:
  - `track-list-card.tsx` — what field is rendered as the title? Should prefer `doing_business_as ?? practice_name ?? "Dr. " + provider_last_name` (in that order)
  - `practice-dossier.tsx` header — same logic
  - Check `getLaunchpadBundle` — is `practice_name` and `doing_business_as` even being SELECTED from Supabase?
  - The NPPES dual-emission pattern (NPI-1 individual + NPI-2 organization at same address) means a building can have both rows; the org row carries the brand name. Check if `getLaunchpadBundle` is preferring NPI-1 over NPI-2, which would systematically lose brand names
- Cross-reference SQLite to confirm: `SELECT npi, practice_name, doing_business_as, provider_last_name FROM practices WHERE zip='60661' LIMIT 20` — there will be rows where `practice_name` is "PARK AVE DENTAL" and `provider_last_name` is "SMITH". The UI should show "Park Ave Dental" not "Dr. Smith"

### 2.5 Track switching not smooth
- Already in 2.2. Possibly compound with re-rendering bug — verify with React DevTools Profiler

### 2.6 No score transparency — "100 best fit" with no explanation
- This is the **biggest UX gap**. The user can't audit why a practice scored what it did.
- The Warroom shipped a score breakdown panel (Phase 3 Proposal C, lives in `src/app/warroom/_components/dossier-drawer.tsx`). Launchpad does NOT have it.
- **You must build a score breakdown for Launchpad.** Show:
  - Base score (50)
  - Each fired signal with its `baseWeight × TRACK_MULTIPLIERS[track][signalId]` contribution
  - Confidence cap (if `hasThinData(target)` triggered the cap at 70)
  - Final score
- Render this in the practice dossier (new tab "Why this score" or expand existing Snapshot tab) AND on the track-list-card on hover/expand
- The math is in `src/lib/launchpad/ranking.ts::scoreForTrack()`. Refactor that function to also return the breakdown (or write a sibling `explainScore()` that returns `{base, contributions: [{signalId, label, baseWeight, multiplier, points}], cap, final}`)

### 2.7 Map is "totally useless, doesn't even work"
- `src/app/launchpad/_components/living-map.tsx`
- Investigation:
  - Is Mapbox token in env? (`NEXT_PUBLIC_MAPBOX_TOKEN`) — verify in Vercel project settings
  - Is the map container mounting? (Mapbox needs a non-zero-height parent div)
  - Is the data layer rendering? Two views: practices (hex density) and ZIPs (choropleth). Both should toggle.
  - Click handler: clicking a hex/ZIP should set `selectedZip` and auto-open the ZIP dossier drawer
  - Lens toggle: 4 lenses (consolidation, density, buyability, retirement) + 2 added in Phase 3 (mentor density, DSO avoid)
- Common Mapbox failures:
  - Token missing → map shows "Mapbox token not set" or blank
  - Container has zero height → map invisible (check parent CSS)
  - Source data malformed → map renders but no shapes
  - WebGL context lost → map blanks after backgrounding the tab

### 2.8 General buggy / unusable
- Audit every feature in §3 against the "does this work as designed?" checklist in §4

---

## 3. Complete Launchpad surface map

You need to know every file. Read these BEFORE making changes.

### Pages & shells
| File | Role |
|------|------|
| `src/app/launchpad/page.tsx` | Server Component, force-dynamic, calls `getLaunchpadBundle` |
| `src/app/launchpad/_components/launchpad-shell.tsx` | Client orchestrator — wires state hook, top bar, list, dossier, map |

### Top bar
| File | Role |
|------|------|
| `src/app/launchpad/_components/scope-selector.tsx` | Living-location dropdown — 4 Chicagoland presets + 4 Boston Metro presets + All Chicagoland |
| `src/app/launchpad/_components/track-switcher.tsx` | All / Succession / High-Volume / DSO toggle |
| `src/app/launchpad/_components/launchpad-kpi-strip.tsx` | 6 KPIs (practices, best-fit, mentor-rich, hiring, avoid, intel coverage) |

### List & cards
| File | Role |
|------|------|
| `src/app/launchpad/_components/track-list.tsx` | Tier-grouped list (Best Fit / Strong / Maybe / Low / Avoid) |
| `src/app/launchpad/_components/track-list-card.tsx` | Single practice card — name, score, tier badge, signal chips, warning chips, pin toggle, embedded `<CompoundThesis />` |
| `src/app/launchpad/_components/compound-thesis.tsx` | Lazy-fetch 2-3-sentence Sonnet thesis, refuses on no verified research |
| `src/app/launchpad/_components/red-flag-patterns.tsx` | Compound-red-flag target list |
| `src/app/launchpad/_components/pinboard-panel.tsx` | Horizontal pinned-target strip (only renders when ≥1 pin) |
| `src/app/launchpad/_components/ai-disabled-banner.tsx` | Banner when `ANTHROPIC_API_KEY` missing |

### Dossier drawer (the practice deep-dive)
| File | Role |
|------|------|
| `src/app/launchpad/_components/practice-dossier.tsx` | 6-tab Sheet — Snapshot / Compensation / Mentorship / Red Flags / Interview Prep / Contract |
| `src/app/launchpad/_components/ask-intel-drawer.tsx` | Header button → free-form Q&A Sheet (`/api/launchpad/ask`) |
| `src/app/launchpad/_components/interview-prep-ai.tsx` | Phase 3 — replaces static Phase 1 interview tab (`/api/launchpad/interview-prep`) |
| `src/app/launchpad/_components/contract-parser.tsx` | 6th tab — paste contract, get parsed flags (`/api/launchpad/contract-parse`, 5/hr per IP) |
| `src/app/launchpad/_components/ledger-cards.tsx` | Atomic ledger UI (Phase 3) — renders LedgerAtom array from compound-narrative |
| `src/app/launchpad/_components/dso-tier-card.tsx` | DSO tier card (when practice is DSO-affiliated) — comp band, tier, citations |

### Map & ZIP context
| File | Role |
|------|------|
| `src/app/launchpad/_components/living-map.tsx` | Mapbox map — hex density (practices) or ZIP choropleth, lens toggle, selection-aware |
| `src/app/launchpad/_components/zip-dossier-drawer.tsx` | ZIP drawer — Overview / Top targets / PE activity, embeds `<ZipMoodBadge />` |
| `src/app/launchpad/_components/zip-mood-badge.tsx` | 2-sentence ZIP vibe (`/api/launchpad/zip-mood`) |

### Multi-target compare
| File | Role |
|------|------|
| `src/app/launchpad/_components/smart-briefing-builder.tsx` | Pin ≥2 → multi-NPI compare via Sonnet (`/api/launchpad/smart-briefing`, max 5 NPIs) |

### API routes (all under `src/app/api/launchpad/`)
| Route | Model | Purpose |
|-------|-------|---------|
| `ask/route.ts` | Haiku 4.5 | Free-form Q&A about practice/ZIP |
| `compound-narrative/route.ts` | Sonnet 4.6 | Two-pass extract→synthesize thesis with `[source: domain]` citations |
| `interview-prep/route.ts` | Haiku 4.5 | Categorized interview Qs |
| `zip-mood/route.ts` | Haiku 4.5 | 2-sentence ZIP vibe |
| `smart-briefing/route.ts` | Sonnet 4.6 | Multi-NPI strengths/risks/questions |
| `contract-parse/route.ts` | Haiku 4.5 | Parse contract text, severity-color flags. **5/hr per-IP rate limit** |

### Lib (the ranking + scope brains)
| File | Role |
|------|------|
| `src/lib/launchpad/scope.ts` | `LAUNCHPAD_SCOPES` (8 scopes) + `resolveLaunchpadZipCodes()` |
| `src/lib/launchpad/signals.ts` | 20 signal IDs, tier thresholds, `LaunchpadBundle` type contract, `LaunchpadSummary`, `SIGNALS_REQUIRING_INTEL` |
| `src/lib/launchpad/ranking.ts` | `TRACK_MULTIPLIERS` table, `evaluateSignals()`, `scoreForTrack()`, `rankTargets()`, `hasThinData()`, confidence cap at 70 |
| `src/lib/launchpad/dso-tiers.ts` | 16 hand-curated DSO entries with tiers + comp bands + citations |
| `src/lib/launchpad/ai-types.ts` | Shared request/response types for all 6 AI routes |
| `src/lib/supabase/queries/launchpad.ts` | `getLaunchpadBundle` — parallel fetch + `rankTargets` + summary |

### Hooks
| File | Role |
|------|------|
| `src/lib/hooks/use-launchpad-state.ts` | URL-synced state — scope, track, selectedNpi, pinnedNpis, view, mapView, selectedZip + helpers |
| `src/lib/hooks/use-launchpad-data.ts` | React Query wrapper for `LaunchpadBundle` (30min stale, 30min gc) |

### Env vars (verify these are in Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required (otherwise nothing loads)
- `NEXT_PUBLIC_MAPBOX_TOKEN` — required for map
- `ANTHROPIC_API_KEY` — required for ALL 6 AI routes (Ask Intel, Compound Thesis, Interview Prep, ZIP Mood, Smart Briefing, Contract Parser)

---

## 4. Feature-by-feature audit checklist

For every feature below, verify on the live URL:
1. **Loads** without crashing
2. **Renders** correct data (cross-check against Supabase if needed)
3. **Responds** to interaction within 500ms (or shows a loading state)
4. **Fails gracefully** when data is missing (no NaN, no `[object Object]`, no blank screens)
5. **Serves the big picture** (a new dental grad picking a first job)

### 4.1 Page load
- [ ] `/launchpad` returns 200 from Vercel CDN
- [ ] Initial bundle fetch completes in <3s (network tab)
- [ ] No console errors / warnings on first paint
- [ ] All required env vars present (Supabase URL, anon key, Mapbox token, Anthropic key)
- [ ] AI Disabled Banner shows iff `ANTHROPIC_API_KEY` is missing

### 4.2 Scope selector
- [ ] All 9 scopes render in dropdown (4 Chicagoland + 4 Boston + All Chicagoland)
- [ ] Default is **All Chicagoland** (269 ZIPs) — NOT West Loop (this was a bug fixed in `0e67fc5`, may have regressed)
- [ ] Selecting a scope triggers a single fetch (not multiple)
- [ ] URL `?scope=...` updates and is shareable
- [ ] Boston scopes return Boston practices (not empty)
- [ ] Sub-zone scopes return ≥1 practice (not zero)

### 4.3 Track switcher
- [ ] All / Succession / High-Volume / DSO toggle works
- [ ] **No refetch on track change** — same bundle, different scoring
- [ ] List re-orders within ~200ms
- [ ] Score on each card updates correctly
- [ ] Best-fit count in KPI strip updates
- [ ] URL `?track=...` updates

### 4.4 KPI strip
- [ ] 6 KPIs render
- [ ] Practice count matches scope (use SQL to verify)
- [ ] Best-fit count = practices with score ≥ 80
- [ ] Mentor-rich count = practices with mentor_density signal firing
- [ ] Hiring count = practices with hiring_now signal firing
- [ ] Avoid count = practices in avoid tier (0-34)
- [ ] **Intel Coverage KPI** — should show `withIntelCount / totalCount` (per CLAUDE.md, this replaced the comp range KPI). Verify it shows the actual % of practices with `practice_intel` rows in scope (probably small — most scopes will be <30% covered)
- [ ] **Headline KPI uses `totalGpLocations` (location-deduped) NOT NPI count** — fix from `0e67fc5`

### 4.5 Track list & cards
- [ ] List groups by 5 tiers in order: Best Fit → Strong → Maybe → Low → Avoid
- [ ] Each tier shows practice count
- [ ] Cards render: title, subtitle, score, tier badge, signal chips, warning chips, pin button, expand caret
- [ ] **CRITICAL: Title prefers `doing_business_as ?? practice_name ?? "Dr. " + provider_last_name`** — not `provider_last_name` first
- [ ] Subtitle shows city + classification (e.g., "Naperville · solo_high_volume")
- [ ] Signal chips are human-readable (use signal labels from `signals.ts`, not raw IDs)
- [ ] Warning chips are red/amber colored
- [ ] Pin button toggles correctly, doesn't open dossier (`e.stopPropagation()`)
- [ ] Score color matches tier (best_fit green, strong amber, etc.)
- [ ] Click on card opens dossier (the right NPI)

### 4.6 Compound Thesis (embedded in card)
- [ ] Expand caret reveals lazy-fetched thesis
- [ ] First expand triggers `/api/launchpad/compound-narrative` POST
- [ ] Subsequent expands hit cache (no new request)
- [ ] If `practice_intel` exists with `verification_quality in (verified, partial)` — thesis renders with citations
- [ ] If `practice_intel` missing or `verification_quality=insufficient` — refuses with "Structural signals only…" message (NOT silent failure, NOT fabricated thesis)
- [ ] Thesis is 200-350 tokens — not a wall of text
- [ ] Citations like `[source: tallgrassdental.net]` render as readable inline tags

### 4.7 Score breakdown (NEW — must build)
- [ ] User can click "Why this score?" or expand a section to see breakdown
- [ ] Shows: base 50, each fired signal × multiplier, confidence cap if applied, final
- [ ] Sum-checks to the displayed score (debug: log diff if mismatch >0.5)
- [ ] Available on both card (compact) and dossier (full)

### 4.8 Pinboard panel
- [ ] Hidden when 0 pins
- [ ] Renders horizontal strip when ≥1 pin
- [ ] Hover-X to unpin works
- [ ] Clear all works
- [ ] Out-of-scope pins (pinned in West Loop, switched to Boston Core) render gracefully
- [ ] localStorage key: verify pins persist across reload

### 4.9 Smart Briefing
- [ ] Trigger appears only when ≥2 pins
- [ ] Multi-select capped at 5 (server AND client)
- [ ] Sonnet response renders side-by-side strengths/risks/questions
- [ ] Top-pick recommendation with rationale
- [ ] 503 surfaced verbatim if `ANTHROPIC_API_KEY` missing

### 4.10 Practice dossier — Snapshot tab
- [ ] Header: name (correct fallback), pin button, Ask Intel button, prev/next nav, close
- [ ] Practice metadata: address, phone, website (linkable), classification, providers, employees, year established
- [ ] Buyability score with badge
- [ ] If DSO-affiliated, embedded `<DsoTierCard />`
- [ ] Score breakdown (per 4.7)
- [ ] All values handle null cleanly (— not null/undefined/[object Object])

### 4.11 Practice dossier — Compensation tab
- [ ] Comp range (from DSO tier or industry default)
- [ ] Production %, base salary, draw structure if known
- [ ] Source citation if pulled from `practice_intel`
- [ ] Renders something useful for the 99.99% of practices without intel (industry default + caveat)

### 4.12 Practice dossier — Mentorship tab
- [ ] Mentor density signal status
- [ ] Provider count, average tenure
- [ ] Apprentice fit indicator
- [ ] If `practice_intel.mentorship_signals` populated, render those

### 4.13 Practice dossier — Red Flags tab
- [ ] Lists fired warning signals (dso_avoid, family_dynasty, ghost_practice, recent_acquisition, associate_saturated, medicaid_mill, non_compete_radius, pe_recap_volatility)
- [ ] Each with severity color + explanation + (if available) source
- [ ] If 0 red flags, says so explicitly ("No warning signals — verify by interview")

### 4.14 Practice dossier — Interview Prep tab (AI)
- [ ] Auto-fetches on tab open (or generate button)
- [ ] Returns categorized questions: Practice fit, Comp, Mentorship, Red flags, Track-specific
- [ ] Each Q has bold prompt + italic "listen for"
- [ ] Regenerate button works
- [ ] Cached per (npi, track) for 5min staleTime
- [ ] 503 if AI key missing

### 4.15 Practice dossier — Contract Parser tab
- [ ] Textarea with character count
- [ ] Submit disabled until ≥500 chars
- [ ] Lock disclaimer ("text is not saved")
- [ ] Submit returns parsed structure: non-compete, comp, termination, restrictive covenants, CE, flags
- [ ] Severity colors (red/amber/green) applied
- [ ] 429 shows "Rate limit reached, retry in N min" (5/hr per IP)

### 4.16 Ask Intel drawer
- [ ] Button in dossier header opens Sheet
- [ ] Form submits to `/api/launchpad/ask`
- [ ] Loading state shows
- [ ] Response renders with model attribution
- [ ] Error shows verbatim
- [ ] 3 starter chips populate the textarea on click
- [ ] Closes cleanly

### 4.17 Living Map (the "totally useless" feature)
- [ ] Map renders with Mapbox base layer
- [ ] Default view = ZIP choropleth (per Phase 3 change)
- [ ] Lens toggle works: consolidation, density, buyability, retirement, mentor density, DSO avoid
- [ ] Color ramps make sense for each lens (high = darker)
- [ ] Click ZIP → selects ZIP, auto-opens `<ZipDossierDrawer />`
- [ ] View toggle: ZIP choropleth ↔ practice hex density
- [ ] Practice view: hexes show density, click on hex zooms / opens nearest practice
- [ ] Data quality amber banner if selected ZIP has `metrics_confidence === 'low'`
- [ ] No WebGL crashes when switching scope
- [ ] Map fits scope bounds (Chicagoland fits Chicago, Boston fits Boston)

### 4.18 ZIP dossier drawer
- [ ] Opens when ZIP clicked on map
- [ ] 3 tabs: Overview / Top targets / PE activity
- [ ] Overview: saturation metrics (DLD, buyable ratio, corporate share, market type)
- [ ] Top targets: top-10 practices in ZIP by track score
- [ ] PE activity: recent deals in ZIP (or nearby)
- [ ] `<ZipMoodBadge />` in header — 2-sentence vibe + colored confidence dot
- [ ] Closes cleanly

### 4.19 Red Flag Patterns section
- [ ] Compound-red-flag target list (practices with ≥2 warning signals)
- [ ] Sorted by warning count desc
- [ ] Click row opens dossier
- [ ] Hides if 0 compound-flag practices in scope

### 4.20 Keyboard / URL state
- [ ] `?scope=...&track=...&selectedNpi=...` survives reload
- [ ] Pinned NPIs survive reload (localStorage)
- [ ] Browser back/forward navigates state correctly

---

## 5. Suspected root causes (start here)

Order of investigation, highest-priority first:

### P0 — Verify env state (5 min)
```bash
curl -X POST https://dental-pe-nextjs.vercel.app/api/launchpad/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"test","npi":"1234567890"}'
```
If 503, the Anthropic key is missing in Vercel → tell the user, do NOT continue debugging AI features until they add it. If 200 with `answer` field, AI routes are wired correctly and the bug is client-side in the UI.

### P0 — Practice naming bug (root-cause likely in `getLaunchpadBundle`)
Read `src/lib/supabase/queries/launchpad.ts` and `src/app/launchpad/_components/track-list-card.tsx`. Find where the title is selected. The fallback chain MUST be:
```ts
const displayName =
  practice.doing_business_as?.trim() ||
  practice.practice_name?.trim() ||
  (practice.provider_last_name ? `Dr. ${practice.provider_last_name}` : null) ||
  "Unknown practice"
```
Verify the SELECT pulls `doing_business_as` and `practice_name`. If it's only pulling `provider_last_name`, that's the bug — fix the SELECT.

### P0 — Map breakage
Read `living-map.tsx`. Check:
1. Is `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` referenced correctly?
2. Is the map container CSS giving it actual height? (Common bug: parent flex container with no min-height)
3. Is the data layer source loading? Check Mapbox `map.on('error', ...)` handler — if absent, ADD ONE so errors surface
4. Is the ZIP boundary GeoJSON being fetched? From where?
5. Is the click handler calling `setSelectedZip(zip)`?

### P1 — Track switching slowness
Profile the page in Chrome DevTools Performance tab while switching tracks. Look for:
1. Long-running JS task on track change → likely `rankTargets()` re-running unnecessarily
2. React Query refetch → check `useLaunchpadData` query key — track should NOT be in the key
3. Re-render cascade → wrap track-list in `useMemo` keyed on `(bundle, track, scope)`

### P1 — Score transparency
Build the score breakdown UI. Refactor `scoreForTrack()` to return `{score, breakdown}`:
```ts
export function explainScore(target, track) {
  const fired = evaluateSignals(target)
  const contributions = fired.map(signalId => ({
    signalId,
    label: SIGNAL_LABELS[signalId],
    baseWeight: SIGNAL_WEIGHTS[signalId],
    multiplier: TRACK_MULTIPLIERS[track][signalId] ?? 1,
    points: SIGNAL_WEIGHTS[signalId] * (TRACK_MULTIPLIERS[track][signalId] ?? 1),
  }))
  const raw = 50 + contributions.reduce((sum, c) => sum + c.points, 0)
  const capped = hasThinData(target) ? Math.min(raw, 70) : raw
  const final = Math.max(0, Math.min(100, capped))
  return {base: 50, contributions, cap: hasThinData(target) ? 70 : null, raw, final}
}
```
Then render this in dossier as a new "Why this score" section.

### P2 — Crashes
Open DevTools console while clicking through. Capture every red error. For each:
1. Note the file:line from the stack
2. Reproduce minimally
3. Fix at source
4. Add a regression test (or at minimum a code comment)

Common Launchpad crash sources to check:
- `track-list-card.tsx` — null `practice_intel` access without `?.`
- `practice-dossier.tsx` — missing tab content when `practice_intel.contract_terms` is null
- `living-map.tsx` — Mapbox WebGL context lost
- `compound-thesis.tsx` — render functions returning objects instead of primitives
- `getLaunchpadBundle` — Supabase 1000-row pagination missing for large scopes

---

## 6. How to work efficiently

### Use parallel agents for parallel work
Whenever you have independent investigation threads, launch them simultaneously:

```
Task 1: Audit getLaunchpadBundle for SELECT fields and 1000-row pagination
Task 2: Audit living-map.tsx for Mapbox setup and data layer rendering
Task 3: Audit all 6 AI route handlers for error handling and rate limiting
Task 4: Audit track-list-card.tsx + practice-dossier.tsx for naming bug
```

These four are independent. Launch them in ONE message with four `Agent` tool calls (subagent_type=Explore for read-only, general-purpose for surgery).

Do NOT serialize independent work. Do NOT do investigation work yourself when an agent could do it in parallel.

### Verify before claiming
After every agent returns:
1. Read the actual files it claims to have edited (`Read` tool)
2. Run `npm run build` to confirm TS compiles
3. If a deploy is implied, verify Vercel deploy state via `gh` or `curl`
4. Open the live URL and click the feature

If any step fails, the agent's report is unreliable — investigate yourself.

### Commit cadence
Small commits per fix. Push to main after each commit (Vercel deploys auto on push). After each push:
1. Wait for Vercel deploy (check `https://vercel.com/suleman7-dmds-projects/dental-pe-nextjs/deployments` or `gh api` if available)
2. Verify the fix on live URL
3. Move to next bug

If Vercel build fails, fix it before moving on.

### Use the right tools
- `Read` for known paths
- `Bash` `grep`/`rg` for keyword search in known directories
- `Agent` (Explore) for open-ended "how does X work" questions
- `Agent` (general-purpose) for "go fix Y end-to-end" tasks where you've narrowed the file set
- `WebFetch` for Mapbox docs, Anthropic docs, Supabase docs

---

## 7. Verification protocol (when can you stop?)

You are NOT done until ALL of the following are true:

### 7.1 Live URL audit
Open `https://dental-pe-nextjs.vercel.app/launchpad` in a real browser and verify:
- [ ] Page loads in <3s, no console errors
- [ ] Default scope is "All Chicagoland", NOT "West Loop"
- [ ] First card shows a real practice name (not a doctor name when DBA exists)
- [ ] Switching scope → Boston Core shows Boston practices
- [ ] Switching track from All → Succession re-ranks within 500ms
- [ ] Clicking a practice opens dossier
- [ ] Dossier header shows practice name correctly (DBA preferred)
- [ ] Score breakdown visible somewhere — user can see WHY a score is 100
- [ ] Snapshot tab renders all available metadata
- [ ] Compensation tab renders something useful
- [ ] Mentorship tab renders something useful
- [ ] Red Flags tab lists fired warnings or says "none"
- [ ] Interview Prep tab returns Qs (or 503 with explicit "API key needed" message)
- [ ] Contract tab accepts text and parses (or 503)
- [ ] Ask Intel button opens drawer, accepts question, returns answer (or 503)
- [ ] Compound Thesis lazy-fetches on expand
- [ ] Map renders with Mapbox tiles
- [ ] Map has at least one working lens
- [ ] Click ZIP on map opens ZIP dossier
- [ ] ZIP Mood badge renders
- [ ] Pin a practice → pinboard appears
- [ ] Pin 2+ practices → Smart Briefing button appears
- [ ] Smart Briefing returns multi-target compare
- [ ] No `[object Object]`, no `null`, no `undefined`, no `NaN` rendered anywhere
- [ ] No browser console errors for any of the above

### 7.2 Build / deploy gates
- [ ] `npm run build` passes with zero TS errors and zero ESLint errors
- [ ] Latest Vercel deploy is "Ready" (not "Failed")
- [ ] Vercel deploy logs show no warnings worth fixing
- [ ] No regression on adjacent pages: `/`, `/warroom`, `/intelligence`, `/job-market`, `/market-intel`, `/buyability`, `/deal-flow`, `/research`, `/system`, `/data-breakdown` — load each and verify no crash

### 7.3 Self-honesty gate
For each user-reported bug in §2, write a one-paragraph status:
- What was the root cause?
- What did you change?
- File:line of the change?
- How did you verify the fix on the live URL?

If you can't write that paragraph honestly for any bug, the bug isn't fixed.

### 7.4 Final report to user
When (and only when) all gates pass, post a final report:
1. Summary of bugs fixed (one line each, with commit SHA)
2. Bugs you couldn't fix and why (with explicit "blocked on user action: X" if applicable)
3. Performance numbers (initial load, track switch, map render)
4. List of files changed
5. Vercel deploy URL of the final state
6. Specific things the user should test on the live URL to confirm the fix

Do NOT claim "everything is fixed" if anything is partial. The user has been burned before by reports that overstated.

---

## 8. Known constraints / things you may NOT do

- **Do not modify `dso_classifier.py`, `merge_and_score.py`, or any cron pipeline file** without explicit user approval. The data layer is upstream and a different blast radius.
- **Do not modify Supabase schema** without explicit user approval. The pipeline depends on it.
- **Do not delete features the user uses.** When in doubt, hide behind a toggle, don't delete. The narrative-card was deleted in `056c658` and the user noticed and asked for it back — don't repeat that pattern.
- **Do not commit secrets.** Never hardcode API keys.
- **Do not use `--no-verify`** to skip git hooks. If a hook fails, fix the hook failure.
- **Do not force-push** to main.
- **Do not touch `.env`** files in either repo.

## 9. Resources

- Project CLAUDE.md (root): `/Users/suleman/dental-pe-tracker/CLAUDE.md`
- Project CLAUDE.md (frontend): `/Users/suleman/dental-pe-tracker/dental-pe-nextjs/CLAUDE.md`
- Project CLAUDE.md (scrapers): `/Users/suleman/dental-pe-tracker/scrapers/CLAUDE.md`
- Anti-hallucination protocol: see "Anti-Hallucination Defense" section in root CLAUDE.md
- Phase 3 ship log: see "Phase 3 shipped (2026-04-25)" in `dental-pe-nextjs/CLAUDE.md`
- Reconciliation verdict (KPI numbers): `/Users/suleman/dental-pe-tracker/RECONCILIATION_VERDICT_2026_04_26.md`

## 10. Final mandate

The user said: *"turn it into something that 'may have the data but is functionally useless' into the final product that is debugged working at industry grade deployment."*

That's the goal. Industry-grade means: a senior engineer at a YC-backed startup would feel proud to demo this in front of investors. Not "it works most of the time." Not "it builds." It WORKS, it's FAST, every feature SERVES the new-grad-picking-a-job picture, and every number on screen has a story behind it the user can audit.

You have full autonomy. You have parallel agents. You have a real Anthropic key (subject to Vercel env config — verify first). You have 3,391 high-quality dossiers waiting to be surfaced. Make Launchpad great.

Go.
