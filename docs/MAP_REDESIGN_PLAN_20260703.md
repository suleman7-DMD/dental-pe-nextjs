# Map Redesign Plan - census-first directory UI

Saved 2026-07-03 after a quick map audit. This is a resume note for the next UI pass, not an implemented change.

## Current map surfaces

1. `/market-intel` - `ConsolidationMap`
   - ZIP-dot map using `zip_scores.corporate_share_pct`, `total_gp_locations`, and legacy detector floor fields.
   - Good for historical floor context, but it is not yet a reviewed ownership-census map.

2. `/job-market?tab=map` - `PracticeDensityMap`
   - Practice-dot and density map using `entity_classification` via `classifyPractice()`.
   - It now receives `ownership_tier` fields through the directory data feed, but the map does not use them yet.

3. `/job-market?tab=map` - `SaturationMap`
   - ZIP-level DLD, buyable ratio, and corporate share map.
   - Useful market-condition layer, but the corporate lens is still the legacy floor.

4. `/launchpad?view=map` - `LaunchpadLivingMap`
   - Job-hunt map colored by fit tier, mentor density, or DSO-avoid heuristics.
   - This should become a career map with ownership risk from census tiers.

5. `/warroom` - Review Desk `LivingMap`
   - Analyst/review map with lenses for consolidation, density, buyability, and retirement.
   - Best surface for holds, undetermined rows, QA queues, and evidence gaps.

6. `/deal-flow?tab=geography` - `StateChoropleth`
   - National PE deal heatmap. Should stay separated from the Chicagoland directory product.

7. Shared `MapContainer`
   - React Mapbox wrapper used by Launchpad, Review Desk, and Deal Flow. Other maps instantiate raw `mapbox-gl` directly.

## Main findings

- The maps are feature-rich but fragmented. Each page has a different map grammar, legend style, color meaning, and interaction model.
- Most ownership maps are still detector-first. They use `entity_classification` or `zip_scores.corporate_share_pct`, not reviewed `ownership_tier`.
- The Directory map screenshot showed the first visible map area mostly blank at the top of the viewport. It may render after load, but the first impression feels broken.
- ZIP maps use centroid circles rather than ZIP polygons. That is acceptable for speed, but the UI should label them as ZIP markers, not true geographic boundaries.
- Practice dots use exact lat/lon when present, otherwise ZIP centroid jitter. This is honest, but it needs a consistent visual distinction and legend.
- The same concepts are named differently across pages: consolidation, corporate floor, DSO/PE, avoid DSO, ownership risk. This should be normalized.
- Popups are mostly hover-only and not connected to the new canonical `/practice/[location_id]` page.

## Recommended product model

Use one common map grammar across the app:

- Practice dot color = reviewed ownership tier when available.
- Practice dot outline/opacity = review state:
  - verified
  - needs evidence
  - not reviewed
  - hold, once synced
- Dot shape or small badge = exact vs ZIP-estimated coordinate.
- Clicking a practice dot opens `/practice/[location_id]`.
- ZIP marker color = selected lens.
- ZIP marker secondary ring = census coverage.
- ZIP popup always shows reviewed count, needs-evidence count, not-reviewed count, DSO/PE among reviewed, and link to filtered directory.

Correct tier groupings:

- Independent: T1 true_independent + T2 single_loc_group.
- Multi-location consolidation: T3 dentist_multi + T4 stealth_dso + T5 branded_dso.
- DSO/PE: T4 stealth_dso + T5 branded_dso, with `pe_backed` as a sub-filter.
- T2 is never counted as consolidated.

## Page-by-page redesign

### Directory map

Rename `PracticeDensityMap` to a user-facing "Directory Map".

Default view:

- Show individual practice dots by default at a sensible zoom.
- Color by `ownership_tier` if present.
- Show unreviewed rows as quiet gray, not green independent.
- Add segmented controls:
  - Ownership
  - Review status
  - Opportunity
  - Coordinate quality
- Click dot -> canonical practice page.
- Keep density/hex as an optional "clusters" toggle, not the default.

Quick fix:

