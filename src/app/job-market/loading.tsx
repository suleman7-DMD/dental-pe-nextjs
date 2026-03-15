function SkeletonKpiCard() {
  return (
    <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
      <div className="h-4 w-16 rounded bg-[#1E2A3A] mb-3" />
      <div className="h-8 w-24 rounded bg-[#1E2A3A] mb-2" />
      <div className="h-3 w-20 rounded bg-[#1E2A3A]" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
      <div className="h-4 w-32 rounded bg-[#1E2A3A] mb-4" />
      <div className="h-[300px] w-full rounded bg-[#1E2A3A]" />
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-[#1E2A3A] mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-full rounded bg-[#1E2A3A]" />
        ))}
      </div>
    </div>
  )
}

export default function JobMarketLoading() {
  return (
    <div className="min-h-screen bg-[#0B1121] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded bg-[#1E2A3A] mb-2" />
        <div className="h-4 w-[500px] rounded bg-[#1E2A3A]" />
      </div>

      {/* Data freshness bar */}
      <div className="h-12 w-full rounded-lg bg-[#141922] border border-[#1E2A3A] animate-pulse" />

      {/* Location selector */}
      <div className="h-10 w-64 rounded bg-[#1E2A3A] animate-pulse" />

      {/* KPI cards row 1 */}
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonKpiCard key={`r1-${i}`} />
        ))}
      </div>

      {/* KPI cards row 2 */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonKpiCard key={`r2-${i}`} />
        ))}
      </div>

      {/* Map placeholder */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] animate-pulse">
        <div className="h-4 w-48 rounded bg-[#1E2A3A] m-4" />
        <div className="h-[500px] w-full rounded bg-[#1E2A3A]" />
      </div>

      {/* Charts 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Directory */}
      <SkeletonTable />
    </div>
  )
}
