import { describe, expect, it } from "vitest";

import { resolveFinanceWorkspaceEmployeeId } from "@/lib/employee-finance-workspace";

describe("resolveFinanceWorkspaceEmployeeId", () => {
  const options = [{ id: "emp-admin" }, { id: "emp-owner" }, { id: "emp-staff" }];

  it("keeps an explicit employee selection when valid", () => {
    expect(
      resolveFinanceWorkspaceEmployeeId({
        requestedEmployeeId: "emp-staff",
        currentEmployeeId: "emp-owner",
        canViewAll: true,
        canViewTeam: false,
        employeeOptions: options,
      }),
    ).toBe("emp-staff");
  });

  it("falls back to the current employee before any alphabetical first row", () => {
    expect(
      resolveFinanceWorkspaceEmployeeId({
        requestedEmployeeId: "",
        currentEmployeeId: "emp-owner",
        canViewAll: true,
        canViewTeam: false,
        employeeOptions: options,
      }),
    ).toBe("emp-owner");
  });

  it("requires explicit selection for broad-access users without a linked employee", () => {
    expect(
      resolveFinanceWorkspaceEmployeeId({
        requestedEmployeeId: "",
        currentEmployeeId: "",
        canViewAll: true,
        canViewTeam: false,
        employeeOptions: options,
      }),
    ).toBeNull();
  });

  it("uses the only option when the accessible scope contains one employee", () => {
    expect(
      resolveFinanceWorkspaceEmployeeId({
        requestedEmployeeId: "",
        currentEmployeeId: "",
        canViewAll: false,
        canViewTeam: false,
        employeeOptions: [{ id: "emp-self" }],
      }),
    ).toBe("emp-self");
  });
});
