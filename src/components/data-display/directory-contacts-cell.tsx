import type { Practice } from '@/lib/types'
import type { JobHuntVerificationRecord } from '@/lib/supabase/queries/job-hunt-verification'
import { directoryContacts } from '@/lib/utils/directory-contacts'
import { safeExternalUrl } from '@/lib/utils/safe-url'

function ResearchLink({ url, children }: { url: string; children: React.ReactNode }) {
  const href = safeExternalUrl(url)
  return href === '#' ? <span>{children}</span> : (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#8B6508] hover:underline">
      {children}
    </a>
  )
}

export function DirectoryContactsCell({ practice, verification }: {
  practice: Pick<Practice, 'website' | 'phone'>
  verification?: JobHuntVerificationRecord | null
}) {
  const contact = directoryContacts(practice, verification)
  const doctors = verification?.doctors ?? []
  const renderDoctors = (items: typeof doctors) => items.map((d, i) => (
    <div key={`${d.name}-${i}`}>
      {d.source_url ? <ResearchLink url={d.source_url}>{d.name}</ResearchLink> : d.name}
      {d.credential ? `, ${d.credential}` : ''}
    </div>
  ))
  return (
    <div className="min-w-[220px] max-w-[280px] whitespace-normal space-y-1 text-xs"
      onClick={event => event.stopPropagation()}>
      {practice.phone && <div>On-file phone: {practice.phone}</div>}
      {contact.contact_website && <div>
        {contact.contact_website_source === 'Suspected wrong'
          ? <span className="text-[#C23B3B]">Imported website disputed — confirm first</span>
          : <ResearchLink url={contact.contact_website}>Website</ResearchLink>}
        <span className="text-[#6B6B60]"> · {contact.contact_website_source}</span>
      </div>}
      {verification ? <>
        <div className="text-[#6B6B60]">Researched doctors (not current staffing):</div>
        {doctors.length ? renderDoctors(doctors.slice(0, 2)) : <div>No names on file</div>}
        {doctors.length > 2 && <details>
          <summary className="cursor-pointer text-[#8B6508]">{doctors.length - 2} more {doctors.length === 3 ? 'name' : 'names'}</summary>
          {renderDoctors(doctors.slice(2))}
        </details>}
        {contact.careers_page && <div>
          <ResearchLink url={contact.careers_page}>Careers page</ResearchLink>
          <span className="text-[#6B6B60]"> · openings unconfirmed</span>
        </div>}
        <div className="text-[11px] text-[#6B6B60]">
          Checked {contact.research_checked_at?.slice(0, 10) || 'date unavailable'}
          {contact.research_freshness === 'Recheck needed' ? ' · Recheck needed' : ' · Confirm before outreach'}
        </div>
        {verification.ownership_evidence_status === 'conflict' &&
          <div className="text-[11px] text-[#C23B3B]">Ownership evidence conflicts — see dossier</div>}
      </> : <div className="text-[11px] text-[#6B6B60]">Doctor research not on file · contacts unverified</div>}
    </div>
  )
}
