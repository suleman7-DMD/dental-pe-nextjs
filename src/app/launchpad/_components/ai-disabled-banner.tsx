// ai-disabled-banner.tsx — Server Component banner rendered when ANTHROPIC_API_KEY is absent.
// Audit §14.8 / §15 #1. Displayed above the LaunchpadShell when the env var is not set in Vercel.
// No client-side code needed — this is a pure CSS/HTML server-rendered component.

interface AiDisabledBannerProps {
  show: boolean
}

export function AiDisabledBanner({ show }: AiDisabledBannerProps) {
  if (!show) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-[#D4920B]/40 bg-[#D4920B]/10 px-4 py-3 text-sm text-[#1A1A1A]"
    >
      <span className="mt-0.5 shrink-0 text-[#D4920B]" aria-hidden="true">
        {/* Warning triangle inline SVG — no Lucide dependency needed in server component */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="font-medium text-[#D4920B]">
          AI features disabled — ANTHROPIC_API_KEY not set
        </p>
        <p className="mt-0.5 text-[#6B6B60]">
          The 6 AI-powered features (narrative, smart briefing, ask intel, interview prep,
          contract parser, ZIP mood) return 503 until the key is added to Vercel.{" "}
          <span className="font-mono text-[11px]">
            Vercel dashboard → dental-pe-nextjs → Settings → Environment Variables →
            add ANTHROPIC_API_KEY
          </span>
          . Ranking, scoring, and all data features work normally.
        </p>
      </div>
    </div>
  )
}
