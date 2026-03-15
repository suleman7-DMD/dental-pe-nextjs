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
      <div className="h-[400px] w-full rounded bg-[#F7F7F4]" />
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-[#F7F7F4] mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-8 w-full rounded bg-[#F7F7F4]" />
        ))}
      </div>
    </div>
  )
}

export default function DealFlowLoading() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-80 rounded bg-[#F7F7F4] mb-2" />
        <div className="h-4 w-[480px] rounded bg-[#F7F7F4] mb-1" />
        <div className="h-3 w-48 rounded bg-[#F7F7F4]" />
      </div>

      {/* Filter bar */}
      <div className="h-14 w-full rounded-[10px] bg-[#FFFFFF] border border-[#E8E5DE] animate-pulse" />

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* Timeline */}
      <SkeletonChart />

      {/* Sponsor / Platform side by side */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Map + top states */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <SkeletonChart />
        </div>
        <SkeletonChart />
      </div>

      {/* Specialty */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Deals table */}
      <SkeletonTable />
    </div>
  )
}
