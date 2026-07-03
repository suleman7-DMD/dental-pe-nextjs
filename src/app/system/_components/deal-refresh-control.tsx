'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Play, RefreshCcw, ShieldAlert } from 'lucide-react'

type RefreshMode = 'recent' | 'backfill_2020' | 'backfill_2018'

interface WorkflowRun {
  id: number
  status: string
  conclusion: string | null
  created_at: string
  updated_at: string
  html_url: string
  run_number: number
}

interface RefreshStatus {
  configured: boolean
  missing: string[]
  workflow: string
  branch: string
  runs: WorkflowRun[]
}

function statusLabel(run: WorkflowRun | undefined) {
  if (!run) return 'No runs yet'
  if (run.status !== 'completed') return 'Running'
  if (run.conclusion === 'success') return 'Succeeded'
  if (run.conclusion === 'failure') return 'Failed'
  return run.conclusion ?? 'Completed'
}

function formatTime(value: string | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function DealRefreshControl() {
  const [status, setStatus] = useState<RefreshStatus | null>(null)
  const [mode, setMode] = useState<RefreshMode>('recent')
  const [since, setSince] = useState('')
  const [pin, setPin] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadStatus() {
    const res = await fetch('/api/system/deal-refresh', { cache: 'no-store' })
    const json = (await res.json()) as RefreshStatus
    setStatus(json)
    setLoading(false)
  }

  useEffect(() => {
    loadStatus()
    const id = window.setInterval(loadStatus, 15000)
    return () => window.clearInterval(id)
  }, [])

  async function trigger() {
    setRunning(true)
    setMessage(null)
    try {
      const res = await fetch('/api/system/deal-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, since, dryRun, pin }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessage(json.error ?? 'Unable to start refresh')
      } else {
        setMessage(dryRun ? 'Dry run queued.' : 'Deal refresh queued.')
      }
      await loadStatus()
    } finally {
      setRunning(false)
    }
  }

  const latest = status?.runs?.[0]
  const configured = status?.configured ?? false

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E8E5DE] bg-white">
      <div className="border-b border-[#E8E5DE] bg-[#FAFAF7] px-5 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1A1A1A]">On-demand deal refresh</h3>
            <p className="mt-1 max-w-3xl text-sm text-[#6B6B60]">
              Runs the deal-flow scraper workflow, syncs the deals table, and shows the GitHub Actions run here.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F0] px-3 py-1 text-xs font-medium text-[#3D3D35]">
            <RefreshCcw className="h-3.5 w-3.5" />
            {loading ? 'Checking...' : statusLabel(latest)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {!configured && !loading ? (
            <div className="flex gap-3 rounded-[8px] border border-[#F3CFCF] bg-[#FFF8F8] p-4 text-sm text-[#6B2F2F]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold text-[#9F2F2F]">Workflow trigger is not configured.</p>
                <p className="mt-1">
                  Missing Vercel env vars: {(status?.missing ?? []).join(', ')}. Set those, then redeploy.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#707064]">Scope</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as RefreshMode)}
                className="h-10 w-full rounded-[6px] border border-[#D4D0C8] bg-white px-3 text-sm"
              >
                <option value="recent">Recent refresh</option>
                <option value="backfill_2020">Backfill to 2020</option>
                <option value="backfill_2018">Backfill to 2018</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#707064]">Since override</span>
              <input
                value={since}
                onChange={(e) => setSince(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="h-10 w-full rounded-[6px] border border-[#D4D0C8] bg-white px-3 text-sm"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#707064]">Operator PIN</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                type="password"
                placeholder="Required"
                className="h-10 w-full rounded-[6px] border border-[#D4D0C8] bg-white px-3 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={trigger}
              disabled={!configured || running}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1A1A1A] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
              {running ? 'Queueing...' : 'Run scrapers'}
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-[#3D3D35]">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-[#D4D0C8]"
              />
              Dry run only
            </label>
            {message ? <span className="text-sm text-[#6B6B60]">{message}</span> : null}
          </div>
        </div>

        <div className="rounded-[8px] border border-[#E8E5DE] bg-[#FAFAF7] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#707064]">Latest workflow</p>
          {latest ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Run</span>
                <span className="font-mono text-[#1A1A1A]">#{latest.run_number}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Started</span>
                <span className="text-[#1A1A1A]">{formatTime(latest.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#6B6B60]">Updated</span>
                <span className="text-[#1A1A1A]">{formatTime(latest.updated_at)}</span>
              </div>
              <a
                href={latest.html_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB]"
              >
                Open run log
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#6B6B60]">No workflow runs found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
