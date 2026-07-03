import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_OWNER = 'suleman7-DMD'
const DEFAULT_REPO = 'dental-pe-tracker'
const DEFAULT_WORKFLOW = 'deal-flow-refresh.yml'
const DEFAULT_BRANCH = 'main'

function getConfig() {
  const token = process.env.GITHUB_ACTIONS_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT
  const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO
  const workflow = process.env.GITHUB_DEAL_FLOW_WORKFLOW || DEFAULT_WORKFLOW
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH
  const pin = process.env.SCRAPER_RUN_PIN
  const missing = [
    !token ? 'GITHUB_ACTIONS_TOKEN' : null,
    !pin ? 'SCRAPER_RUN_PIN' : null,
  ].filter(Boolean) as string[]
  return { token, owner, repo, workflow, branch, pin, missing }
}

function githubHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchRuns(config: ReturnType<typeof getConfig>) {
  if (!config.token) return []
  const url = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/runs`,
  )
  url.searchParams.set('branch', config.branch)
  url.searchParams.set('per_page', '5')

  const res = await fetch(url, {
    headers: githubHeaders(config.token),
    cache: 'no-store',
  })
  if (!res.ok) {
    return []
  }
  const json = await res.json()
  return (json.workflow_runs ?? []).map((run: Record<string, unknown>) => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    created_at: run.created_at,
    updated_at: run.updated_at,
    html_url: run.html_url,
    run_number: run.run_number,
  }))
}

export async function GET() {
  const config = getConfig()
  const runs = await fetchRuns(config)
  return NextResponse.json({
    configured: config.missing.length === 0,
    missing: config.missing,
    workflow: config.workflow,
    branch: config.branch,
    runs,
  })
}

export async function POST(req: NextRequest) {
  const config = getConfig()
  if (config.missing.length > 0 || !config.token || !config.pin) {
    return NextResponse.json(
      { error: 'Deal refresh is not configured', missing: config.missing },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  if (body.pin !== config.pin) {
    return NextResponse.json({ error: 'Invalid operator PIN' }, { status: 401 })
  }

  const mode = ['recent', 'backfill_2020', 'backfill_2018'].includes(body.mode)
    ? body.mode
    : 'recent'
  const since = typeof body.since === 'string' ? body.since.trim() : ''
  const dryRun = body.dryRun ? 'true' : 'false'

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        ...githubHeaders(config.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: config.branch,
        inputs: {
          mode,
          since,
          dry_run: dryRun,
        },
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: 'GitHub workflow dispatch failed', detail: text },
      { status: res.status },
    )
  }

  const runs = await fetchRuns(config)
  return NextResponse.json({
    ok: true,
    mode,
    since,
    dryRun,
    workflow: config.workflow,
    branch: config.branch,
    runs,
  })
}
