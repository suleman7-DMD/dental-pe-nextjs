function SkeletonBar() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-40 rounded bg-[#1E2A3A]" />
        <div className="h-4 w-16 rounded bg-[#1E2A3A]" />
      </div>
      <div className="h-2 w-full rounded bg-[#1E2A3A]" />
    </div>
  )
}

export default function SystemLoading() {
  return (
    <div className="min-h-screen bg-[#0B1121] p-6 space-y-6">
      {/* Page title */}
      <div className="animate-pulse">
        <div className="h-8 w-44 rounded bg-[#1E2A3A] mb-2" />
        <div className="h-4 w-[400px] rounded bg-[#1E2A3A]" />
      </div>

      {/* Source coverage table */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#1E2A3A] mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-[#1E2A3A]" />
          ))}
        </div>
      </div>

      {/* Completeness bars */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 space-y-4">
        <div className="h-4 w-40 rounded bg-[#1E2A3A] animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} />
        ))}
      </div>

      {/* Pipeline log */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-[#1E2A3A] mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-[#1E2A3A]" />
          ))}
        </div>
      </div>

      {/* Manual entry forms */}
      <div className="rounded-[10px] border border-[#1E2A3A] bg-[#141922] p-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-[#1E2A3A] mb-4" />
        <div className="h-[200px] w-full rounded bg-[#1E2A3A]" />
      </div>
    </div>
  )
}
