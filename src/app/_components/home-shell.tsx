'use client'

import Link from 'next/link'
import {
  BarChart3,
  Target,
  Briefcase,
  Microscope,
  ArrowRight,
  Zap,
  Building2,
  RefreshCw,
  Brain,
  Crosshair,
  AlertTriangle,
  Database,
  FileCheck2,
  GitBranch,
  Layers3,
  MapPinned,
  ShieldCheck,
  Search,
} from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import type { HomeSummary, PracticeChange } from '@/lib/types'
import type { CensusSummary } from '@/lib/supabase/queries/census'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface HomeShellProps {
  summary: HomeSummary
  acquisitionTargets: number
  recentChanges: PracticeChange[] | null
  censusSummary: CensusSummary
}

// ────────────────────────────────────────────────────────────────────────────
// Nav cards config
// ────────────────────────────────────────────────────────────────────────────

interface NavCard {
  href: string
  icon: React.ElementType
  title: string
  description: string
  accentColor: string
}

const NAV_CARDS: NavCard[] = [
  {
    href: '/job-market',
    icon: Database,
    title: 'Directory',
    description: 'Every Chicagoland GP location',
    accentColor: '#B8860B',
  },
  {
    href: '/market-intel',
    icon: GitBranch,
    title: 'Ownership',
    description: 'Census coverage and owner trees',
    accentColor: '#2D8B4E',
  },
  {
    href: '/launchpad',
    icon: Briefcase,
    title: 'Job Hunt',
    description: 'Career search from verified ownership',
    accentColor: '#7C3AED',
  },
  {
    href: '/buyability',
    icon: Target,
    title: 'Acquisition Scout',
    description: 'Succession and buy-side research',
    accentColor: '#D4920B',
  },
  {
    href: '/warroom',
    icon: Crosshair,
    title: 'Review Desk',
    description: 'Rows that need a closer look',
    accentColor: '#C23B3B',
  },
  {
    href: '/deal-flow',
    icon: BarChart3,
    title: 'PE Deals',
    description: 'Separated deal archive and sponsors',
    accentColor: '#6366F1',
  },
  {
    href: '/research',
    icon: Microscope,
    title: 'Evidence',
    description: 'Sponsor, platform, and proof library',
    accentColor: '#06B6D4',
  },
  {
    href: '/intelligence',
    icon: Brain,
    title: 'Research Notes',
    description: 'Practice and ZIP context',
    accentColor: '#8B5CF6',
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function NavCardComponent({ card }: { card: NavCard }) {
  const Icon = card.icon

  return (
    <Link
      href={card.href}
      className="group rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5 flex flex-col gap-3 hover:border-[#D4D0C8] hover:bg-[#F7F7F4] hover:scale-[1.01] transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `color-mix(in srgb, ${card.accentColor} 10%, #FFFFFF)` }}
        >
          <Icon className="h-5 w-5" style={{ color: card.accentColor }} />
        </div>
        <ArrowRight className="h-4 w-4 text-[#8F8E82] group-hover:text-[var(--accent-color)] transition-colors" style={{ '--accent-color': card.accentColor } as React.CSSProperties} />
      </div>

      <div>
        <h3 className="font-semibold text-[#1A1A1A] text-[15px]">{card.title}</h3>
        <p className="text-xs text-[#6B6B60] mt-0.5">{card.description}</p>
      </div>
    </Link>
  )
}

function RecentDealsTable({ deals }: { deals: HomeSummary['recentDeals'] }) {
  if (!deals || deals.length === 0) {
    return (
      <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 text-center text-[#6B6B60] text-sm">
        No recent deals found.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center justify-between bg-[#F7F7F4]">
        <h3 className="font-semibold text-[#1A1A1A] text-sm">Recent Deals</h3>
        <Link
          href="/deal-flow"
          className="text-xs text-[#B8860B] hover:text-[#8B6508] transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E8E5DE] text-[#6B6B60] bg-[#F7F7F4]">
              <th className="text-left px-4 py-2 font-medium text-xs">Date</th>
              <th className="text-left px-4 py-2 font-medium text-xs">Target</th>
              <th className="text-left px-4 py-2 font-medium text-xs">Sponsor</th>
              <th className="text-left px-4 py-2 font-medium text-xs">Platform</th>
              <th className="text-left px-4 py-2 font-medium text-xs">State</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, idx) => (
              <tr
                key={deal.id ?? idx}
                className="border-b border-[#E8E5DE]/50 hover:bg-[#F7F7F4]/60 transition-colors"
              >
                <td className="px-4 py-2.5 text-[#6B6B60] font-mono text-xs whitespace-nowrap">
                  {deal.deal_date ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#1A1A1A] font-medium">
                  {deal.target_name ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#3D3D35]">
                  {deal.pe_sponsor ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#3D3D35]">
                  {deal.platform_company ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#6B6B60] font-mono">
                  {deal.target_state ?? '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getChangeIcon(changeType: string | null, fieldChanged: string | null) {
  if (changeType === 'ownership_change' || fieldChanged === 'ownership_status' || fieldChanged === 'affiliated_dso') {
    return <Building2 className="h-4 w-4 text-[#C23B3B]" />
  }
  if (fieldChanged === 'practice_name' || fieldChanged === 'doing_business_as') {
    return <RefreshCw className="h-4 w-4 text-[#D4920B]" />
  }
  return <ArrowRight className="h-4 w-4 text-[#B8860B]" />
}

function formatChangeDescription(change: PracticeChange): string {
  const field = change.field_changed ?? 'unknown field'
  const friendlyField = field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  if (change.old_value && change.new_value) {
    return `${friendlyField}: ${change.old_value} → ${change.new_value}`
  }
  if (change.new_value) {
    return `${friendlyField} set to ${change.new_value}`
  }
  if (change.change_type) {
    return `${change.change_type.replace(/_/g, ' ')}: ${friendlyField}`
  }
  return `${friendlyField} updated`
}

function RecentActivityFeed({ changes }: { changes: PracticeChange[] | null }) {
  if (changes === null) {
    // Fetch failed — surface the error instead of silently showing empty state
    return (
      <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 h-full flex items-center justify-center">
        <p className="text-[#707064] text-sm">Activity feed unavailable</p>
      </div>
    )
  }
  if (changes.length === 0) {
    return (
      <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 h-full flex items-center justify-center">
        <p className="text-[#707064] text-sm">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center justify-between bg-[#F7F7F4]">
        <h3 className="font-semibold text-[#1A1A1A] text-sm">Recent Activity <span className="font-normal text-[11px] text-[#9C9C90] ml-1">· Watched ZIPs</span></h3>
        <Link
          href="/market-intel"
          className="text-xs text-[#B8860B] hover:text-[#8B6508] transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {changes.map((change, idx) => (
          <div
            key={`${change.npi}-${change.change_date}-${idx}`}
            className={`px-4 py-3 flex items-start gap-3 ${
              idx < changes.length - 1 ? 'border-b border-[#E8E5DE]' : ''
            } hover:bg-[#F7F7F4]/60 transition-colors`}
          >
            <div className="mt-0.5 shrink-0">
              {getChangeIcon(change.change_type, change.field_changed)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#1A1A1A] truncate">
                NPI: {change.npi}
              </p>
              <p className="text-xs text-[#6B6B60] mt-0.5 truncate">
                {formatChangeDescription(change)}
              </p>
            </div>
            <span className="text-[11px] text-[#707064] font-mono whitespace-nowrap shrink-0">
              {change.change_date ?? '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null
  // Parse as UTC noon to avoid TZ off-by-one on date-only strings
  const then = new Date(`${dateStr}T12:00:00Z`).getTime()
  if (Number.isNaN(then)) return null
  const now = Date.now()
  return Math.floor((now - then) / (24 * 60 * 60 * 1000))
}

function formatPct(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`
}

const TIER_ROWS = [
  { key: 'true_independent', label: 'T1 True independent', color: '#2563EB' },
  { key: 'single_loc_group', label: 'T2 Single-location group', color: '#0D9488' },
  { key: 'dentist_multi', label: 'T3 Dentist-owned multi', color: '#6366F1' },
  { key: 'stealth_dso', label: 'T4 Stealth DSO', color: '#D4920B' },
  { key: 'branded_dso', label: 'T5 Branded DSO', color: '#C23B3B' },
  { key: 'institutional', label: 'T6 Institutional', color: '#6B7280' },
]

function TierBreakdown({ census }: { census: CensusSummary }) {
  const reviewed = Math.max(census.reviewed, 1)

  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
      <div className="border-b border-[#E8E5DE] bg-[#F7F7F4] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Reviewed Ownership Mix</h3>
        <p className="mt-0.5 text-xs text-[#6B6B60]">
          Percentages are among reviewed rows only. Unreviewed locations are held out.
        </p>
      </div>
      <div className="space-y-3 p-4">
        {TIER_ROWS.map((tier) => {
          const count = census.tierCounts[tier.key] ?? 0
          const width = `${Math.max((count / reviewed) * 100, count > 0 ? 2 : 0)}%`
          return (
            <div key={tier.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-[#1A1A1A]">{tier.label}</span>
                <span className="font-mono text-[#6B6B60]">
                  {count.toLocaleString()} · {formatPct((count / reviewed) * 100)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F0EEE8]">
                <div
                  className="h-full rounded-full"
                  style={{ width, backgroundColor: tier.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CensusStatusModel({ census }: { census: CensusSummary }) {
  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF]">
      <div className="border-b border-[#E8E5DE] bg-[#F7F7F4] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">What We Know</h3>
        <p className="mt-0.5 text-xs text-[#6B6B60]">
          Reviewed, needs-evidence, and not-reviewed rows stay separate so the app never fills
          gaps with guesses.
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6B6B60]">
            <FileCheck2 className="h-3.5 w-3.5" />
            Verified
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[#1A1A1A]">
              {census.classifiedReviewed.toLocaleString()}
            </span>
            <span className="text-xs text-[#6B6B60]">ownership calls</span>
          </div>
          <p className="mt-2 text-xs text-[#6B6B60]">
            Evidence-backed rows written to the live database.
          </p>
        </div>
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6B6B60]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Needs Evidence
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[#1A1A1A]">
              {census.undeterminedReviewed.toLocaleString()}
            </span>
            <span className="text-xs text-[#6B6B60]">researched, not guessed</span>
          </div>
          <p className="mt-2 text-xs text-[#6B6B60]">
            The team looked, but the public evidence was not strong enough.
          </p>
        </div>
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[#6B6B60]">
            Not Reviewed Yet
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#1A1A1A]">
            {census.unreviewed.toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-[#6B6B60]">
            No synced ownership conclusion yet. These remain unknown.
          </p>
        </div>
        <div className="rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[#6B6B60]">
            Batch Progress
          </div>
          <div className="mt-2 text-sm font-semibold text-[#1A1A1A]">
            Appears after sync
          </div>
          <p className="mt-2 text-xs text-[#6B6B60]">
            Research batches will show here once Fable syncs their review status into the app.
          </p>
        </div>
      </div>
    </div>
  )
}

export function HomeShell({ summary, acquisitionTargets, recentChanges, censusSummary }: HomeShellProps) {
  const daysSinceLastNewDeal = daysBetween(summary.lastNewDealDate)
  const dealFlowStale = daysSinceLastNewDeal !== null && daysSinceLastNewDeal > 30

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-sans text-[28px] font-bold text-[#1A1A1A]">
                  Chicagoland Dental Directory
                </h1>
                <span className="rounded-full border border-[#B8860B]/30 bg-[#B8860B]/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#8B6508]">
                  Verified ownership layer
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#6B6B60]">
                Search every GP practice, see who owns it, and use the same record for job
                hunting or acquisition research. Reviewed rows are labeled with evidence;
                unreviewed rows stay honest until the census catches up.
              </p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-2 rounded-md border border-[#E8E5DE] bg-[#FAFAF7] p-3 text-xs">
              <span className="text-[#6B6B60]">Mode</span>
              <span className="text-right font-medium text-[#1A1A1A]">Directory</span>
              <span className="text-[#6B6B60]">Live reviewed</span>
              <span className="text-right font-mono font-bold text-[#1A1A1A]">
                {censusSummary.reviewed.toLocaleString()}
              </span>
              <span className="text-[#6B6B60]">Not reviewed</span>
              <span className="text-right font-mono font-bold text-[#1A1A1A]">
                {censusSummary.unreviewed.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Honesty banner: only fires when MAX(deal_date) is >30d old. Distinguishes
            "source flowing" from "source dry" — the Data Freshness KPI alone can lie
            because it tracks last sync run, not last new deal. */}
        {dealFlowStale && (
          <div className="flex items-start gap-3 rounded-lg border border-[#D4920B]/40 bg-[#FFF7E5] px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#D4920B] mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A1A]">
                Last new deal: {summary.lastNewDealDate} ({daysSinceLastNewDeal}d ago)
              </p>
              <p className="text-xs text-[#6B6B60] mt-1">
                Pipeline syncs are running normally
                {summary.lastPipelineRun ? ` (last sync ${summary.lastPipelineRun})` : ''}
                , but no new deals have been announced upstream. GDN&apos;s next monthly
                roundup hasn&apos;t published yet — historical deals remain queryable.
              </p>
            </div>
          </div>
        )}

        {/* Census KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={<Database className="h-4 w-4" />}
            label="GP Universe"
            value={censusSummary.universe.toLocaleString()}
            subtitle={<span className="text-xs text-[#6B6B60]">IL watched-ZIP locations</span>}
            tooltip="The Chicagoland general-practice location universe. This is a location count, not the federal NPI-row count."
          />
          <KpiCard
            icon={<FileCheck2 className="h-4 w-4" />}
            label="Reviewed"
            value={censusSummary.reviewed.toLocaleString()}
            subtitle={<span className="text-xs text-[#6B6B60]">{formatPct(censusSummary.coveragePct)} coverage</span>}
            accentColor="#B8860B"
          />
          <KpiCard
            icon={<GitBranch className="h-4 w-4" />}
            label="DSO/PE"
            value={censusSummary.dsoPeReviewed.toLocaleString()}
            subtitle={<span className="text-xs text-[#6B6B60]">{formatPct(censusSummary.dsoPeWholeFloorPct)} whole-universe floor</span>}
            tooltip="T4 stealth DSO + T5 branded DSO rows that have earned a census tier. Whole-universe floor holds unreviewed rows out as unknown."
            accentColor="#C23B3B"
          />
          <KpiCard
            icon={<Layers3 className="h-4 w-4" />}
            label="Multi-Location"
            value={censusSummary.multiLocationReviewed.toLocaleString()}
            subtitle={<span className="text-xs text-[#6B6B60]">T3-T5 among reviewed</span>}
            tooltip="T3 dentist-owned multi-location groups, T4 stealth DSOs, and T5 branded DSOs. T2 single-location groups stay independent."
            accentColor="#6366F1"
          />
          <KpiCard
            icon={<Zap className="h-4 w-4" />}
            label="Scout Queue"
            value={acquisitionTargets.toLocaleString()}
            subtitle={<span className="text-xs text-[#6B6B60]">legacy heuristic</span>}
            tooltip="Existing buyability/acquisition heuristic. It remains useful as a signal, but should be filtered through reviewed census ownership before final action."
            accentColor="#2D8B4E"
          />
          <KpiCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Legacy Floor"
            value={formatPct(censusSummary.legacyCorporatePct)}
            subtitle={<span className="text-xs text-[#6B6B60]">{censusSummary.legacyCorporateLocations.toLocaleString()} detector corp rows</span>}
            tooltip="Old entity_classification / zip_scores corporate floor. It is retained for comparison and should not be presented as the true consolidation rate."
            accentColor="#8F8E82"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <TierBreakdown census={censusSummary} />
          <CensusStatusModel census={censusSummary} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#B8860B]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Find Any Practice</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#6B6B60]">
              Start from the practice itself: address, ownership, evidence, job context, and
              acquisition signals in one place.
            </p>
            <Link href="/job-market" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#B8860B]">
              Open Directory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-[#2D8B4E]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">See Who Owns It</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#6B6B60]">
              Ownership analytics start with coverage. A ZIP is not called low-corporate until
              the reviewed evidence supports that conclusion.
            </p>
            <Link href="/market-intel" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#B8860B]">
              Open Ownership <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#06B6D4]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Open the Proof</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#6B6B60]">
              Each ownership claim should lead to a locator, practice site, filing,
              acquisition citation, or a clear reason it needs more review.
            </p>
            <Link href="/research" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#B8860B]">
              Open Evidence <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-sans text-lg font-semibold text-[#1A1A1A]">
            Where to Go
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {NAV_CARDS.map((card) => (
              <NavCardComponent key={card.href} card={card} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityFeed changes={recentChanges} />
          <RecentDealsTable deals={summary.recentDeals} />
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] px-4 py-2.5 text-xs text-[#6B6B60]">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2D8B4E] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2D8B4E]" />
          </span>
          <span><span className="font-medium text-[#1A1A1A]">{summary.totalPractices.toLocaleString()}</span> national NPI records</span>
          <span className="text-[#E8E5DE]">|</span>
          <span><span className="font-medium text-[#1A1A1A]">{summary.watchedZips.toLocaleString()}</span> IL ZIPs monitored</span>
          <span className="text-[#E8E5DE]">|</span>
          <span><span className="font-medium text-[#1A1A1A]">{summary.totalDeals.toLocaleString()}</span> PE deals archived</span>
          {summary.lastPipelineRun && (
            <>
              <span className="text-[#E8E5DE]">|</span>
              <span>Last sync: {summary.lastPipelineRun}</span>
            </>
          )}
          {summary.lastNewDealDate && (
            <>
              <span className="text-[#E8E5DE]">|</span>
              <span>Last new deal: {summary.lastNewDealDate}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
