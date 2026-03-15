'use client'

import Link from 'next/link'
import {
  BarChart3,
  Map,
  Target,
  Briefcase,
  Microscope,
  ArrowRight,
  Activity,
  TrendingUp,
  Hospital,
  Clock,
  Zap,
  Building2,
  RefreshCw,
  Brain,
} from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import type { HomeSummary, PracticeChange } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface HomeShellProps {
  summary: HomeSummary
  acquisitionTargets: number
  recentChanges?: PracticeChange[]
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
    icon: Briefcase,
    title: 'Job Market',
    description: 'Career opportunity finder',
    accentColor: '#7C3AED',
  },
  {
    href: '/market-intel',
    icon: Map,
    title: 'Market Intel',
    description: 'ZIP consolidation analysis',
    accentColor: '#2D8B4E',
  },
  {
    href: '/buyability',
    icon: Target,
    title: 'Buyability',
    description: 'Acquisition target scoring',
    accentColor: '#D4920B',
  },
  {
    href: '/deal-flow',
    icon: BarChart3,
    title: 'Deal Flow',
    description: 'PE deal tracking and analytics',
    accentColor: '#B8860B',
  },
  {
    href: '/research',
    icon: Microscope,
    title: 'Research',
    description: 'Deep dive tools',
    accentColor: '#06B6D4',
  },
  {
    href: '/intelligence',
    icon: Brain,
    title: 'Intelligence',
    description: 'AI-powered market research',
    accentColor: '#C23B3B',
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
        <ArrowRight className="h-4 w-4 text-[#B5B5A8] group-hover:text-[var(--accent-color)] transition-colors" style={{ '--accent-color': card.accentColor } as React.CSSProperties} />
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

function RecentActivityFeed({ changes }: { changes?: PracticeChange[] }) {
  if (!changes || changes.length === 0) {
    return (
      <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-6 h-full flex items-center justify-center">
        <p className="text-[#9C9C90] text-sm">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center justify-between bg-[#F7F7F4]">
        <h3 className="font-semibold text-[#1A1A1A] text-sm">Recent Activity</h3>
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
            <span className="text-[11px] text-[#9C9C90] font-mono whitespace-nowrap shrink-0">
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

export function HomeShell({ summary, acquisitionTargets, recentChanges }: HomeShellProps) {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div>
          <h1 className="font-sans font-bold text-[28px] text-[#1A1A1A]">
            Dental PE Intelligence
          </h1>
          <p className="text-[#6B6B60] text-[14px] mt-2 max-w-2xl">
            Tracking consolidation across {summary.totalPractices.toLocaleString()} practices in {summary.watchedZips.toLocaleString()} markets
          </p>
        </div>

        {/* KPI Strip — 6 cards in horizontal flex */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={<Hospital className="h-4 w-4" />}
            label="Total Practices"
            value={summary.totalPractices.toLocaleString()}
          />
          <KpiCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="PE Deals"
            value={summary.totalDeals.toLocaleString()}
            subtitle={
              <span className="text-xs text-[#6B6B60]">
                {summary.ytdDeals.toLocaleString()} YTD
              </span>
            }
            accentColor="#B8860B"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Known Corporate"
            value={summary.consolidatedPct.includes('%') ? summary.consolidatedPct : `${summary.consolidatedPct}%`}
            tooltip="High-confidence corporate rate in watched ZIPs (DSO brands + EIN-verified entities). See Market Intel for full tiered breakdown."
            accentColor="#C23B3B"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Retirement Risk"
            value={summary.retirementRisk.toLocaleString()}
            accentColor="#D4920B"
          />
          <KpiCard
            icon={<Zap className="h-4 w-4" />}
            label="Acquisition Targets"
            value={acquisitionTargets.toLocaleString()}
            accentColor="#2D8B4E"
          />
          <KpiCard
            icon={<Activity className="h-4 w-4" />}
            label="Data Freshness"
            value={summary.lastPipelineRun ?? '--'}
          />
        </div>

        {/* Two-column layout: Recent Deals + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentDealsTable deals={summary.recentDeals} />
          <RecentActivityFeed changes={recentChanges} />
        </div>

        {/* Data Freshness Bar */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] px-4 py-2.5 text-xs text-[#6B6B60]">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2D8B4E] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2D8B4E]" />
          </span>
          <span>
            <span className="text-[#1A1A1A] font-medium">
              {summary.totalPractices.toLocaleString()}
            </span>{' '}
            practices
          </span>
          <span className="text-[#E8E5DE]">|</span>
          <span>
            <span className="text-[#1A1A1A] font-medium">
              {summary.totalDeals.toLocaleString()}
            </span>{' '}
            deals tracked
          </span>
          <span className="text-[#E8E5DE]">|</span>
          <span>
            <span className="text-[#1A1A1A] font-medium">
              {summary.enrichedCount.toLocaleString()}
            </span>{' '}
            enriched ({summary.totalPractices > 0 ? ((summary.enrichedCount / summary.totalPractices) * 100).toFixed(1) : '0.0'}%)
          </span>
          <span className="text-[#E8E5DE]">|</span>
          <span>
            <span className="text-[#1A1A1A] font-medium">
              {summary.watchedZips.toLocaleString()}
            </span>{' '}
            ZIPs monitored
          </span>
          {summary.lastPipelineRun && (
            <>
              <span className="text-[#E8E5DE]">|</span>
              <span>Last refresh: {summary.lastPipelineRun}</span>
            </>
          )}
        </div>

        {/* Quick Nav Cards */}
        <div>
          <h2 className="font-sans font-semibold text-lg text-[#1A1A1A] mb-4">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {NAV_CARDS.map((card) => (
              <NavCardComponent key={card.href} card={card} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
