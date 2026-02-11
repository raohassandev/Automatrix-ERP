export default function Loading() {
  // Global fallback during route transitions (App Router).
  return (
    <div data-testid="app-loading-skeleton" className="grid gap-6">
      <div className="h-10 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

