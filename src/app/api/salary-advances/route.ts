import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salaryAdvanceSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { findEmployeeByEmailInsensitive } from "@/lib/identity";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "salary_advance.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (!canViewAll) {
    if (!session.user.email) {
      return NextResponse.json({ success: false, error: "User email missing" }, { status: 400 });
    }
    const employee = await findEmployeeByEmailInsensitive(session.user.email, {
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ success: true, data: [] });
    }
    where.employeeId = employee.id;
  }

  const data = await prisma.salaryAdvance.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { employee: true },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "salary_advance.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = salaryAdvanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await prisma.salaryAdvance.create({
    data: {
      employeeId: sanitizeString(parsed.data.employeeId),
      amount: new Prisma.Decimal(parsed.data.amount),
      issuedAmount: new Prisma.Decimal(parsed.data.amount),
      recoveredAmount: new Prisma.Decimal(0),
      outstandingAmount: new Prisma.Decimal(parsed.data.amount),
      recoveryMode: parsed.data.recoveryMode || "FULL_NEXT_PAYROLL",
      installmentAmount:
        parsed.data.recoveryMode === "INSTALLMENT" && parsed.data.installmentAmount
          ? new Prisma.Decimal(parsed.data.installmentAmount)
          : null,
      reason: sanitizeString(parsed.data.reason),
      status: "PENDING",
    },
    include: { employee: true },
  });

  await logAudit({
    action: "CREATE_SALARY_ADVANCE",
    entity: "SalaryAdvance",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
