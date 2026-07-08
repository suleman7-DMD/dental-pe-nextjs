import { ExternalLink } from "lucide-react"
import type { JobHuntVerificationRecord } from "@/lib/supabase/queries/job-hunt-verification"
import { deriveJobLane, type JobLaneResult } from "@/lib/census/job-lane"

// The job-hunt verification evidence block: who works there according to the
// practice's own website, whether they appear to be hiring, and the exact
// evidence behind both. Renders ONLY from a job_hunt_verification record —
// never from census tiers or Data-Axle estimates, which are separate layers.

const WEBSITE_STATUS_LABEL: Record<string, string> = {
  live: "Live",
  dead: "Dead / unreachable",
  parked: "Parked / placeholder",
  social_only: "Social media only",
  none_found: "None found",
}

const OWNERSHIP_EVIDENCE_LABEL: Record<string, string> = {
  consistent: "Consistent with the census answer",
  conflict: "Conflicts with the census answer",
  no_statement: "No ownership statement on the site",
}

function formatCheckedDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function JobHuntVerificationCard({
  record,
  lane,
}: {
  record: JobHuntVerificationRecord
  lane?: JobLaneResult
}) {
  const resolvedLane =
    lane ?? deriveJobLane({ website: record.website_url }, record)
  const doctors = Array.isArray(record.doctors) ? record.doctors : []
  const openings = Array.isArray(record.openings) ? record.openings : []
  const evidenceUrls = Array.isArray(record.evidence_urls) ? record.evidence_urls : []
  const conflict = record.ownership_evidence_status === "conflict"

  return (
    <div
      className="rounded-md border p-4"
      style={{ borderColor: `${resolvedLane.color}44`, backgroundColor: resolvedLane.bg }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#707064]">
          Job-Hunt Verification (website check)
        </h4>
        <span className="text-[11px] text-[#8F8E82]">
          Checked {formatCheckedDate(record.last_checked_at)}
        </span>
      </div>
      <div
        className="mt-1.5 text-[13px] font-semibold"
        style={{ color: resolvedLane.color }}
      >
        {resolvedLane.label}
      </div>
      <p className="mt-1 text-xs leading-5 text-[#3D3D35]">{resolvedLane.why}</p>
      <p className="mt-1 text-[11px] leading-4 text-[#8F8E82]">
        Separate layer from the ownership census and from Data-Axle staff/revenue
        estimates — this records what the practice&apos;s own website says.
      </p>

      {/* Doctors from the website */}
      <div className="mt-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[#707064]">
          Doctors on the website
          {record.provider_count_website != null
            ? ` (${record.provider_count_website})`
            : ""}
        </div>
        {doctors.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {doctors.map((d, i) => (
              <li key={i} className="text-[13px] text-[#1A1A1A]">
                <span className="font-medium">{d.name}</span>
                {d.credential && d.credential !== "unknown" ? (
                  <span className="text-[#6B6B60]">, {d.credential}</span>
                ) : null}
                {d.role && d.role !== "unknown" ? (
                  <span className="ml-1.5 rounded bg-[rgba(107,107,96,0.10)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#6B6B60]">
                    {d.role}
                  </span>
                ) : null}
                {d.source_url ? (
                  <a
                    href={d.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-[#8B6508] hover:text-[#1A1A1A]"
                  >
                    source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[#8F8E82]">
            None published on the site — confirming doctors needs a call.
          </p>
        )}
      </div>

      {/* Owner / operator as stated on the site */}
      <dl className="mt-3 space-y-1 text-[12px] leading-5">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-[#707064]">Owner/operator stated on site</dt>
          <dd className="text-right text-[#1A1A1A]">
            {record.owner_operator_stated ?? "Not stated"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-[#707064]">Ownership evidence</dt>
          <dd
            className="text-right font-medium"
            style={{ color: conflict ? "#C23B3B" : "#1A1A1A" }}
          >
            {OWNERSHIP_EVIDENCE_LABEL[record.ownership_evidence_status] ??
              record.ownership_evidence_status}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-[#707064]">Website</dt>
          <dd className="text-right text-[#1A1A1A]">
            {record.website_url ? (
              <a
                href={record.website_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#8B6508] hover:text-[#1A1A1A]"
              >
                {hostOf(record.website_url)}
              </a>
            ) : (
              "—"
            )}
            <span className="ml-1.5 text-[#8F8E82]">
              ({WEBSITE_STATUS_LABEL[record.website_status] ?? record.website_status})
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-[#707064]">Hiring</dt>
          <dd className="text-right text-[#1A1A1A]">
            {record.has_hiring_page ? (
              record.careers_page_url ? (
                <a
                  href={record.careers_page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#15803D] hover:text-[#1A1A1A]"
                >
                  Careers page on site
                </a>
              ) : (
                <span className="font-medium text-[#15803D]">
                  Hiring page found
                </span>
              )
            ) : (
              "No hiring page found on site"
            )}
          </dd>
        </div>
      </dl>

      {openings.length > 0 ? (
        <div className="mt-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#707064]">
            Openings found
          </div>
          <ul className="mt-1 space-y-0.5">
            {openings.map((o, i) => {
              const label = o.title ?? o.role ?? o.notes ?? "Opening"
              const href = o.url ?? o.source_url ?? null
              return (
                <li key={i} className="text-[12px] text-[#1A1A1A]">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#15803D] hover:text-[#1A1A1A]"
                    >
                      {label}
                    </a>
                  ) : (
                    label
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {record.notes ? (
        <p className="mt-2 border-l-2 border-[#D4D0C8] pl-2 text-[11px] leading-4 text-[#6B6B60]">
          {record.notes}
        </p>
      ) : null}

      {/* Evidence trail — every claim above traces to one of these */}
      {evidenceUrls.length > 0 ? (
        <div className="mt-3 border-t pt-2" style={{ borderColor: `${resolvedLane.color}22` }}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#707064]">
            Evidence ({evidenceUrls.length})
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {evidenceUrls.map((u, i) => (
              <li key={i}>
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-[#8B6508] hover:text-[#1A1A1A]"
                  title={u}
                >
                  {hostOf(u)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
