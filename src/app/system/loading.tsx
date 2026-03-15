function SkeletonBar() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-40 rounded bg-[#F7F7F4]" />
        <div className="h-4 w-16 rounded bg-[#F7F7F4]" />
      </div>
      <div className="h-2 w-full rounded bg-[#F7F7F4]" />
    </div>
  )
}

export default function SystemLoading() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-44 rounded bg-[#F7F7F4] mb-2" />
        <div className="h-4 w-[400px] rounded bg-[#F7F7F4]" />
      </div>

      {/* Source coverage table */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#F7F7F4] mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-[#F7F7F4]" />
          ))}
        </div>
      </div>

      {/* Completeness bars */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 space-y-4">
        <div className="h-4 w-40 rounded bg-[#F7F7F4] animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} />
        ))}
      </div>

      {/* Pipeline log */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#F7F7F4] mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-[#F7F7F4]" />
          ))}
        </div>
      </div>

      {/* Manual entry forms */}
      <div className="rounded-[10px] border border-[#E8E5DE] bg-[#FFFFFF] p-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-[#F7F7F4] mb-4" />
        <div className="h-[200px] w-full rounded bg-[#F7F7F4]" />
      </div>
    </div>
  )
}
