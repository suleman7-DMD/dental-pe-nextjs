function SkeletonKpiCard() {
  return (
    <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4 animate-pulse">
      <div className="h-4 w-16 rounded bg-[#1E293B] mb-3" />
      <div className="h-8 w-24 rounded bg-[#1E293B] mb-2" />
      <div className="h-3 w-20 rounded bg-[#1E293B]" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4 animate-pulse">
      <div className="h-4 w-32 rounded bg-[#1E293B] mb-4" />
      <div className="h-[300px] w-full rounded bg-[#1E293B]" />
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-[#1E293B] mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-full rounded bg-[#1E293B]" />
        ))}
      </div>
    </div>
  )
}

export default function IntelligenceLoading() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded bg-[#1E293B] mb-2" />
        <div className="h-4 w-[480px] rounded bg-[#1E293B]" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Intel table */}
      <SkeletonTable />

      {/* Secondary charts */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Detail table */}
      <SkeletonTable />
    </div>
  )
}
