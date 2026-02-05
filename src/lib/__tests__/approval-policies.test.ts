import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      approvalPolicy: {
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      approvalPolicyRole: {
        count: vi.fn(),
      },
      role: {
        findMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { getAllowedRolesForPolicy, userHasApprovalAssignment } from "../approval-policies";

describe("approval policies", () => {
  test("returns assigned roles when policy exists", async () => {
    (prisma.approvalPolicy.count as any).mockResolvedValueOnce(1);
    (prisma.approvalPolicy.findUnique as any).mockResolvedValueOnce({
      roles: [{ role: { name: "CEO" } }, { role: { name: "CFO" } }],
    });

    const roles = await getAllowedRolesForPolicy("expense", "L2");
    expect(roles).toEqual(["CEO", "CFO"]);
  });

  test("falls back to defaults when policy missing", async () => {
    (prisma.approvalPolicy.count as any).mockResolvedValueOnce(1);
    (prisma.approvalPolicy.findUnique as any).mockResolvedValueOnce(null);

    const roles = await getAllowedRolesForPolicy("expense", "L1");
    expect(roles).toContain("Manager");
  });

  test("userHasApprovalAssignment returns true when role has assignments", async () => {
    (prisma.approvalPolicy.count as any).mockResolvedValueOnce(1);
    (prisma.user.findUnique as any).mockResolvedValueOnce({
      role: { id: "role-1" },
    });
    (prisma.approvalPolicyRole.count as any).mockResolvedValueOnce(2);

    const hasAssignment = await userHasApprovalAssignment("user-1");
    expect(hasAssignment).toBe(true);
  });

  test("userHasApprovalAssignment returns false when user lacks role", async () => {
    (prisma.approvalPolicy.count as any).mockResolvedValueOnce(1);
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);

    const hasAssignment = await userHasApprovalAssignment("user-2");
    expect(hasAssignment).toBe(false);
  });
});
