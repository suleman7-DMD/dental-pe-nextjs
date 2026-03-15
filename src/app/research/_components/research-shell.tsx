'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { SponsorProfile } from './sponsor-profile'
import { PlatformProfile } from './platform-profile'
import { StateDeepDive } from './state-deep-dive'
import { SqlExplorer } from './sql-explorer'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ResearchShellProps {
  sponsors: string[]
  platforms: string[]
  states: string[]
}

const TABS = [
  { id: 'sponsor', label: 'PE Sponsor Profile' },
  { id: 'platform', label: 'Platform Profile' },
  { id: 'state', label: 'State Deep Dive' },
  { id: 'sql', label: 'SQL Explorer' },
] as const

type TabId = (typeof TABS)[number]['id']

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function ResearchShell({ sponsors, platforms, states }: ResearchShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const currentTab = (searchParams.get('tab') as TabId) || 'sponsor'

  const setTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-sans font-bold text-2xl text-[#F8FAFC]">
            Research Tools
          </h1>
          <p className="text-[#94A3B8] text-sm mt-1 max-w-3xl">
            Deep-dive into specific PE sponsors, platforms, states, or write custom SQL queries.
            Use these tools to research specific companies or markets.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#1E293B]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                currentTab === tab.id
                  ? 'text-[#F8FAFC]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {tab.label}
              {currentTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {currentTab === 'sponsor' && <SponsorProfile sponsors={sponsors} />}
        {currentTab === 'platform' && <PlatformProfile platforms={platforms} />}
        {currentTab === 'state' && <StateDeepDive states={states} />}
        {currentTab === 'sql' && <SqlExplorer />}
      </div>
    </div>
  )
}
