export default function ResearchLoading() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded bg-[#1E293B] mb-2" />
        <div className="h-4 w-[420px] rounded bg-[#1E293B]" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-36 rounded bg-[#1E293B]" />
        ))}
      </div>

      {/* Selector */}
      <div className="h-10 w-64 rounded bg-[#1E293B] animate-pulse" />

      {/* KPI */}
      <div className="h-20 w-full rounded-[10px] border border-[#1E293B] bg-[#0F1629] animate-pulse" />

      {/* Chart placeholder */}
      <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] animate-pulse">
        <div className="h-[350px] w-full rounded bg-[#1E293B]" />
      </div>

      {/* Table */}
      <div className="rounded-[10px] border border-[#1E293B] bg-[#0F1629] p-4 animate-pulse">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-[#1E293B]" />
          ))}
        </div>
      </div>
    </div>
  )
}
