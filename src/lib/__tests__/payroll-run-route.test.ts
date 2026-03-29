import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();

const mockPayrollRunFindUnique = vi.fn();
const mockPayrollRunUpdate = vi.fn();
const mockPayrollRunDelete = vi.fn();
const mockPayrollEntryDeleteMany = vi.fn();
const mockPayrollComponentLineDeleteMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payrollRun: {
      findUnique: mockPayrollRunFindUnique,
      update: mockPayrollRunUpdate,
      delete: mockPayrollRunDelete,
    },
    payrollEntry: {
      deleteMany: mockPayrollEntryDeleteMany,
    },
    payrollComponentLine: {
      deleteMany: mockPayrollComponentLineDeleteMany,
    },
    $transaction: mockTransaction,
  },
}));

describe("payroll run route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        payrollRun: { update: mockPayrollRunUpdate },
        payrollEntry: { deleteMany: mockPayrollEntryDeleteMany },
        payrollComponentLine: { deleteMany: mockPayrollComponentLineDeleteMany },
      }),
    );
  });

  test("PATCH blocks non-status mutation without payroll.edit permission", async () => {
    const { PATCH } = await import("@/app/api/payroll/runs/[id]/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => {
      if (permission === "payroll.edit") return false;
      if (permission === "payroll.approve") return true;
      return false;
    });
    mockPayrollRunFindUnique.mockResolvedValue({
      id: "run-1",
      status: "DRAFT",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-28T23:59:59.999Z"),
      entries: [],
    });

    const req = new Request("http://localhost/api/payroll/runs/run-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "mutate-notes" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Edit permission required");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BLOCK_UPDATE_PAYROLL_RUN_NO_EDIT",
        entity: "PayrollRun",
        entityId: "run-1",
      }),
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("PATCH allows status-only approve without payroll.edit when payroll.approve exists", async () => {
    const { PATCH } = await import("@/app/api/payroll/runs/[id]/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => {
      if (permission === "payroll.edit") return false;
      if (permission === "payroll.approve") return true;
      return false;
    });
    mockPayrollRunFindUnique.mockResolvedValue({
      id: "run-1",
      status: "DRAFT",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-28T23:59:59.999Z"),
      entries: [],
    });
    mockPayrollRunUpdate.mockResolvedValue({
      id: "run-1",
      status: "APPROVED",
      entries: [],
    });

    const req = new Request("http://localhost/api/payroll/runs/run-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("APPROVED");
    expect(mockPayrollRunUpdate).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_PAYROLL_RUN",
        entity: "PayrollRun",
        entityId: "run-1",
      }),
    );
  });

  test("DELETE blocks non-draft payroll run deletion and audits the block", async () => {
    const { DELETE } = await import("@/app/api/payroll/runs/[id]/route");

    mockRequirePermission.mockResolvedValue(true);
    mockPayrollRunFindUnique.mockResolvedValue({
      id: "run-1",
      status: "APPROVED",
      entries: [],
    });

    const res = await DELETE(new Request("http://localhost/api/payroll/runs/run-1"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Only DRAFT payroll runs can be deleted.");
    expect(mockPayrollRunDelete).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BLOCK_DELETE_PAYROLL_RUN_STATUS",
        entity: "PayrollRun",
        entityId: "run-1",
      }),
    );
  });

  test("DELETE blocks draft payroll run when a paid entry exists", async () => {
    const { DELETE } = await import("@/app/api/payroll/runs/[id]/route");

    mockRequirePermission.mockResolvedValue(true);
    mockPayrollRunFindUnique.mockResolvedValue({
      id: "run-1",
      status: "DRAFT",
      entries: [{ id: "entry-1", employeeId: "emp-1", status: "PAID" }],
    });

    const res = await DELETE(new Request("http://localhost/api/payroll/runs/run-1"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(String(json.error || "")).toMatch(/cannot delete payroll run/i);
    expect(mockPayrollRunDelete).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BLOCK_DELETE_PAYROLL_RUN_PAID",
        entity: "PayrollRun",
        entityId: "run-1",
      }),
    );
  });

  test("PATCH blocks posted payroll run rollback", async () => {
    const { PATCH } = await import("@/app/api/payroll/runs/[id]/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => {
      if (permission === "payroll.edit") return true;
      if (permission === "payroll.approve") return true;
      return false;
    });
    mockPayrollRunFindUnique.mockResolvedValue({
      id: "run-1",
      status: "POSTED",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-28T23:59:59.999Z"),
      entries: [],
    });

    const req = new Request("http://localhost/api/payroll/runs/run-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "run-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Posted payroll runs cannot be moved back.");
    expect(mockPayrollRunUpdate).not.toHaveBeenCalled();
  });
});
