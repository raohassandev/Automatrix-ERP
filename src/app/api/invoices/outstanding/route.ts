import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewInvoices = await requirePermission(session.user.id, "invoices.view_all");
  const canAddIncome = await requirePermission(session.user.id, "income.add");
  if (!canViewInvoices && !canAddIncome) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get("projectId") || "").trim();

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { not: "DRAFT" },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      invoiceNo: true,
      projectId: true,
      date: true,
      dueDate: true,
      amount: true,
      status: true,
    },
  });

  const sums = await prisma.income.groupBy({
    by: ["invoiceId"],
    where: {
      invoiceId: { in: invoices.map((i) => i.id) },
      status: { in: ["APPROVED", "PARTIALLY_APPROVED", "PAID"] },
    },
    _sum: { amount: true },
  });
  const byInvoice = new Map(sums.map((row) => [row.invoiceId, Number(row._sum.amount || 0)]));

  const rows = invoices
    .map((invoice) => {
      const total = Number(invoice.amount || 0);
      const received = Number(byInvoice.get(invoice.id) || 0);
      const outstanding = Math.max(0, total - received);
      return {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        projectId: invoice.projectId,
        date: invoice.date,
        dueDate: invoice.dueDate,
        status: invoice.status,
        totalAmount: total,
        receivedAmount: received,
        outstandingAmount: Number(outstanding.toFixed(2)),
      };
    })
    .filter((row) => row.outstandingAmount > 0);

  return NextResponse.json({ success: true, data: rows });
}
