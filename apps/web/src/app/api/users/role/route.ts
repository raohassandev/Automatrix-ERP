import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "employees.view_all");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  let { email, roleName } = body || {};

  // Sanitize inputs
  if (email) email = sanitizeString(email);
  if (roleName) roleName = sanitizeString(roleName);
  
  if (!email || !roleName) {
    return NextResponse.json({ success: false, error: "email and roleName required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { roleId: role.id },
  });

  return NextResponse.json({ success: true, data: updated });
}
