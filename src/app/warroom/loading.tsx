export default function WarroomLoading() {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#FAFAF7] text-[#1A1A1A]">
      <div className="space-y-4">
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FFFFFF] p-4">
          <div className="h-7 w-56 animate-pulse rounded-md bg-[#F5F5F0]" />
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="h-9 w-56 animate-pulse rounded-md bg-[#F5F5F0]" />
            <div className="h-9 w-80 animate-pulse rounded-md bg-[#F5F5F0]" />
            <div className="h-9 w-48 animate-pulse rounded-md bg-[#F5F5F0]" />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-[520px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
          <div className="h-[520px] animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4]" />
          <div className="h-48 animate-pulse rounded-lg border border-[#E8E5DE] bg-[#F7F7F4] xl:col-span-2" />
        </div>
      </div>
    </div>
  )
}
