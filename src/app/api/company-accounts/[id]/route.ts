import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateCompanyAccountSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(["CASH", "BANK"]).optional(),
  currency: z.string().trim().min(1).optional(),
  openingBalance: z.number().finite().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.companyAccount.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateCompanyAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.companyAccount.update({
      where: { id },
      data: parsed.data,
    });

    await logAudit({
      action: "UPDATE_COMPANY_ACCOUNT",
      entity: "CompanyAccount",
      entityId: id,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Account name already exists" }, { status: 400 });
    }
    console.error("Error updating company account:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.companyAccount.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const inUse = await prisma.vendorPayment.count({ where: { companyAccountId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { success: false, error: "Cannot delete: account is referenced by vendor payments." },
      { status: 400 }
    );
  }

  await prisma.companyAccount.delete({ where: { id } });

  await logAudit({
    action: "DELETE_COMPANY_ACCOUNT",
    entity: "CompanyAccount",
    entityId: id,
    oldValue: JSON.stringify(existing),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}

