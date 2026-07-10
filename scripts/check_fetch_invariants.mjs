#!/usr/bin/env node
// Hard regression checks for the P0 pagination / count-truth fixes.
//
// Fails (exit 1) when any of these invariants breaks:
//   1. The all-Chicagoland GP practice_locations fetch (stable, location_id
//      tie-breaker) returns duplicate location_ids, or a total != EXPECTED_GP_TOTAL.
//   2. Ownership-reviewed rows (valid ownership_tier) != EXPECTED_OWNERSHIP_REVIEWED.
//   3. job_hunt_verification total != EXPECTED_JHV_TOTAL, or its GP-scope
//      subset != EXPECTED_JHV_GP.
//   4. The live /launchpad HTML contains a banned stale string:
//      "3,189", "49 / 4,439", or "115 verified".
//
// Expected values are the pre-census-write canon. When the census close-out
// legitimately moves them, update the constants here in the same commit.
//
// Usage: node scripts/check_fetch_invariants.mjs [--skip-live]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_GP_TOTAL = 4439;
const EXPECTED_OWNERSHIP_REVIEWED = 3180;
const EXPECTED_JHV_TOTAL = 48;
const EXPECTED_JHV_GP = 47; // Wirtz Orthodontics is a specialist — outside GP scope
const LIVE_URL = process.env.LAUNCHPAD_URL ?? "https://dental-pe-nextjs.vercel.app/launchpad";
const BANNED_LIVE_STRINGS = ["3,189", "49 / 4,439", "115 verified"];

const OWNERSHIP_TIERS = new Set([
  "true_independent",
  "single_loc_group",
  "dentist_multi",
  "stealth_dso",
  "branded_dso",
  "institutional",
]);

// Mirrors GP_LOCATION_CLASSIFICATIONS in src/lib/constants/entity-classifications.ts
const GP_CLASSIFICATIONS = [
  "solo_established",
  "solo_new",
  "solo_inactive",
  "solo_high_volume",
  "family_practice",
  "small_group",
  "large_group",
  "dso_regional",
  "dso_national",
];

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // fall back to process.env (CI)
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] == null) {
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("FAIL missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let failures = 0;
function check(ok, label, detail) {
  if (ok) {
    console.log(`PASS ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function fetchGpScope() {
  const pageSize = 1000;
  const rows = [];
  let page = 0;
  for (;;) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("practice_locations")
      .select("location_id,ownership_tier")
      .eq("state", "IL")
      .or("is_likely_residential.eq.false,is_likely_residential.is.null")
      .in("entity_classification", GP_CLASSIFICATIONS)
      .order("location_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`practice_locations page ${page}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
    page += 1;
  }
  return rows;
}

async function fetchVerificationIds() {
  const pageSize = 1000;
  const ids = [];
  let page = 0;
  for (;;) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("job_hunt_verification")
      .select("location_id")
      .order("location_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`job_hunt_verification page ${page}: ${error.message}`);
    ids.push(...(data ?? []).map((r) => r.location_id));
    if ((data ?? []).length < pageSize) break;
    page += 1;
  }
  return ids;
}

async function main() {
  // --- 1 & 2: GP scope row identity + ownership census ----------------------
  const gpRows = await fetchGpScope();
  const uniqueIds = new Set(gpRows.map((r) => r.location_id));
  check(
    gpRows.length === uniqueIds.size,
    "GP fetch has zero duplicate location_ids",
    `${gpRows.length} rows, ${uniqueIds.size} unique`
  );
  check(
    gpRows.length === EXPECTED_GP_TOTAL,
    `GP clinic-location total == ${EXPECTED_GP_TOTAL}`,
    `got ${gpRows.length}`
  );
  const reviewed = gpRows.filter((r) => OWNERSHIP_TIERS.has(r.ownership_tier)).length;
  check(
    reviewed === EXPECTED_OWNERSHIP_REVIEWED,
    `Ownership reviewed == ${EXPECTED_OWNERSHIP_REVIEWED}`,
    `got ${reviewed}`
  );

  // --- 3: job-hunt verification layer --------------------------------------
  const verificationIds = await fetchVerificationIds();
  check(
    verificationIds.length === EXPECTED_JHV_TOTAL,
    `job_hunt_verification total == ${EXPECTED_JHV_TOTAL}`,
    `got ${verificationIds.length}`
  );
  const gpVerified = verificationIds.filter((id) => uniqueIds.has(id)).length;
  check(
    gpVerified === EXPECTED_JHV_GP,
    `GP-scope website-checked == ${EXPECTED_JHV_GP}`,
    `got ${gpVerified}`
  );

  // --- 4: live /launchpad must not resurrect the stale numbers -------------
  if (process.argv.includes("--skip-live")) {
    console.log("SKIP live /launchpad scrape (--skip-live)");
  } else {
    const res = await fetch(LIVE_URL, { headers: { "user-agent": "invariant-check" } });
    check(res.ok, `live ${LIVE_URL} responds`, `HTTP ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      for (const banned of BANNED_LIVE_STRINGS) {
        check(!html.includes(banned), `live /launchpad free of "${banned}"`);
      }
      const expectFmt = [
        EXPECTED_GP_TOTAL.toLocaleString("en-US"),
        EXPECTED_OWNERSHIP_REVIEWED.toLocaleString("en-US"),
      ];
      for (const wanted of expectFmt) {
        check(html.includes(wanted), `live /launchpad shows "${wanted}"`);
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} invariant(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll fetch/count invariants PASSED");
}

main().catch((err) => {
  console.error(`FAIL uncaught: ${err.message}`);
  process.exit(1);
});
