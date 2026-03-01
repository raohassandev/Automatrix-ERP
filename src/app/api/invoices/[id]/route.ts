import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { recalculateProjectFinancials } from "@/lib/projects";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { postInvoiceJournal } from "@/lib/accounting";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "invoices.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.status) data.status = sanitizeString(body.status);
  if (body.notes !== undefined) data.notes = sanitizeString(body.notes);
  if (body.paymentDate) data.paymentDate = new Date(body.paymentDate);
  if (body.dueDate) data.dueDate = new Date(body.dueDate);
  if (body.amount !== undefined) data.amount = new Prisma.Decimal(body.amount);

  const nextStatus = (data.status as string | undefined) || existing.status;
  const shouldPostInvoice = existing.status === "DRAFT" && nextStatus !== "DRAFT";

  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.update({ where: { id }, data });
    if (shouldPostInvoice) {
      await postInvoiceJournal(tx, {
        invoiceId: invoice.id,
        amount: Number(invoice.amount),
        invoiceDate: new Date(invoice.date),
        projectRef: invoice.projectId,
        userId: session.user.id,
        memo: `Invoice ${invoice.invoiceNo} posted on status transition`,
      });
    }
    return invoice;
  });

  await logAudit({
    action: "UPDATE_INVOICE",
    entity: "Invoice",
    entityId: id,
    newValue: JSON.stringify(body),
    userId: session.user.id,
  });

  if (body.status === "OVERDUE" && existing.status !== "OVERDUE") {
    const rolesToNotify = [
      "Owner",
      "CEO",
      "Admin",
      "CFO",
      "Finance Manager",
      "Accountant",
      "Sales",
      "Marketing",
    ];
    const users = await prisma.user.findMany({
      where: { role: { name: { in: rolesToNotify } } },
      select: { id: true },
    });
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          type: "INVOICE_OVERDUE",
          message: `Invoice ${updated.invoiceNo} is marked OVERDUE for ${updated.amount.toString()}.`,
          status: "NEW",
        })),
      });
    }
  }

  await recalculateProjectFinancials(updated.projectId);

  return NextResponse.json({ success: true, data: updated });
}
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "invoices.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  }

  await prisma.invoice.delete({ where: { id } });

  await logAudit({
    action: "DELETE_INVOICE",
    entity: "Invoice",
    entityId: id,
    userId: session.user.id,
  });

  await recalculateProjectFinancials(existing.projectId);

  return NextResponse.json({ success: true });
}
