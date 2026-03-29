import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";

export async function applyWalletTransactionByEmail(input: {
  email: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  reference?: string;
}) {
  const employee = await findEmployeeByEmailInsensitive(input.email);
  if (!employee) {
    return { applied: false, reason: "Employee not found" } as const;
  }

  const delta = input.type === "CREDIT" ? input.amount : -input.amount;
  const newBalance = Number(employee.walletBalance) + delta;

  const currentHold = Number(employee.walletHold || 0);
  if (input.type === "DEBIT" && newBalance < currentHold) {
    return { applied: false, reason: "Insufficient available wallet balance" } as const;
  }
  if (newBalance < 0) {
    return { applied: false, reason: "Insufficient wallet balance" } as const;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employee.id },
      data: { walletBalance: new Prisma.Decimal(newBalance) },
    });

    const ledger = await tx.walletLedger.create({
      data: {
        date: new Date(),
        employeeId: employee.id,
        type: input.type,
        amount: new Prisma.Decimal(input.amount),
        reference: input.reference,
        balance: new Prisma.Decimal(newBalance),
      },
    });

    return { updated, ledger };
  });

  return { applied: true, ...result } as const;
}
