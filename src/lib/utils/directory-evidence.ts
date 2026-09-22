import type { Practice } from '@/lib/types'
import type { JobHuntVerificationRecord } from '@/lib/supabase/queries/job-hunt-verification'
import { getOwnershipRecord } from '@/lib/census/ownership-truth'
import { hasContactEvidence } from './directory-contacts'
import { getOfficeCoordinates } from './directory-visibility'

export interface ProviderResearch {
  npi: string
  research_date: string
  verification_quality: string | null
  verification_urls: string | null
  website_url: string | null
  services_listed: string | null
  provider_notes: string | null
}
export type ProviderResearchMap = Record<string, ProviderResearch>

export function researchUrls(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((u): u is string => {
      if (typeof u !== 'string') return false
      try { return ['http:', 'https:'].includes(new URL(u).protocol) } catch { return false }
    }) : []
  } catch { return [] }
}

export function getDirectoryEvidence(p: Practice, verification?: JobHuntVerificationRecord | null, intel: ProviderResearchMap = {}) {
  const ownership = getOwnershipRecord({
    ownership_tier: p.ownership_tier ?? null, pe_backed: p.pe_backed ?? null,
    ownership_evidence_basis: p.ownership_evidence_basis ?? null,
    ownership_evidence_urls: p.ownership_evidence_urls ?? null,
    ownership_confidence: p.ownership_confidence ?? null, network_id: p.network_id ?? null,
  })
  const ownershipUrls = researchUrls(JSON.stringify(ownership.evidenceUrls))
  const providerResearch = [...new Set([p.npi, ...(p.provider_npis ?? [])])]
    .map(npi => intel[npi]).filter((r): r is ProviderResearch => Boolean(r &&
      ['verified', 'partial'].includes(r.verification_quality ?? '') && researchUrls(r.verification_urls).length))
  const contact = hasContactEvidence(verification)
  const hasOfficeEvidence = ownershipUrls.length > 0 || contact
  return { ownershipUrls, contact, providerResearch, hasOfficeEvidence,
    hasAnyEvidence: hasOfficeEvidence || providerResearch.length > 0 }
}
export type DirectoryEvidence = ReturnType<typeof getDirectoryEvidence>

/** Provider-only research may concern another office; never use it to validate this address. */
export function officeMapDisposition(p: Practice, evidence: DirectoryEvidence) {
  const coordinates = getOfficeCoordinates(p)
  if (coordinates && evidence.hasOfficeEvidence) return 'mapped' as const
  if (!coordinates && evidence.hasOfficeEvidence) return 'missing_coordinates' as const
  if (coordinates) return 'missing_office_evidence' as const
  return 'missing_both' as const
}
