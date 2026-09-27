# Directory land-use layer

Directory → Map layers → **Land use · homes & landscape**. Full land use explains gaps; Where people live isolates housing (purple) and housing mixed with commercial uses (rose); Commercial & medical isolates existing retail, offices, mixed use and medical facilities for investigation. This is observed land use, not zoning permission, occupancy, property availability or a practice eligibility filter. Hover/tap preserves CMAP facility names. Office selection and live status filters stay independent.

Source: [CMAP 2023 Land Use Inventory](https://datahub.cmap.illinois.gov/maps/1022fd982a5b4b51a9cecb20ea6c2a29/about), public FeatureServer layer 1, retrieved September 27, 2026. CMAP permits unrestricted use with attribution. Boundaries: Census TIGERweb ACS2024 service, 2020 ZCTAs. The 269 watched Illinois ZIP snapshot is in `data/land-use/watched-zips.json`; 258 have Census polygons. Eleven unmatched ZIPs are listed in the shipped manifest and UI. No boundaries are fabricated. CMAP covers seven counties; ZCTA coverage is not a claim of complete coverage beyond those counties.

`public/data/land-use/manifest.json` records coverage, counts, null-geometry source IDs, source URLs, archive size and SHA-256. `source-schema.json` preserves code definitions. `build-land-use.py` downloads all object-ID pages, checks completeness, repairs invalid polygon geometry, clips to the ZCTA union and tiles at zooms 7–14. Regional geometry is simplified; zooming past 14 overzooms that detail. Null geometries are explicitly excluded. No practice database writes occur.

Rebuild from the frontend root with a Python venv containing requests, shapely and tippecanoe:

```
PATH=/path/to/venv/bin:$PATH python scripts/build-land-use.py --cache /tmp/dental-landuse-cache
npm run build
npx vitest run
```

Intermediate source pages are gzip-compressed and restartable. The archive is bundled via `outputFileTracingIncludes`; `/api/land-use-tiles/cmap-2023-v1/{z}/{x}/{y}` reads byte ranges from the local archive and caches successful vector tiles. Empty outside-coverage tiles are distinct from HTTP 503 errors. No ArcGIS requests, extra API keys or new dependencies at runtime. The source loads only when selected. Change the version constant when replacing the archive. URL parameters `mapLayer=landuse&landUse=homes|full|sites` preserve the chosen view.

Browser check: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node scripts/check-land-use-map.cjs http://localhost:3103`.
