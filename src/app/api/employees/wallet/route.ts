import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walletSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "employees.edit_wallet");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = walletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { employeeId, type, amount, reference, companyAccountId } = parsed.data;
  if (!reference || !reference.trim()) {
    return NextResponse.json({ success: false, error: "Reference is required" }, { status: 400 });
  }

  let resolvedCompanyAccountId: string | null = null;
  if (type === "CREDIT") {
    if (!companyAccountId) {
      return NextResponse.json(
        { success: false, error: "Company account is required for wallet credit transfers" },
        { status: 400 },
      );
    }
    const account = await prisma.companyAccount.findUnique({
      where: { id: companyAccountId },
      select: { id: true, isActive: true },
    });
    if (!account || !account.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive company account" },
        { status: 400 },
      );
    }
    resolvedCompanyAccountId = account.id;
  } else if (companyAccountId) {
    const account = await prisma.companyAccount.findUnique({
      where: { id: companyAccountId },
      select: { id: true, isActive: true },
    });
    if (!account || !account.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive company account" },
        { status: 400 },
      );
    }
    resolvedCompanyAccountId = account.id;
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  const delta = type === "CREDIT" ? amount : -amount;
  const newBalance = Number(employee.walletBalance) + delta;
  const currentHold = Number(employee.walletHold || 0);
  if (type === "DEBIT" && newBalance < currentHold) {
    return NextResponse.json({ success: false, error: "Insufficient available balance" }, { status: 400 });
  }
  if (newBalance < 0) {
    return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: { walletBalance: new Prisma.Decimal(newBalance) },
    });

    const ledger = await tx.walletLedger.create({
      data: {
        date: new Date(),
        employeeId,
        companyAccountId: resolvedCompanyAccountId || undefined,
        type,
        amount: new Prisma.Decimal(amount),
        reference: reference.trim(),
        balance: new Prisma.Decimal(newBalance),
        sourceType: type === "CREDIT" ? "WALLET_TOPUP" : "WALLET_ADJUSTMENT",
        sourceId: employeeId,
        postedById: session.user.id,
        postedAt: new Date(),
      },
    });

    return { updated, ledger };
  });

  await logAudit({
    action: "WALLET_TRANSACTION",
    entity: "Employee",
    entityId: employeeId,
    newValue: JSON.stringify({ ...parsed.data, companyAccountId: resolvedCompanyAccountId }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: result });
}
