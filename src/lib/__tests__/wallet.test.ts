import { describe, expect, test, vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

// We mock prisma so this remains a true unit test.
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      employee: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      walletLedger: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (tx: { employee: { update: MockFn }; walletLedger: { create: MockFn } }) => unknown) =>
        fn({
          employee: { update: vi.fn() },
          walletLedger: { create: vi.fn() },
        })
      ),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { applyWalletTransactionByEmail } from "../wallet";

const prismaMock = prisma as unknown as {
  employee: {
    findUnique: MockFn;
    update: MockFn;
  };
  walletLedger: {
    create: MockFn;
  };
  $transaction: MockFn;
};

describe("wallet (business rules)", () => {
  test("returns Employee not found when email does not match", async () => {
    prismaMock.employee.findUnique.mockResolvedValueOnce(null);

    const res = await applyWalletTransactionByEmail({
      email: "missing@example.com",
      type: "CREDIT",
      amount: 100,
    });

    expect(res.applied).toBe(false);
    expect(res.reason).toBe("Employee not found");
  });

  test("rejects debit that would make balance negative", async () => {
    prismaMock.employee.findUnique.mockResolvedValueOnce({
      id: "e1",
      walletBalance: 50,
      walletHold: 0,
    });

    const res = await applyWalletTransactionByEmail({
      email: "a@example.com",
      type: "DEBIT",
      amount: 100,
    });

    expect(res.applied).toBe(false);
    expect(res.reason).toBe("Insufficient available wallet balance");
  });

  test("rejects debit that would breach walletHold (available balance)", async () => {
    prismaMock.employee.findUnique.mockResolvedValueOnce({
      id: "e1",
      walletBalance: 100,
      walletHold: 90,
    });

    const res = await applyWalletTransactionByEmail({
      email: "a@example.com",
      type: "DEBIT",
      amount: 20,
    });

    expect(res.applied).toBe(false);
    expect(res.reason).toBe("Insufficient available wallet balance");
  });

  test("applies credit by increasing balance via transaction", async () => {
    prismaMock.employee.findUnique.mockResolvedValueOnce({
      id: "e1",
      walletBalance: 100,
      walletHold: 0,
    });

    const res = await applyWalletTransactionByEmail({
      email: "a@example.com",
      type: "CREDIT",
      amount: 50,
      reference: "Topup",
    });

    expect(res.applied).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
