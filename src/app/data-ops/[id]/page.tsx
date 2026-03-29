import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { DATA_OPS_ENTITY, summarizeDataOpsJobs } from "@/lib/data-ops";

function tryParseJson(input: string | null | undefined): unknown {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

export default async function DataOpsJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">Data Ops Job</h1>
        <p className="mt-2 text-sm text-red-700">Forbidden: audit view permission required.</p>
      </div>
    );
  }

  const { id } = await params;
  const events = await prisma.auditLog.findMany({
    where: { entity: DATA_OPS_ENTITY, entityId: id },
    orderBy: { createdAt: "asc" },
  });
  if (events.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4">
          <Link href="/data-ops" className="text-sm underline underline-offset-2">
            Back to Data Ops
          </Link>
        </div>
        <h1 className="text-xl font-semibold">Data Ops Job</h1>
        <p className="mt-2 text-sm text-muted-foreground">Job not found.</p>
      </div>
    );
  }

  const summary = summarizeDataOpsJobs(events).find((job) => job.id === id) || null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Data Ops Job Detail</h1>
          <p className="text-sm text-muted-foreground">Audit timeline and result payload for job execution.</p>
        </div>
        <Link href="/data-ops" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
          Back to Jobs
        </Link>
      </div>

      {summary ? (
        <div className="rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Job Type</div>
              <div className="font-medium">{summary.jobType}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
              <div className="font-medium">{summary.status}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Queued</div>
              <div>{new Date(summary.queuedAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Finished</div>
              <div>{summary.finishedAt ? new Date(summary.finishedAt).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Requested By</div>
              <div>{summary.requestedById || "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Idempotency Key</div>
              <div className="break-all">{summary.idempotencyKey || "-"}</div>
            </div>
          </div>
          {summary.artifact?.downloadPath ? (
            <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
              Artifact:{" "}
              <a href={summary.artifact.downloadPath} className="font-medium underline underline-offset-2">
                {summary.artifact.fileName}
              </a>{" "}
              ({summary.artifact.sizeBytes} bytes)
            </div>
          ) : null}
          {summary.error ? <div className="mt-3 text-sm text-red-700">Error: {summary.error}</div> : null}
        </div>
      ) : null}

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Event Timeline</h2>
        <div className="mt-3 space-y-3">
          {events.map((event) => {
            const payload = tryParseJson(event.newValue);
            return (
              <div key={event.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{event.action}</div>
                  <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">User: {event.userId || "-"}</div>
                {event.reason ? <div className="mt-2 text-sm text-red-700">Reason: {event.reason}</div> : null}
                {payload ? (
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

