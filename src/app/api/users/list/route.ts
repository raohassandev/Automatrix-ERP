import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEditProjects = await requirePermission(session.user.id, "projects.assign");
  const canManageEmployees = await requirePermission(session.user.id, "employees.view_all");
  if (!canEditProjects && !canManageEmployees) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { role: true },
  });

  return NextResponse.json({
    success: true,
    data: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name || null,
    })),
  });
}
