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
  TrendingUp,
  Hospital,
  MapPin,
  Clock,
  Zap,
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
      accentColor: '#3B82F6',
    },
    {
      href: '/market-intel',
      icon: Map,
      title: 'Market Intel',
      description: 'ZIP consolidation analysis',
      stat: summary.watchedZips.toLocaleString(),
      statLabel: 'watched ZIPs',
      accentColor: '#22C55E',
    },
    {
      href: '/buyability',
      icon: Target,
      title: 'Buyability',
      description: 'Acquisition target scoring',
      stat: acquisitionTargets.toLocaleString(),
      statLabel: 'targets',
      accentColor: '#F59E0B',
    },
    {
      href: '/job-market',
      icon: Briefcase,
      title: 'Job Market',
      description: 'Career opportunity finder',
      stat: summary.totalPractices.toLocaleString(),
      statLabel: 'practices',
      accentColor: '#A855F7',
    },
    {
      href: '/research',
      icon: Microscope,
      title: 'Research',
      description: 'Deep dive tools',
      stat: summary.activeSponsors.toLocaleString(),
      statLabel: 'PE sponsors',
      accentColor: '#06B6D4',
    },
    {
      href: '/system',
      icon: Settings,
      title: 'System',
      description: 'Pipeline health',
      stat: summary.lastPipelineRun ?? '--',
      statLabel: 'last refresh',
      accentColor: '#64748B',
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
      className="group rounded-lg border border-[#1E293B] bg-[#0F1629] p-5 flex flex-col gap-3 hover:border-[#334155] hover:scale-[1.01] transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `${card.accentColor}1A` }}
        >
          <Icon className="h-6 w-6" style={{ color: card.accentColor }} />
        </div>
        <ArrowRight className="h-4 w-4 text-[#475569] group-hover:text-[var(--accent-color)] transition-colors" style={{ '--accent-color': card.accentColor } as React.CSSProperties} />
      </div>

      <div>
        <h3 className="font-bold text-[#F8FAFC] text-[16px]">{card.title}</h3>
        <p className="text-xs text-[#94A3B8] mt-0.5">{card.description}</p>
      </div>

      <div className="mt-auto pt-2 border-t border-[#1E293B]">
        <span className="text-[20px] font-mono font-bold" style={{ color: card.accentColor }}>{card.stat}</span>
        <span className="text-xs text-[#94A3B8] ml-1.5">{card.statLabel}</span>
      </div>
    </Link>
  )
}

function RecentDealsTable({ deals }: { deals: HomeSummary['recentDeals'] }) {
  if (!deals || deals.length === 0) {
    return (
      <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] p-6 text-center text-[#94A3B8] text-sm">
        No recent deals found.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#1E293B] bg-[#0F1629] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between bg-[#0A0F1E]">
        <h3 className="font-semibold text-[#F8FAFC] text-sm">Recent Deals</h3>
        <Link
          href="/deal-flow"
          className="text-xs text-[#3B82F6] hover:text-[#60A5FA] transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#1E293B] text-[#94A3B8] bg-[#0A0F1E]">
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
                className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/20 transition-colors"
              >
                <td className="px-4 py-2.5 text-[#94A3B8] font-mono text-xs">
                  {deal.deal_date ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#CBD5E1]">
                  {deal.platform_company ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#CBD5E1]">
                  {deal.target_name ?? '--'}
                </td>
                <td className="px-4 py-2.5 text-[#94A3B8] font-mono">
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
    <div className="min-h-screen bg-[#0A0F1E]">
      <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div>
          <h1 className="font-sans font-bold text-[28px] text-[#F8FAFC]">
            Dental PE Intelligence
          </h1>
          <p className="text-[#94A3B8] text-[14px] mt-2 max-w-2xl">
            Tracking consolidation across 400,962 practices in 290 markets
          </p>
        </div>

        {/* KPI Row — 4 columns max */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Total Deals"
            value={summary.totalDeals.toLocaleString()}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Active PE Sponsors"
            value={summary.activeSponsors.toLocaleString()}
            accentColor="#3B82F6"
          />
          <KpiCard
            icon={<Hospital className="h-4 w-4" />}
            label="Practices Tracked"
            value={summary.totalPractices.toLocaleString()}
          />
          <KpiCard
            icon={<MapPin className="h-4 w-4" />}
            label="Watched ZIPs"
            value={summary.watchedZips.toLocaleString()}
          />
          <KpiCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Known Corporate"
            value={summary.consolidatedPct.includes('%') ? summary.consolidatedPct : `${summary.consolidatedPct}%`}
            tooltip="High-confidence corporate rate in watched ZIPs (DSO brands + EIN-verified entities). See Market Intel for full tiered breakdown."
            accentColor="#EF4444"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Retirement Risk"
            value={summary.retirementRisk.toLocaleString()}
            accentColor="#F59E0B"
          />
          <KpiCard
            icon={<Zap className="h-4 w-4" />}
            label="Deals YTD"
            value={summary.ytdDeals.toLocaleString()}
            accentColor="#22C55E"
          />
          <KpiCard
            icon={<Activity className="h-4 w-4" />}
            label="Data Freshness"
            value={summary.lastPipelineRun ?? '--'}
          />
        </div>

        {/* Quick Nav Grid — 3x2 */}
        <div>
          <h2 className="font-sans font-semibold text-lg text-[#F8FAFC] mb-4">
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
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#1E293B] bg-[#0F1629] px-4 py-2.5 text-xs text-[#94A3B8]">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
          </span>
          <span>
            <span className="text-[#F8FAFC] font-medium">
              {summary.totalPractices.toLocaleString()}
            </span>{' '}
            practices
          </span>
          <span className="text-[#1E293B]">|</span>
          <span>
            <span className="text-[#F8FAFC] font-medium">
              {summary.totalDeals.toLocaleString()}
            </span>{' '}
            deals tracked
          </span>
          <span className="text-[#1E293B]">|</span>
          <span>
            <span className="text-[#F8FAFC] font-medium">
              {summary.enrichedCount.toLocaleString()}
            </span>{' '}
            enriched ({summary.totalPractices > 0 ? ((summary.enrichedCount / summary.totalPractices) * 100).toFixed(1) : '0.0'}%)
          </span>
          <span className="text-[#1E293B]">|</span>
          <span>
            <span className="text-[#F8FAFC] font-medium">
              {summary.watchedZips.toLocaleString()}
            </span>{' '}
            ZIPs monitored
          </span>
          {summary.lastPipelineRun && (
            <>
              <span className="text-[#1E293B]">|</span>
              <span>Last refresh: {summary.lastPipelineRun}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
