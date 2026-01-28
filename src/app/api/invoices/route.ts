import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { recalculateProjectFinancials } from "@/lib/projects";
import { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "invoices.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "invoices.create");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await prisma.invoice.create({
    data: {
      invoiceNo: parsed.data.invoiceNo,
      projectId: parsed.data.projectId,
      date: new Date(parsed.data.date),
      amount: new Prisma.Decimal(parsed.data.amount),
      dueDate: new Date(parsed.data.dueDate),
      status: (parsed.data.status as "DRAFT" | "SENT" | "PAID" | "OVERDUE") || "DRAFT",
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    action: "CREATE_INVOICE",
    entity: "Invoice",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  await recalculateProjectFinancials(created.projectId);

  return NextResponse.json({ success: true, data: created });
}
