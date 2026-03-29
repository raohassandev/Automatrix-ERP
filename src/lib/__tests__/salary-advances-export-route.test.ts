import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockFindEmployeeByEmailInsensitive = vi.fn();
const mockSalaryAdvanceFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/rbac", () => ({ requirePermission: mockRequirePermission }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/identity", () => ({ findEmployeeByEmailInsensitive: mockFindEmployeeByEmailInsensitive }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    salaryAdvance: {
      findMany: mockSalaryAdvanceFindMany,
    },
  },
}));

describe("salary advances export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  test("GET applies employee/date/status filters for own-scope export", async () => {
    const { GET } = await import("@/app/api/salary-advances/export/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => permission === "employees.view_own");
    mockFindEmployeeByEmailInsensitive.mockResolvedValue({ id: "emp-1" });
    mockSalaryAdvanceFindMany.mockResolvedValue([
      {
        id: "adv-1",
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        amount: 5000,
        outstandingAmount: 2000,
        recoveryMode: "INSTALLMENT",
        status: "PARTIALLY_RECOVERED",
        reason: "Medical",
        employee: { name: "Ibrar", email: "ibrar@example.com" },
      },
    ]);

    const req = new Request("http://localhost/api/salary-advances/export?status=PARTIALLY_RECOVERED&from=2026-02-01&to=2026-02-28&search=medical");
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(mockSalaryAdvanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: "emp-1",
          status: "PARTIALLY_RECOVERED",
          createdAt: expect.objectContaining({
            gte: new Date("2026-02-01"),
            lte: new Date("2026-02-28"),
          }),
          OR: expect.any(Array),
        }),
      }),
    );
    expect(csv).toContain("Medical");
  });
});
