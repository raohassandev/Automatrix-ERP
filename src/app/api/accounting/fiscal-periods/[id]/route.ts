import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["CLOSE", "REOPEN"]),
  reason: z.string().trim().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canManage) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const existing = await prisma.fiscalPeriod.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  if (parsed.data.action === "CLOSE") {
    if (existing.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Period is already closed." }, { status: 400 });
    }
    const updated = await prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: "CLOSED",
        closeReason: parsed.data.reason || null,
        closedAt: new Date(),
        closedById: session.user.id,
      },
    });
    await logAudit({
      action: "CLOSE_FISCAL_PERIOD",
      entity: "FiscalPeriod",
      entityId: id,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
      reason: parsed.data.reason || null,
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  }

  const updated = await prisma.fiscalPeriod.update({
    where: { id },
    data: {
      status: "OPEN",
      closeReason: null,
      closedAt: null,
      closedById: null,
    },
  });
  await logAudit({
    action: "REOPEN_FISCAL_PERIOD",
    entity: "FiscalPeriod",
    entityId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updated),
    reason: parsed.data.reason || null,
    userId: session.user.id,
  });
  return NextResponse.json({ success: true, data: updated });
}
