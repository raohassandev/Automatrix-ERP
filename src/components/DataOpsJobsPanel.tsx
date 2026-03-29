"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type JobSummary = {
  id: string;
  jobType: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  requestedById?: string;
  idempotencyKey?: string;
  artifact?: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    downloadPath?: string;
  };
  error?: string;
};

const JOB_TYPES = [
  "PROJECT_FINANCIALS_RECON",
  "CONTROL_REGISTERS_SNAPSHOT",
  "EFFECTIVE_PERMISSIONS_SNAPSHOT",
  "EXPORT_CONTROL_REGISTERS_CSV",
] as const;

export function DataOpsJobsPanel({ canRun }: { canRun: boolean }) {
  const [pending, startTransition] = useTransition();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>("PROJECT_FINANCIALS_RECON");
  const [dryRun, setDryRun] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED">("ALL");

  async function loadJobs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data-ops/jobs?limit=100", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to load data ops jobs.");
      }
      setJobs(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  function runJob() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/data-ops/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType, dryRun }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || "Failed to run data ops job.");
        }
        await loadJobs();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to run job.");
      }
    });
  }

  function runScheduled() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/data-ops/jobs/run-scheduled", { method: "POST" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || "Failed to run scheduled data ops jobs.");
        }
        await loadJobs();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to run scheduled jobs.");
      }
    });
  }

  function rerunJob(jobId: string) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/data-ops/jobs/${jobId}/rerun`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || "Failed to rerun job.");
        }
        await loadJobs();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to rerun job.");
      }
    });
  }

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()),
    [jobs],
  );
  const filteredJobs = useMemo(
    () => (statusFilter === "ALL" ? sortedJobs : sortedJobs.filter((job) => job.status === statusFilter)),
    [sortedJobs, statusFilter],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Run Data Ops Job</h2>
        {!canRun ? <p className="mt-2 text-sm text-amber-700">You do not have permission to run jobs.</p> : null}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Job Type</span>
            <select
              className="h-9 min-w-[280px] rounded-md border bg-background px-3 text-sm"
              value={jobType}
              onChange={(e) => setJobType(e.target.value as (typeof JOB_TYPES)[number])}
              disabled={!canRun || pending}
            >
              {JOB_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={!canRun || pending}
            />
            Dry run
          </label>
          <Button onClick={runJob} disabled={!canRun || pending}>
            {pending ? "Running..." : "Run Job"}
          </Button>
          <Button variant="secondary" onClick={runScheduled} disabled={!canRun || pending}>
            {pending ? "Running..." : "Run Scheduled"}
          </Button>
          <Button variant="outline" onClick={() => void loadJobs()} disabled={loading || pending}>
            Refresh
          </Button>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Status</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              disabled={loading || pending}
            >
              <option value="ALL">All</option>
              <option value="QUEUED">Queued</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Job History</h2>
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading jobs...</p> : null}
        {!loading && filteredJobs.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No jobs found.</p> : null}
        {!loading && filteredJobs.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Queued</th>
                  <th className="py-2 pr-3">Finished</th>
                  <th className="py-2 pr-3">Artifact</th>
                  <th className="py-2 pr-3">Requested By</th>
                  <th className="py-2 pr-3">Error</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{job.jobType}</div>
                      <div className="text-xs text-muted-foreground">
                        <Link href={`/data-ops/${job.id}`} className="underline underline-offset-2">
                          {job.id}
                        </Link>
                      </div>
                      {job.idempotencyKey ? (
                        <div className="text-xs text-muted-foreground">Key: {job.idempotencyKey}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{job.status}</td>
                    <td className="py-2 pr-3">{new Date(job.queuedAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "-"}</td>
                    <td className="py-2 pr-3">
                      {job.artifact?.downloadPath ? (
                        <a href={job.artifact.downloadPath} className="text-sky-700 underline underline-offset-2">
                          {job.artifact.fileName}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-3">{job.requestedById || "-"}</td>
                    <td className="py-2 pr-3 text-red-600">{job.error || "-"}</td>
                    <td className="py-2 pr-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rerunJob(job.id)}
                        disabled={pending}
                      >
                        Rerun
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
