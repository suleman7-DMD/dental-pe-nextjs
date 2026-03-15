function SkeletonKpiCard() {
  return (
    <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
      <div className="h-4 w-16 rounded bg-[#F7F7F4] mb-3" />
      <div className="h-8 w-24 rounded bg-[#F7F7F4] mb-2" />
      <div className="h-3 w-20 rounded bg-[#F7F7F4]" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
      <div className="h-4 w-32 rounded bg-[#F7F7F4] mb-4" />
      <div className="h-[300px] w-full rounded bg-[#F7F7F4]" />
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-[#F7F7F4] mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-full rounded bg-[#F7F7F4]" />
        ))}
      </div>
    </div>
  )
}

export default function MarketIntelLoading() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-72 rounded bg-[#F7F7F4] mb-2" />
        <div className="h-4 w-[500px] rounded bg-[#F7F7F4]" />
      </div>

      {/* Data freshness bar */}
      <div className="h-12 w-full rounded-lg bg-[#FFFFFF] border border-[#E8E5DE] animate-pulse" />

      {/* Metro selector */}
      <div className="h-10 w-56 rounded bg-[#F7F7F4] animate-pulse" />

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* ADA benchmarks */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Map */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] animate-pulse">
        <div className="h-4 w-48 rounded bg-[#F7F7F4] m-4" />
        <div className="h-[500px] w-full rounded bg-[#F7F7F4]" />
      </div>

      {/* ZIP Score Table */}
      <SkeletonTable />

      {/* Practice tree */}
      <SkeletonTable />

      {/* Saturation table */}
      <SkeletonTable />
    </div>
  )
}
