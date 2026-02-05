import { describe, expect, test, vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

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
      $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { getAllowedRolesForPolicy, userHasApprovalAssignment } from "../approval-policies";

const prismaMock = prisma as unknown as {
  approvalPolicy: {
    count: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    create: MockFn;
  };
  approvalPolicyRole: {
    count: MockFn;
  };
  role: {
    findMany: MockFn;
  };
  user: {
    findUnique: MockFn;
  };
  $transaction: MockFn;
};

describe("approval policies", () => {
  test("returns assigned roles when policy exists", async () => {
    prismaMock.approvalPolicy.count.mockResolvedValueOnce(1);
    prismaMock.approvalPolicy.findUnique.mockResolvedValueOnce({
      roles: [{ role: { name: "CEO" } }, { role: { name: "CFO" } }],
    });

    const roles = await getAllowedRolesForPolicy("expense", "L2");
    expect(roles).toEqual(["CEO", "CFO"]);
  });

  test("falls back to defaults when policy missing", async () => {
    prismaMock.approvalPolicy.count.mockResolvedValueOnce(1);
    prismaMock.approvalPolicy.findUnique.mockResolvedValueOnce(null);

    const roles = await getAllowedRolesForPolicy("expense", "L1");
    expect(roles).toContain("Manager");
  });

  test("userHasApprovalAssignment returns true when role has assignments", async () => {
    prismaMock.approvalPolicy.count.mockResolvedValueOnce(1);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      role: { id: "role-1" },
    });
    prismaMock.approvalPolicyRole.count.mockResolvedValueOnce(2);

    const hasAssignment = await userHasApprovalAssignment("user-1");
    expect(hasAssignment).toBe(true);
  });

  test("userHasApprovalAssignment returns false when user lacks role", async () => {
    prismaMock.approvalPolicy.count.mockResolvedValueOnce(1);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const hasAssignment = await userHasApprovalAssignment("user-2");
    expect(hasAssignment).toBe(false);
  });
});
