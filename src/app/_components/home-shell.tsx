'use client'

import Link from 'next/link'
import {
  BarChart3,
  Map,
  Target,
  Briefcase,
  Microscope,
  Settings,
  ArrowRight,
  Activity,
} from 'lucide-react'
import { KpiCard } from '@/components/data-display/kpi-card'
import type { HomeSummary } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface HomeShellProps {
  summary: HomeSummary
  acquisitionTargets: number
}

// ────────────────────────────────────────────────────────────────────────────
// Nav cards config
// ────────────────────────────────────────────────────────────────────────────

interface NavCard {
  href: string
  icon: React.ElementType
  title: string
  description: string
  stat: string | number
  statLabel: string
  accentColor: string
}

function buildNavCards(summary: HomeSummary, acquisitionTargets: number): NavCard[] {
  return [
    {
      href: '/deal-flow',
      icon: BarChart3,
      title: 'Deal Flow',
      description: 'PE deal tracking and analytics',
      stat: summary.totalDeals.toLocaleString(),
      statLabel: 'total deals',
      accentColor: '#0066FF',
    },
    {
      href: '/market-intel',
      icon: Map,
      title: 'Market Intel',
      description: 'ZIP consolidation analysis',
      stat: summary.watchedZips.toLocaleString(),
      statLabel: 'watched ZIPs',
      accentColor: '#00C853',
    },
    {
      href: '/buyability',
      icon: Target,
      title: 'Buyability',
      description: 'Acquisition target scoring',
      stat: acquisitionTargets.toLocaleString(),
      statLabel: 'targets',
      accentColor: '#FF6D00',
    },
    {
      href: '/job-market',
      icon: Briefcase,
      title: 'Job Market',
      description: 'Career opportunity finder',
      stat: summary.totalPractices.toLocaleString(),
      statLabel: 'practices',
      accentColor: '#7C4DFF',
    },
    {
      href: '/research',
      icon: Microscope,
      title: 'Research',
      description: 'Deep dive tools',
      stat: summary.activeSponsors.toLocaleString(),
      statLabel: 'PE sponsors',
      accentColor: '#00BCD4',
    },
    {
      href: '/system',
      icon: Settings,
      title: 'System',
      description: 'Pipeline health',
      stat: summary.lastPipelineRun ?? '--',
      statLabel: 'last refresh',
      accentColor: '#78909C',
    },
  ]
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function NavCardComponent({ card }: { card: NavCard }) {
  const Icon = card.icon

  return (
    <Link
      href={card.href}
      className="group rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-5 flex flex-col gap-3 hover:border-[#0066FF]/50 transition-all duration-200 hover:bg-[#161D2B]"
    >
      <div className="flex items-start justify-between">
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `${card.accentColor}15` }}
        >
          <Icon className="h-5 w-5" style={{ color: card.accentColor }} />
        </div>
        <ArrowRight className="h-4 w-4 text-[#2A3A4A] group-hover:text-[#0066FF] transition-colors" />
      </div>

      <div>
        <h3 className="font-semibold text-[#E8ECF1] text-sm">{card.title}</h3>
        <p className="text-xs text-[#8892A0] mt-0.5">{card.description}</p>
      </div>

      <div className="mt-auto pt-2 border-t border-[#1E2A3A]">
        <span className="text-xs font-mono text-[#E8ECF1]">{card.stat}</span>
        <span className="text-xs text-[#8892A0] ml-1">{card.statLabel}</span>
      </div>
    </Link>
  )
}

