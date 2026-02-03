import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { recalculateProjectFinancials } from "@/lib/projects";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

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

  // Sanitize string inputs after validation
  const sanitizedData = {
    ...parsed.data,
    invoiceNo: sanitizeString(parsed.data.invoiceNo),
    projectId: sanitizeString(parsed.data.projectId),
    status: parsed.data.status ? (sanitizeString(parsed.data.status) as "DRAFT" | "SENT" | "PAID" | "OVERDUE") : "DRAFT",
    notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
  };

  const created = await prisma.invoice.create({
    data: {
      invoiceNo: sanitizedData.invoiceNo,
      projectId: sanitizedData.projectId,
      date: new Date(sanitizedData.date),
      amount: new Prisma.Decimal(sanitizedData.amount),
      dueDate: new Date(sanitizedData.dueDate),
      status: sanitizedData.status,
      notes: sanitizedData.notes,
    },
  });

  await logAudit({
    action: "CREATE_INVOICE",
    entity: "Invoice",
    entityId: created.id,
    newValue: JSON.stringify(sanitizedData),
    userId: session.user.id,
  });

  await recalculateProjectFinancials(created.projectId);

  return NextResponse.json({ success: true, data: created });
}
