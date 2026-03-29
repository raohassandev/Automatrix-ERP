import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockAuditLogFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: mockAuditLogFindMany,
    },
  },
}));

describe("data-ops job detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u-1" } });
    mockRequirePermission.mockResolvedValue(true);
  });

  test("returns 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/data-ops/jobs/[id]/route");
    const res = await GET(new Request("http://localhost/api/data-ops/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 403 when user lacks audit.view permission", async () => {
    mockRequirePermission.mockResolvedValue(false);
    const { GET } = await import("@/app/api/data-ops/jobs/[id]/route");
    const res = await GET(new Request("http://localhost/api/data-ops/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 when no audit events exist for the job id", async () => {
    mockAuditLogFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/data-ops/jobs/[id]/route");
    const res = await GET(new Request("http://localhost/api/data-ops/jobs/job-missing"), {
      params: Promise.resolve({ id: "job-missing" }),
    });
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe("Job not found");
  });

  test("returns summary and timeline events for an existing job", async () => {
    const now = new Date("2026-03-28T12:00:00.000Z");
    mockAuditLogFindMany.mockResolvedValue([
      {
        id: "a1",
        entityId: "job-1",
        action: "DATA_OPS_JOB_QUEUED",
        reason: null,
        newValue: JSON.stringify({ jobType: "PROJECT_FINANCIALS_RECON", idempotencyKey: "idem-1" }),
        userId: "u-1",
        createdAt: now,
      },
      {
        id: "a2",
        entityId: "job-1",
        action: "DATA_OPS_JOB_COMPLETED",
        reason: null,
        newValue: JSON.stringify({
          jobType: "PROJECT_FINANCIALS_RECON",
          result: { scannedProjects: 5 },
        }),
        userId: "u-1",
        createdAt: new Date(now.getTime() + 1000),
      },
    ]);

    const { GET } = await import("@/app/api/data-ops/jobs/[id]/route");
    const res = await GET(new Request("http://localhost/api/data-ops/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.summary.id).toBe("job-1");
    expect(json.data.summary.status).toBe("COMPLETED");
    expect(json.data.summary.idempotencyKey).toBe("idem-1");
    expect(json.data.events).toHaveLength(2);
    expect(json.data.events[0].action).toBe("DATA_OPS_JOB_QUEUED");
  });
});
