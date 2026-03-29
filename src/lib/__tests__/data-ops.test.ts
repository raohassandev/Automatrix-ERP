import { describe, expect, test } from "vitest";
import { summarizeDataOpsJobs } from "@/lib/data-ops";

describe("summarizeDataOpsJobs", () => {
  test("builds completed job summary from audit events", () => {
    const now = new Date("2026-03-28T12:00:00.000Z");
    const rows = [
      {
        id: "a1",
        action: "DATA_OPS_JOB_QUEUED",
        entityId: "job-1",
        userId: "u1",
        newValue: JSON.stringify({ jobType: "PROJECT_FINANCIALS_RECON", idempotencyKey: "key-1" }),
        reason: null,
        createdAt: new Date(now.getTime()),
      },
      {
        id: "a2",
        action: "DATA_OPS_JOB_STARTED",
        entityId: "job-1",
        userId: "u1",
        newValue: JSON.stringify({ jobType: "PROJECT_FINANCIALS_RECON" }),
        reason: null,
        createdAt: new Date(now.getTime() + 1000),
      },
      {
        id: "a3",
        action: "DATA_OPS_JOB_COMPLETED",
        entityId: "job-1",
        userId: "u1",
        newValue: JSON.stringify({ jobType: "PROJECT_FINANCIALS_RECON", result: { scannedProjects: 10 } }),
        reason: null,
        createdAt: new Date(now.getTime() + 2000),
      },
    ];

    const out = summarizeDataOpsJobs(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("job-1");
    expect(out[0].status).toBe("COMPLETED");
    expect(out[0].jobType).toBe("PROJECT_FINANCIALS_RECON");
    expect(out[0].idempotencyKey).toBe("key-1");
    expect((out[0].result as { scannedProjects: number }).scannedProjects).toBe(10);
  });

  test("extracts artifact metadata from completed export jobs", () => {
    const now = new Date("2026-03-28T14:00:00.000Z");
    const rows = [
      {
        id: "c1",
        action: "DATA_OPS_JOB_QUEUED",
        entityId: "job-3",
        userId: "u1",
        newValue: JSON.stringify({ jobType: "EXPORT_CONTROL_REGISTERS_CSV" }),
        reason: null,
        createdAt: now,
      },
      {
        id: "c2",
        action: "DATA_OPS_JOB_COMPLETED",
        entityId: "job-3",
        userId: "u1",
        newValue: JSON.stringify({
          jobType: "EXPORT_CONTROL_REGISTERS_CSV",
          result: {
            artifact: {
              fileName: "control-registers.csv",
              contentType: "text/csv",
              sizeBytes: 120,
              contentBase64: "YQpi",
              downloadPath: "/api/data-ops/jobs/job-3/artifact",
            },
          },
        }),
        reason: null,
        createdAt: new Date(now.getTime() + 1000),
      },
    ];
    const out = summarizeDataOpsJobs(rows);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("COMPLETED");
    expect(out[0].artifact?.fileName).toBe("control-registers.csv");
    expect(out[0].artifact?.downloadPath).toBe("/api/data-ops/jobs/job-3/artifact");
  });

  test("keeps failed status when failure event exists", () => {
    const now = new Date("2026-03-28T13:00:00.000Z");
    const rows = [
      {
        id: "b1",
        action: "DATA_OPS_JOB_QUEUED",
        entityId: "job-2",
        userId: "u1",
        newValue: JSON.stringify({ jobType: "CONTROL_REGISTERS_SNAPSHOT" }),
        reason: null,
        createdAt: now,
      },
      {
        id: "b2",
        action: "DATA_OPS_JOB_FAILED",
        entityId: "job-2",
        userId: "u1",
        newValue: JSON.stringify({ error: "boom" }),
        reason: "boom",
        createdAt: new Date(now.getTime() + 1000),
      },
    ];

    const out = summarizeDataOpsJobs(rows);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("FAILED");
    expect(String(out[0].error || "")).toContain("boom");
  });
});
