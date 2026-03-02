import Link from "next/link";

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const from = typeof params.from === "string" ? params.from : "";

  return (
    <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Access Denied</h1>
      <p className="mt-2 text-muted-foreground">
        You do not have permission to open this page.
      </p>
      {from ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Requested route: <span className="font-mono">{from}</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="rounded-md border px-4 py-2 hover:bg-accent" href="/me">
          Go to My Portal
        </Link>
        <Link className="rounded-md border px-4 py-2 hover:bg-accent" href="/dashboard">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

