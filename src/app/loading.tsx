import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 bg-[var(--bg-card)]" />
        <Skeleton className="h-4 w-96 bg-[var(--bg-card)]" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl bg-[var(--bg-card)]" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl bg-[var(--bg-card)]" />
        <Skeleton className="h-80 rounded-xl bg-[var(--bg-card)]" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-96 rounded-xl bg-[var(--bg-card)]" />
    </div>
  );
}
