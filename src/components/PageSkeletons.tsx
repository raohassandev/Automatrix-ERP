import { cn } from "@/lib/utils";

export function PageShellSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6", className)}>
      <div className="rounded-2xl border bg-card p-6 md:p-8">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-xl border bg-card p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div className="grid gap-6" data-testid="table-page-loading-skeleton">
      <div className="rounded-2xl border bg-card p-6 md:p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-10 w-full animate-pulse rounded bg-muted" />
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-20 animate-pulse rounded border bg-muted/40" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="h-11 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
