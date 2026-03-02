import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salaryAdvanceUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "salary_advance.edit");
  const canApprove = await requirePermission(session.user.id, "salary_advance.approve");
  if (!canEdit && !canApprove) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.salaryAdvance.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Advance not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = salaryAdvanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.employeeId) data.employeeId = sanitizeString(parsed.data.employeeId);
  if (parsed.data.amount !== undefined) data.amount = new Prisma.Decimal(parsed.data.amount);
  if (parsed.data.reason !== undefined) {
    data.reason = parsed.data.reason ? sanitizeString(parsed.data.reason) : null;
  }
  if (parsed.data.status) {
    const nextStatus = sanitizeString(parsed.data.status);
    if (nextStatus === "APPROVED" && !canApprove) {
      return NextResponse.json({ success: false, error: "Approval permission required" }, { status: 403 });
    }
    data.status = nextStatus;
    data.approvedById = nextStatus === "APPROVED" ? session.user.id : null;
  }

  let updated = await prisma.salaryAdvance.update({
    where: { id },
    data,
    include: { employee: true },
  });

  if (updated.status === "APPROVED" && !updated.walletLedgerId) {
    const employee = await prisma.employee.findUnique({ where: { id: updated.employeeId } });
    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    }
    const newBalance = Number(employee.walletBalance) + Number(updated.amount);
    const result = await prisma.$transaction(async (tx) => {
      const ledger = await tx.walletLedger.create({
        data: {
          date: new Date(),
          employeeId: updated.employeeId,
          type: "CREDIT",
          amount: new Prisma.Decimal(updated.amount),
          reference: `ADVANCE_SALARY:${updated.id}`,
          balance: new Prisma.Decimal(newBalance),
          sourceType: "SALARY_ADVANCE",
          sourceId: updated.id,
          postedById: session.user.id,
          postedAt: new Date(),
        },
      });
      await tx.employee.update({
        where: { id: updated.employeeId },
        data: { walletBalance: new Prisma.Decimal(newBalance) },
      });
      return ledger;
    });
    updated = await prisma.salaryAdvance.update({
      where: { id },
      data: { walletLedgerId: result.id, status: "PAID" },
      include: { employee: true },
    });
  }

  await logAudit({
    action: "UPDATE_SALARY_ADVANCE",
    entity: "SalaryAdvance",
    entityId: id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "salary_advance.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.salaryAdvance.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Advance not found" }, { status: 404 });
  }

  await prisma.salaryAdvance.delete({ where: { id } });

  await logAudit({
    action: "DELETE_SALARY_ADVANCE",
    entity: "SalaryAdvance",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
