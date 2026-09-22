import { websiteTrust, TRUST_SOURCE_META } from '@/components/data-display/trust-source-tag'
import { isVerificationStale } from '@/lib/census/job-lane'
import type { JobHuntVerificationRecord } from '@/lib/supabase/queries/job-hunt-verification'
import type { Practice } from '@/lib/types'

export type DirectoryResearchFilter = 'all' | 'recent_evidence' | 'any_research' | 'any_evidence'

export function hasContactEvidence(verification?: JobHuntVerificationRecord | null): boolean {
  if (!verification) return false
  const webUrl = (value?: string | null) => {
    try { return ['http:', 'https:'].includes(new URL(value ?? '').protocol) } catch { return false }
  }
  return (verification.website_status === 'live' && webUrl(verification.website_url)) ||
    (verification.doctors ?? []).some(d => Boolean(d.name?.trim()) && webUrl(d.source_url))
}

/** Contact evidence is separate from ownership confidence and imported business data. */
export function matchesDirectoryResearch(
  verification: JobHuntVerificationRecord | null | undefined,
  filter: DirectoryResearchFilter,
  anyEvidence = false,
): boolean {
  if (filter === 'all') return true
  if (filter === 'any_evidence') return anyEvidence
  if (!verification) return false
  if (filter === 'any_research') return true
  const checked = Date.parse(verification.last_checked_at)
  if (!Number.isFinite(checked) || checked > Date.now() || isVerificationStale(verification)) return false
  return hasContactEvidence(verification)
}

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