- Use `ownership_tier` in `PracticeDensityMap` before legacy `entity_classification`.
- Replace "Consolidated density" wording with "Known DSO/PE density" or "Reviewed DSO/PE density".
- Add link to `/practice/[location_id]` in dot popups.

### Ownership map

Turn `ConsolidationMap` into "Ownership Coverage Map".

Default lens:

- ZIP color = census coverage percentage.
- ZIP ring or inner fill = DSO/PE among reviewed.
- Tooltip:
  - total GP locations
  - reviewed
  - needs evidence
  - not reviewed
  - DSO/PE among reviewed
  - legacy floor, clearly labeled

Additional lenses:

- DSO/PE among reviewed
- Dentist-owned networks
- Not reviewed concentration
- Needs-evidence concentration

Data dependency:

- Fable should sync a `census_zip_summary` or equivalent table:
  - zip_code
  - total_gp_locations
  - reviewed_count
  - classified_count
  - undetermined_count
  - hold_count
  - unreviewed_count
  - tier counts T1-T6
  - pe_backed_count
  - last_consolidated_at

### Job Hunt map

Keep it focused on career decisions:

- Default color = job fit tier.
- Overlay ownership risk:
  - verified independent
  - dentist-owned network
  - DSO/PE
  - needs evidence
  - not reviewed
- Replace "DSO Avoid" lens with "Ownership Risk".
- Popups should explain why the practice is a good or risky job target, then link to `/practice/[location_id]`.

### Acquisition Scout map

Use the same Directory map component with acquisition-specific lenses:

- succession age
- independent/single-site verified
- dentist-owned network
- buyability score
- not reviewed but high legacy opportunity

This should probably live in `/buyability`, not only `/job-market`.

### Review Desk map

Keep this as the power-user map, but make it a review queue:

- Holds
- Needs evidence
- Missing verifier verdict
- Missing evidence URL
- Closure suspect
- Duplicate suspect
- Protected network
- Not reviewed clusters

Clicking a map item should open a review drawer and the canonical practice page.

### PE Deals map

Keep as separate context:

- Do not merge it into the directory workflow.
- Rename copy to "Deal Activity Context".
- Add a Chicagoland inset later if deals can be geocoded to platforms/targets.

## Visual direction

- Keep the warm light design.
- Avoid dense terminal/Bloomberg map chrome.
- Prefer one short lens switcher and one clear legend over many controls.
- Put legends in soft bottom-left cards with plain language.
- Use a softer base map and avoid saturated red/green overload.
- Use color plus shape/outline, not color alone.
- Show only the controls needed for the current page purpose.

## Implementation sequence

1. Build a shared `OwnershipMapLegend` and `ownershipTierToMapStyle()` utility.
2. Update `PracticeDensityMap` to use `ownership_tier` first and link dots to `/practice/[location_id]`.
3. Rename user-facing labels: Practice Density Map -> Directory Map; Consolidation Map -> Ownership Coverage Map.
4. Add reviewed/not-reviewed/needs-evidence counts to practice map summaries.
5. Add Fable data contract for `census_zip_summary`.
6. Rebuild ZIP maps around coverage and reviewed ownership aggregates.
7. Reuse the same map grammar in Job Hunt, Acquisition Scout, and Review Desk.
8. Run Playwright screenshots across desktop and mobile for:
   - `/job-market?tab=map`
   - `/market-intel`
   - `/launchpad?view=map`
   - `/warroom`
   - `/deal-flow?tab=geography`

## Open questions for Fable

- Will `ownership_evidence_basis`, `ownership_evidence_urls`, `ownership_confidence`, `network_id`, and `pe_backed` stay on `practice_locations` as the canonical frontend source?
- Can Fable sync `census_zip_summary` with reviewed/not-reviewed/hold/tier counts by ZIP?
- Will holds have typed categories in a synced table, or only local files?
- Should `network_id` be normalized into a synced network registry before map clustering by ownership tree?
- Should exact vs ZIP-estimated coordinate quality be a synced boolean, or inferred from latitude/longitude presence?

