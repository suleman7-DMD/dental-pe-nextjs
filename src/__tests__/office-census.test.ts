import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { OfficeCensusShell } from "@/app/office-census/_components/office-census-shell"
import type { OfficeCensusCandidate, OfficeCensusZipCoverage } from "@/lib/supabase/queries/office-census"

vi.stubGlobal("React", React)

it("keeps historical evidence, deferred rows and independent discovery distinct", () => {
  const coverage = { zip: "60602", city: "Chicago", directory_rows: 1, stage: "not_started",
    p1_items: 0, p2_items: 0, p4_deferred: 1, candidate_decisions: 0,
    discovery_status: "pass_recorded", last_discovery_at: "2026-09-24",
    discovery_passes: [{ entry_id: "pass", completed_at: "2026-09-24", sources_searched: ["office_website"], notes: "Searched public location pages; payer directory unavailable", findings: [] }],
    sources_searched: [], batch_rank: 1,
  } as unknown as OfficeCensusZipCoverage
  const candidate = { candidate_id: "loc:test", zip: "60602", name: "Example Dental", address: "1 Main",
    queue_state: "EXISTING_EVIDENCE_NO_CURRENT_CONTRADICTION", priority: 4, effort: "deferred",
    flags: [], source_refs: { records: [{ address: "1 Main Suite 200", source_id: "original" }] },
    prior_evidence: { historical_observations: [{ observation_id: "hist:1", source: "job_hunt_site_check",
      observed_at: "2026-07-10", claim_scope: ["contact"], evidence: { website_url: "https://example.com" } }] },
    prior_evidence_level: "researched", coord_status: "none",
  } as unknown as OfficeCensusCandidate
  const html = renderToStaticMarkup(React.createElement(OfficeCensusShell, {
    coverage: [coverage], selectedZip: "60602", candidates: [candidate], build: null, error: null,
  }))
  for (const text of ["P4 Deferred existing", "P3 Independent discovery", "Adjudicated", "2026-07-10",
    "Suite 200", "payer directory unavailable", "not confirmed missing offices"]) expect(html).toContain(text)
  expect(html).not.toContain("two independent sources")
  expect(html).not.toContain("Discovery done")
})