function RecentDealsTable({ deals }: { deals: HomeSummary['recentDeals'] }) {
  if (!deals || deals.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-6 text-center text-[#8892A0] text-sm">
        No recent deals found.
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1E2A3A] flex items-center justify-between">
        <h3 className="font-semibold text-[#E8ECF1] text-sm">Recent Deals</h3>
        <Link
          href="/deal-flow"
          className="text-xs text-[#0066FF] hover:text-[#3388FF] transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E2A3A] text-[#8892A0]">
              <th className="text-left px-4 py-2 font-medium text-xs">Date</th>
              <th className="text-left px-4 py-2 font-medium text-xs">Platform</th>
              <th className="text-left px-4 py-2 font-medium text-xs">Target</th>
              <th className="text-left px-4 py-2 font-medium text-xs">State</th>
              <th className="text-left px-4 py-2 font-medium text-xs">Type</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, idx) => (
              <tr
                key={deal.id ?? idx}
                className="border-b border-[#1E2A3A]/50 hover:bg-[#1E2A3A]/20 transition-colors"
              >
                <td className="px-4 py-2.5 text-[#8892A0] font-mono text-xs">
                  {deal.deal_date ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#E8ECF1]">
                  {deal.platform_company ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#E8ECF1]">
                  {deal.target_name ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#8892A0] font-mono">
                  {deal.target_state ?? '--'}
                </td>
                <td className="px-4 py-2.5">
                  <DealTypeBadge type={deal.deal_type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DealTypeBadge({ type }: { type: string | null }) {
  const colors: Record<string, string> = {
    buyout: 'bg-blue-500/10 text-blue-400',
    'add-on': 'bg-green-500/10 text-green-400',
    recapitalization: 'bg-purple-500/10 text-purple-400',
    growth: 'bg-cyan-500/10 text-cyan-400',
    de_novo: 'bg-amber-500/10 text-amber-400',
    partnership: 'bg-pink-500/10 text-pink-400',
  }

  const label = type ?? 'other'
  const cls = colors[label] ?? 'bg-gray-500/10 text-gray-400'

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function HomeShell({ summary, acquisitionTargets }: HomeShellProps) {
  const navCards = buildNavCards(summary, acquisitionTargets)

  return (
    <div className="min-h-screen bg-[#0B1121]">
      <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="font-['DM_Sans'] font-bold text-3xl text-[#E8ECF1]">
            Dental PE Intelligence
          </h1>
          <p className="text-[#8892A0] text-sm mt-2 max-w-2xl">
            Track private equity consolidation in US dentistry. Monitor deal flow,
            analyze market saturation, score acquisition targets, and assess pipeline health.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard
            icon="bar-chart"
            label="Total Deals"
            value={summary.totalDeals.toLocaleString()}
          />
          <KpiCard
            icon="trending-up"
            label="Active PE Sponsors"
            value={summary.activeSponsors.toLocaleString()}
            accentColor="#0066FF"
          />
          <KpiCard
            icon="hospital"
            label="Practices Tracked"
            value={summary.totalPractices.toLocaleString()}
          />
          <KpiCard
            icon="map-pin"
            label="Watched ZIPs"
            value={summary.watchedZips.toLocaleString()}
          />
          <KpiCard
            icon="bar-chart"
            label="Known Consolidated"
            value={summary.consolidatedPct}
            accentColor="#F44336"
          />
          <KpiCard
            icon="clock"
            label="Retirement Risk"
            value={summary.retirementRisk.toLocaleString()}
            accentColor="#FF3D00"
          />
          <KpiCard
            icon="zap"
            label="Deals YTD"
            value={summary.ytdDeals.toLocaleString()}
            accentColor="#00C853"
          />
          <KpiCard
            icon="activity"
            label="Data Freshness"
            value={summary.lastPipelineRun ?? '--'}
          />
        </div>

        {/* Quick Nav Grid */}
        <div>
          <h2 className="font-['DM_Sans'] font-semibold text-lg text-[#E8ECF1] mb-4">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {navCards.map((card) => (
              <NavCardComponent key={card.href} card={card} />
            ))}
          </div>
        </div>

        {/* Recent Deals Preview */}
        <RecentDealsTable deals={summary.recentDeals} />

        {/* Data Freshness Bar */}
        <div className="flex items-center gap-4 rounded-lg border border-[#1E2A3A] bg-[#141922] px-4 py-2.5 text-xs text-[#8892A0]">
          <Activity className="h-4 w-4 text-[#0066FF] shrink-0" />
          <span>
            <span className="text-[#E8ECF1] font-medium">
              {summary.totalPractices.toLocaleString()}
            </span>{' '}
            practices
          </span>
          <span className="text-[#1E2A3A]">|</span>
          <span>
            <span className="text-[#E8ECF1] font-medium">
              {summary.totalDeals.toLocaleString()}
            </span>{' '}
            deals tracked
          </span>
          <span className="text-[#1E2A3A]">|</span>
          <span>
            <span className="text-[#E8ECF1] font-medium">
              {summary.watchedZips.toLocaleString()}
            </span>{' '}
            ZIPs monitored
          </span>
          {summary.lastPipelineRun && (
            <>
              <span className="text-[#1E2A3A]">|</span>
              <span>Last refresh: {summary.lastPipelineRun}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
