import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]).optional(),
  normalSide: z.enum(["DEBIT", "CREDIT"]).optional(),
  parentId: z.string().trim().optional(),
  isPosting: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const canView = await requirePermission(session.user.id, "accounting.view");
  if (!canView) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const data = await prisma.glAccount.findUnique({
    where: { id },
    include: { parent: true, children: true },
  });
  if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canManage) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const existing = await prisma.glAccount.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  try {
    const updated = await prisma.glAccount.update({
      where: { id },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        normalSide: parsed.data.normalSide,
        parentId: parsed.data.parentId === "" ? null : parsed.data.parentId,
        isPosting: parsed.data.isPosting,
        isActive: parsed.data.isActive,
      },
    });
    await logAudit({
      action: "UPDATE_GL_ACCOUNT",
      entity: "GlAccount",
      entityId: id,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Account code already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canManage) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const existing = await prisma.glAccount.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const lineCount = await prisma.journalLine.count({ where: { glAccountId: id } });
  if (lineCount > 0) {
    const updated = await prisma.glAccount.update({ where: { id }, data: { isActive: false } });
    await logAudit({
      action: "DEACTIVATE_GL_ACCOUNT",
      entity: "GlAccount",
      entityId: id,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify({ isActive: false }),
      reason: "Soft-deactivated because journal history exists.",
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  }

  await prisma.glAccount.delete({ where: { id } });
  await logAudit({
    action: "DELETE_GL_ACCOUNT",
    entity: "GlAccount",
    entityId: id,
    oldValue: JSON.stringify(existing),
    userId: session.user.id,
  });
  return NextResponse.json({ success: true });
}
