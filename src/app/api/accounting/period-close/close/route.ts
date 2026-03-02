import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getPeriodCloseChecklist } from "@/lib/accounting-reports";
import { z } from "zod";

const schema = z.object({
  periodId: z.string().trim().min(1),
  reason: z.string().trim().optional(),
  forceClose: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { periodId, reason, forceClose } = parsed.data;
  const checklist = await getPeriodCloseChecklist(periodId).catch(() => null);
  if (!checklist) {
    return NextResponse.json({ success: false, error: "Fiscal period not found." }, { status: 404 });
  }

  if (!checklist.canClose && !forceClose) {
    return NextResponse.json(
      {
        success: false,
        error: "Cannot close fiscal period until checklist is clean.",
        data: checklist,
      },
      { status: 400 },
    );
  }

  const existing = await prisma.fiscalPeriod.findUnique({ where: { id: periodId } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Fiscal period not found." }, { status: 404 });
  }
  if (existing.status === "CLOSED") {
    return NextResponse.json({ success: false, error: "Period is already closed." }, { status: 400 });
  }

  const updated = await prisma.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status: "CLOSED",
      closeReason: reason || null,
      closedAt: new Date(),
      closedById: session.user.id,
    },
  });

  await logAudit({
    action: "CLOSE_FISCAL_PERIOD",
    entity: "FiscalPeriod",
    entityId: periodId,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updated),
    reason: reason || null,
    userId: session.user.id,
  });

  return NextResponse.json({
    success: true,
    data: {
      period: updated,
      checklist,
      forced: Boolean(forceClose && !checklist.canClose),
    },
  });
}
