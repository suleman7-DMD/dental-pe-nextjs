function SkeletonKpiCard() {
  return (
    <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
      <div className="h-4 w-16 rounded bg-[#1E2A3A] mb-3" />
      <div className="h-8 w-24 rounded bg-[#1E2A3A] mb-2" />
      <div className="h-3 w-20 rounded bg-[#1E2A3A]" />
    </div>
  )
}

export default function BuyabilityLoading() {
  return (
    <div className="min-h-screen bg-[#0B1121] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-56 rounded bg-[#1E2A3A] mb-2" />
        <div className="h-4 w-[480px] rounded bg-[#1E2A3A]" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="h-10 w-48 rounded bg-[#1E2A3A] animate-pulse" />
        <div className="h-10 w-48 rounded bg-[#1E2A3A] animate-pulse" />
      </div>

      {/* Table */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#1E2A3A] mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-[#1E2A3A]" />
          ))}
        </div>
      </div>
    </div>
  )
}
