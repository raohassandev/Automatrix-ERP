import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { departmentSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "departments.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.department.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "departments.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = departmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.department.create({
      data: {
        name: sanitizeString(parsed.data.name),
        description: parsed.data.description ? sanitizeString(parsed.data.description) : undefined,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await logAudit({
      action: "CREATE_DEPARTMENT",
      entity: "Department",
      entityId: created.id,
      newValue: JSON.stringify(parsed.data),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Department name already exists" },
        { status: 400 }
      );
    }
    console.error("Error creating department:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
