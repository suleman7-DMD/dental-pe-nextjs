import { websiteTrust, TRUST_SOURCE_META } from '@/components/data-display/trust-source-tag'
import { isVerificationStale } from '@/lib/census/job-lane'
import type { JobHuntVerificationRecord } from '@/lib/supabase/queries/job-hunt-verification'
import type { Practice } from '@/lib/types'

/** Read-only projection: retain imported values alongside the existing website ruling. */
export function directoryContacts(
  practice: Pick<Practice, 'website'>,
  verification?: JobHuntVerificationRecord | null,
) {
  const website = websiteTrust(practice.website, verification)
  const doctors = verification?.doctors ?? []
  return {
    researched_doctors: doctors.map(d => d.name).filter(Boolean).join('; '),
    doctor_sources: doctors.filter(d => d.source_url).map(d => `${d.name}: ${d.source_url}`).join('; '),
    contact_website: website.url,
    contact_website_source: TRUST_SOURCE_META[website.source].label,
    research_checked_at: verification?.last_checked_at ?? null,
    research_status: verification?.verification_status ?? 'Not researched',
    research_ownership_status: verification?.ownership_evidence_status ?? 'Not researched',
    research_freshness: verification
      ? isVerificationStale(verification) ? 'Recheck needed' : 'Dated research — confirm before outreach'
      : 'Not researched',
    careers_page: verification?.careers_page_url ?? null,
  }
}

export const DIRECTORY_CONTACT_EXPORT_HEADERS = {
  phone: 'On-file Phone (unverified)',
  contact_website: 'Preferred Website',
  contact_website_source: 'Website Source / Status',
  website: 'Imported Website (original)',
  researched_doctors: 'Researched Doctor Names (not current staffing)',
  doctor_sources: 'Doctor Evidence URLs',
  research_checked_at: 'Research Checked At',
  research_status: 'Research Status',
  research_ownership_status: 'Research Ownership Evidence Status',
  research_freshness: 'Research Freshness',
  careers_page: 'Careers Page (not a confirmed opening)',
}
