/**
 * Skeleton loader components for consistent loading states across Velora ERP.
 */

/** Single skeleton block */
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

/** Row of skeleton cards (for KPI grids) */
export function SkeletonCards({ count = 4 }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

/** Skeleton for a table with rows */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a form panel */
export function SkeletonForm({ fields = 4 }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-11 w-full" />
    </div>
  );
}

/** Full page skeleton for module pages */
export function SkeletonPage({ cards = 4, tableRows = 6 }) {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 md:space-y-6 md:py-6 xl:p-8">
      <Skeleton className="h-24 rounded-2xl" />
      <SkeletonCards count={cards} />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <SkeletonForm fields={4} />
        <SkeletonTable rows={tableRows} />
      </div>
    </div>
  );
}
