import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockExpenseFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/rbac", () => ({ requirePermission: mockRequirePermission }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    expense: {
      findMany: mockExpenseFindMany,
    },
  },
}));

describe("expenses export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  test("GET preserves UI filters in export query", async () => {
    const { GET } = await import("@/app/api/expenses/export/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => permission === "expenses.view_all");
    mockExpenseFindMany.mockResolvedValue([
      {
        date: new Date("2026-01-15T00:00:00.000Z"),
        description: "Fuel refill",
        category: "Fuel",
        expenseType: "COMPANY",
        project: "P-001",
        paymentSource: "EMPLOYEE_POCKET",
        paymentMode: "CASH",
        status: "PAID",
        amount: 1500,
        approvedAmount: 1400,
        companyAccount: { name: "Cash" },
        submittedBy: { email: "ibrar@example.com", name: "Ibrar" },
        approvedBy: { email: "owner@example.com", name: "Owner" },
        receiptUrl: null,
        createdAt: new Date("2026-01-15T08:00:00.000Z"),
      },
    ]);

    const req = new Request(
      "http://localhost/api/expenses/export?search=fuel&category=Fuel&status=PAID&expenseType=COMPANY&paymentSource=EMPLOYEE_POCKET&paymentMode=CASH&submittedById=user-2&project=P-001&from=2026-01-01&to=2026-01-31",
    );

    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(mockExpenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "Fuel",
          status: "PAID",
          expenseType: "COMPANY",
          paymentSource: "EMPLOYEE_POCKET",
          paymentMode: "CASH",
          submittedById: "user-2",
          project: "P-001",
          date: expect.objectContaining({
            gte: new Date("2026-01-01"),
            lte: new Date("2026-01-31"),
          }),
          OR: expect.any(Array),
        }),
      }),
    );
    expect(csv).toContain("Fuel refill");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_EXPENSES_CSV",
      }),
    );
  });

  test("GET keeps own-scope export bound to current user", async () => {
    const { GET } = await import("@/app/api/expenses/export/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => permission === "expenses.view_own");
    mockExpenseFindMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/expenses/export?submittedById=user-99");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockExpenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          submittedById: "user-1",
        }),
      }),
    );
  });
});
