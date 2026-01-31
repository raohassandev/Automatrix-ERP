import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "employees.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "employees.view_all");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const initialWalletBalance = body.initialWalletBalance || 0;

  // Create employee and initial wallet entry in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        role: parsed.data.role,
        walletBalance: new Prisma.Decimal(initialWalletBalance),
      },
    });

    // If initial wallet balance > 0, create a CREDIT wallet ledger entry
    if (initialWalletBalance > 0) {
      await tx.walletLedger.create({
        data: {
          employeeId: created.id,
          type: "CREDIT",
          amount: new Prisma.Decimal(initialWalletBalance),
          date: new Date(),
          reference: "Initial Balance",
          balance: new Prisma.Decimal(initialWalletBalance),
        },
      });
    }

    return created;
  });

  await logAudit({
    action: "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: result.id,
    newValue: JSON.stringify({ ...parsed.data, initialWalletBalance }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: result });
}
