import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBookBalance } from "@/lib/bank-reconciliation";
import { logAudit } from "@/lib/audit";

function parseAsOf(value?: string | null) {
  const asOf = value ? new Date(value) : new Date();
  asOf.setHours(23, 59, 59, 999);
  return asOf;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canManage =
    (await requirePermission(session.user.id, "accounting.manage")) ||
    (await requirePermission(session.user.id, "company_accounts.manage"));
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const companyAccountId = String(body.companyAccountId || "").trim();
  const statementBalance = Number(body.statementBalance);
  const forceClose = Boolean(body.forceClose);
  const notes = body.notes ? String(body.notes).trim() : null;
  if (!companyAccountId || !Number.isFinite(statementBalance)) {
    return NextResponse.json(
      { success: false, error: "Company account and statement balance are required." },
      { status: 400 },
    );
  }
  const asOfDate = parseAsOf(body.asOfDate ? String(body.asOfDate) : undefined);
  const bookBalance = await getBookBalance(companyAccountId, asOfDate);
  const difference = Number((statementBalance - bookBalance).toFixed(2));

  const unmatchedCount = await prisma.bankStatementLine.count({
    where: {
      companyAccountId,
      statementDate: { lte: asOfDate },
      status: "UNMATCHED",
    },
  });
  if (unmatchedCount > 0 && !forceClose) {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot close reconciliation. ${unmatchedCount} unmatched statement lines remain.`,
        data: { unmatchedCount, difference },
      },
      { status: 400 },
    );
  }

  const absDiff = Math.abs(difference);
  const status =
    absDiff < 1 && unmatchedCount === 0 ? "RECONCILED" : absDiff < 100 ? "REVIEW" : "UNRECONCILED";

  const snapshot = await prisma.bankReconciliationSnapshot.create({
    data: {
      companyAccountId,
      asOfDate,
      bookBalance: new Prisma.Decimal(bookBalance),
      statementBalance: new Prisma.Decimal(statementBalance),
      difference: new Prisma.Decimal(difference),
      status,
      notes:
        notes ||
        `Closed with ${unmatchedCount} unmatched line(s).`,
      createdById: session.user.id,
    },
  });

  await logAudit({
    action: "CLOSE_BANK_RECONCILIATION",
    entity: "BankReconciliationSnapshot",
    entityId: snapshot.id,
    newValue: JSON.stringify({
      companyAccountId,
      asOfDate: asOfDate.toISOString(),
      bookBalance,
      statementBalance,
      difference,
      unmatchedCount,
      status,
      forceClose,
    }),
    userId: session.user.id,
  });

  return NextResponse.json({
    success: true,
    data: {
      snapshotId: snapshot.id,
      status,
      unmatchedCount,
      difference,
    },
  });
}
