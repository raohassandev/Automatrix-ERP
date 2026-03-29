import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockLogAudit = vi.fn();
const mockFindEmployeeByEmailInsensitive = vi.fn();
const mockEmployeeFindMany = vi.fn();
const mockGetEmployeeFinanceWorkspaceData = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/rbac", () => ({ requirePermission: mockRequirePermission }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/identity", () => ({ findEmployeeByEmailInsensitive: mockFindEmployeeByEmailInsensitive }));
vi.mock("@/lib/employee-finance", () => ({ getEmployeeFinanceWorkspaceData: mockGetEmployeeFinanceWorkspaceData }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: mockEmployeeFindMany,
    },
  },
}));

describe("employee finance workspace export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "owner-1", email: "owner@example.com" } });
    mockFindEmployeeByEmailInsensitive.mockResolvedValue(null);
    mockEmployeeFindMany.mockResolvedValue([{ id: "emp-1" }]);
    mockGetEmployeeFinanceWorkspaceData.mockResolvedValue({
      employee: { id: "emp-1", name: "Ibrar", email: "ibrar@example.com" },
      rangeFrom: new Date("2026-03-01T00:00:00.000Z"),
      rangeTo: new Date("2026-03-31T00:00:00.000Z"),
      timeline: [
        {
          id: "wallet-1",
          date: new Date("2026-03-05T00:00:00.000Z"),
          module: "WALLET",
          reference: "ADV-1",
          status: "CREDIT",
          impact: "IN",
          amount: 5000,
          runningBalance: 7000,
          category: null,
          paymentSource: null,
          project: null,
          sourceType: "COMPANY_ADVANCE_ISSUE",
          note: "Advance issued",
          href: "/wallets?employeeId=emp-1",
        },
      ],
    });
  });

  test("GET preserves finance workspace filters in export", async () => {
    const { GET } = await import("@/app/api/employees/finance-workspace/export/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => {
      return ["employees.view_all", "reports.view_all", "reports.export"].includes(permission);
    });

    const req = new Request("http://localhost/api/employees/finance-workspace/export?employeeId=emp-1&from=2026-03-01&to=2026-03-31&event=EXPENSE&category=Fuel&paymentSource=EMPLOYEE_POCKET&project=P-001&search=travel");
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(mockGetEmployeeFinanceWorkspaceData).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: "emp-1",
        from: "2026-03-01",
        to: "2026-03-31",
        event: "EXPENSE",
        category: "Fuel",
        paymentSource: "EMPLOYEE_POCKET",
        project: "P-001",
        search: "travel",
      }),
    );
    expect(csv).toContain("ADV-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_EMPLOYEE_FINANCE_WORKSPACE_CSV",
      }),
    );
  });
});
