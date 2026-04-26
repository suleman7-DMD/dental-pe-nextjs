import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

/**
 * F27 — entity_classification-primary regression test.
 *
 * The codebase rule (CLAUDE.md "Entity Classification Is Primary"):
 * any file that reads `.ownership_status` for FILTER / CATEGORIZATION /
 * SCORING logic MUST also reference one of:
 *
 *   - `classifyPractice(...)` — canonical helper (entity_classification
 *     primary, ownership_status fallback)
 *   - `isIndependentClassification(...)` / `isCorporateClassification(...)`
 *     — narrow helpers for boolean checks
 *   - `entity_classification` — adjacent direct check (for legacy fallback
 *     patterns like `if (p.entity_classification) ... else fall back to
 *     ownership_status`)
 *
 * Files in the ALLOWLIST below legitimately read `ownership_status` for
 * non-categorization reasons (CRUD writes, change-log field name, AI
 * payload pass-through). Each entry has a one-line justification.
 *
 * F03 (Job Market density map) was the bug that motivated this test —
 * `practice-density-map.tsx` read `ownership_status` directly with no
 * `entity_classification` fallback. After the F03 fix it uses
 * `classifyPractice(p.entity_classification, p.ownership_status)`, so
 * this test now passes for it.
 */

const SRC_ROOT = path.resolve(__dirname, "..")

// Files that MAY reference `ownership_status` without a categorization
// helper. Each entry is a path relative to `src/` plus a justification
// the test will print if the allowlist ever needs trimming.
const ALLOWLIST: Record<string, string> = {
  "lib/constants/entity-classifications.ts":
    "Defines `classifyPractice` itself — must reference the field by name.",
  "app/api/practices/[npi]/route.ts":
    "PATCH endpoint that writes ownership_status — pure CRUD, no categorization.",
  "app/system/_components/manual-entry-forms.tsx":
    "Admin form for manually editing ownership_status — pure CRUD.",
  "app/_components/home-shell.tsx":
    "Change log row label compares fieldChanged === 'ownership_status' — string match, not categorization.",
  "app/launchpad/_components/practice-dossier.tsx":
    "Builds a PracticeSnapshot payload for AI routes — pass-through, not categorization.",
  "app/launchpad/_components/track-list-card.tsx":
    "Builds a PracticeSnapshot payload for AI routes — pass-through, not categorization.",
  "app/launchpad/_components/smart-briefing-builder.tsx":
    "Builds a PracticeSnapshot payload for AI routes — pass-through, not categorization.",
  "app/launchpad/_components/interview-prep-ai.tsx":
    "Reads from a PracticeSnapshot payload assembled upstream — pass-through.",
  "app/job-market/_components/practice-detail-drawer.tsx":
    "Displays ownership_status as a separate informational field next to entity_classification — visual transparency, not logic.",
  "app/warroom/_components/dossier-drawer.tsx":
    "Displays ownership_status as supplementary info next to entity classification badge — visual.",
}

const CATEGORIZATION_HELPERS = [
  "classifyPractice",
  "isIndependentClassification",
  "isCorporateClassification",
  "entity_classification",
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    if (entry.name === "__tests__") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(full)
    }
  }
  return out
}

describe("F27 — entity_classification primary across frontend", () => {
  it("every file that reads ownership_status references a categorization helper", () => {
    const files = walk(SRC_ROOT)
    const violations: { file: string; reason: string }[] = []

    for (const abs of files) {
      const rel = path.relative(SRC_ROOT, abs)
      const src = fs.readFileSync(abs, "utf8")

      // Drop comments + string literals before scanning so the grep doesn't
      // false-positive on docstrings explaining the rule.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "''")

      // Look for property reads (`.ownership_status`) AND object-literal
      // keys used as filter columns (e.g., `'ownership_status'` in a
      // Supabase `.in()` call). The string-literal stripping above already
      // removes Supabase column-name strings, so this check focuses on
      // genuine code reads.
      const reads = stripped.match(/\bownership_status\b/g)
      if (!reads || reads.length === 0) continue

      const usesHelper = CATEGORIZATION_HELPERS.some((h) =>
        stripped.includes(h),
      )
      if (usesHelper) continue

      if (rel in ALLOWLIST) continue

      violations.push({
        file: rel,
        reason:
          "Reads ownership_status without referencing classifyPractice / isIndependentClassification / isCorporateClassification / entity_classification. Either use a helper (preferred) or add an explicit allowlist entry with justification.",
      })
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  - ${v.file}\n    ${v.reason}`)
        .join("\n")
      throw new Error(
        `F27 regression: ${violations.length} file(s) read ownership_status as a primary classifier:\n${report}`,
      )
    }

    expect(violations).toEqual([])
  })

  it("ALLOWLIST entries still exist on disk (catch-stale-allowlist guard)", () => {
    const stale: string[] = []
    for (const rel of Object.keys(ALLOWLIST)) {
      const abs = path.join(SRC_ROOT, rel)
      if (!fs.existsSync(abs)) stale.push(rel)
    }
    expect(stale).toEqual([])
  })
})
