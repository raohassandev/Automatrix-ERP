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
      statement: {
        openingBalance: 1000,
        issuedAmount: 5000,
        consumedAmount: 2000,
        closingBalance: 4000,
        currentBalance: 4000,
        currentHold: 0,
        currentAvailable: 4000,
        expenseBooked: 3000,
        expenseApproved: 2800,
        expensePayable: 800,
        reimbursedAmount: 1200,
        advanceIssued: 5000,
        advanceOutstanding: 1000,
        payrollPaid: 0,
        payrollDue: 25000,
        variablePaid: 0,
        variablePayDue: 500,
        netCompanyPayable: 25300,
      },
      fundingBreakdown: [
        { id: "issued-company", label: "Company-Issued", amount: 5000, note: "Wallet credits", href: "/wallets?employeeId=emp-1&type=CREDIT" },
      ],
      categorySummary: [
        { category: "Fuel", claims: 2, total: 1400, averageClaim: 700, pocket: 400, wallet: 500, company: 500 },
      ],
      projectSummary: [
        { project: "P-001", claims: 2, total: 1400, averageClaim: 700, pocket: 400, wallet: 500, company: 500 },
      ],
      sourceSummary: [
        { paymentSource: "EMPLOYEE_POCKET", claims: 1, total: 400, averageClaim: 400 },
      ],
      monthlySummary: [
        { month: "Mar 2026", issued: 5000, consumed: 2000, expenseApproved: 1400, pocketPayable: 400, reimbursed: 0, advanceIssued: 5000, payrollPaid: 0, variablePaid: 0, claims: 2, averageClaim: 700 },
      ],
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

  test("GET supports summary export mode for workspace investigation slices", async () => {
    const { GET } = await import("@/app/api/employees/finance-workspace/export/route");

    mockRequirePermission.mockImplementation(async (_userId: string, permission: string) => {
      return ["employees.view_all", "reports.view_all", "reports.export"].includes(permission);
    });

    const req = new Request("http://localhost/api/employees/finance-workspace/export?employeeId=emp-1&mode=summary");
    const res = await GET(req);
    const csv = await res.text();

    expect(res.status).toBe(200);
    expect(csv).toContain("Funding Breakdown");
    expect(csv).toContain("Company-Issued");
    expect(csv).toContain("Project");
    expect(csv).toContain("Payment Source");
  });
});
