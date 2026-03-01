import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  normalSide: z.enum(["DEBIT", "CREDIT"]).optional(),
  parentId: z.string().trim().optional(),
  isPosting: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const canView = await requirePermission(session.user.id, "accounting.view");
  if (!canView) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const active = (searchParams.get("active") || "").trim().toLowerCase();
  const type = (searchParams.get("type") || "").trim().toUpperCase();

  const where: import("@prisma/client").Prisma.GlAccountWhereInput = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;
  if (["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(type)) {
    where.type = type;
  }

  const data = await prisma.glAccount.findMany({
    where,
    orderBy: [{ code: "asc" }],
    include: { parent: { select: { id: true, code: true, name: true } } },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const canManage = await requirePermission(session.user.id, "accounting.manage");
  if (!canManage) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await prisma.glAccount.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        normalSide: parsed.data.normalSide || null,
        parentId: parsed.data.parentId || null,
        isPosting: parsed.data.isPosting ?? true,
        isActive: parsed.data.isActive ?? true,
        currency: "PKR",
      },
    });
    await logAudit({
      action: "CREATE_GL_ACCOUNT",
      entity: "GlAccount",
      entityId: created.id,
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ success: false, error: "Account code already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
