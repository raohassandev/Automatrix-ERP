import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getBookBalance } from "@/lib/bank-reconciliation";
import { logAudit } from "@/lib/audit";

function parseAsOf(value?: string | null) {
  const asOf = value ? new Date(value) : new Date();
  asOf.setHours(23, 59, 59, 999);
  return asOf;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canView =
    (await requirePermission(session.user.id, "reports.view_all")) ||
    (await requirePermission(session.user.id, "reports.view_team")) ||
    (await requirePermission(session.user.id, "reports.view_own")) ||
    (await requirePermission(session.user.id, "company_accounts.view"));
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const companyAccountId = (searchParams.get("companyAccountId") || "").trim();
  const asOfDate = parseAsOf(searchParams.get("asOfDate"));
  const statementBalanceParam = (searchParams.get("statementBalance") || "").trim();

  const accounts = await prisma.companyAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });
  if (!companyAccountId) {
    return NextResponse.json({
      success: true,
      data: {
        accounts,
        selectedAccountId: null,
        asOfDate: asOfDate.toISOString(),
        bookBalance: 0,
        statementBalance: null,
        difference: null,
        snapshots: [],
      },
    });
  }

  const bookBalance = await getBookBalance(companyAccountId, asOfDate);
  const statementBalance = statementBalanceParam ? Number(statementBalanceParam) : null;
  const difference =
    statementBalance === null ? null : Number((statementBalance - bookBalance).toFixed(2));

  const snapshots = await prisma.bankReconciliationSnapshot.findMany({
    where: { companyAccountId },
    orderBy: { asOfDate: "desc" },
    take: 20,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    success: true,
    data: {
      accounts,
      selectedAccountId: companyAccountId,
      asOfDate: asOfDate.toISOString(),
      bookBalance,
      statementBalance,
      difference,
      snapshots,
    },
  });
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
  const asOfRaw = String(body.asOfDate || "").trim();
  const statementBalance = Number(body.statementBalance);
  const notes = body.notes ? String(body.notes).trim() : null;
  if (!companyAccountId || !asOfRaw) {
    return NextResponse.json({ success: false, error: "Account and statement date are required." }, { status: 400 });
  }
  if (!Number.isFinite(statementBalance)) {
    return NextResponse.json({ success: false, error: "Statement balance must be a valid number." }, { status: 400 });
  }

  const asOfDate = parseAsOf(asOfRaw);
  const bookBalance = await getBookBalance(companyAccountId, asOfDate);
  const difference = Number((statementBalance - bookBalance).toFixed(2));
  const absDiff = Math.abs(difference);
  const status = absDiff < 1 ? "RECONCILED" : absDiff < 100 ? "REVIEW" : "UNRECONCILED";

  const row = await prisma.bankReconciliationSnapshot.create({
    data: {
      companyAccountId,
      asOfDate,
      bookBalance: new Prisma.Decimal(bookBalance),
      statementBalance: new Prisma.Decimal(statementBalance),
      difference: new Prisma.Decimal(difference),
      status,
      notes,
      createdById: session.user.id,
    },
  });

  await logAudit({
    action: "CREATE_BANK_RECONCILIATION",
    entity: "BankReconciliationSnapshot",
    entityId: row.id,
    newValue: JSON.stringify({
      companyAccountId,
      asOfDate: asOfDate.toISOString(),
      bookBalance,
      statementBalance,
      difference,
      status,
    }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: row });
}
