import { Skeleton } from "@/components/ui/Skeleton";

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6" aria-label="Loading dashboard" aria-busy="true">
      {/* Row 1 — Progression */}
      <div className="col-span-12 lg:col-span-8">
        <Skeleton className="h-[280px] w-full rounded-xl bg-tactical-border/40" />
      </div>
      <div className="col-span-12 lg:col-span-4">
        <Skeleton className="h-[280px] w-full rounded-xl bg-tactical-border/40" />
      </div>

      {/* Row 2 — Financial State */}
      <div className="col-span-12 lg:col-span-5">
        <Skeleton className="h-[240px] w-full rounded-xl bg-tactical-border/40" />
      </div>
      <div className="col-span-12 lg:col-span-7">
        <Skeleton className="h-[240px] w-full rounded-xl bg-tactical-border/40" />
      </div>

      {/* Row 3 — Actions */}
      <div className="col-span-12 lg:col-span-7">
        <Skeleton className="h-[320px] w-full rounded-xl bg-tactical-border/40" />
      </div>
      <div className="col-span-12 lg:col-span-5">
        <Skeleton className="h-[320px] w-full rounded-xl bg-tactical-border/40" />
      </div>
    </div>
  );
}
