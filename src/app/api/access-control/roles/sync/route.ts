import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { syncBuiltInRoleTemplateDefaults } from "@/lib/access-control";

async function canManageAccess(userId: string) {
  const [canManageEmployees, canManageAccounting] = await Promise.all([
    requirePermission(userId, "employees.view_all"),
    requirePermission(userId, "accounting.manage"),
  ]);
  return canManageEmployees || canManageAccounting;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageAccess(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await syncBuiltInRoleTemplateDefaults();
  const changed = summary.filter((row) => row.changed);

  await logAudit({
    action: "SYNC_ROLE_TEMPLATES_BASELINE",
    entity: "Role",
    entityId: "ALL",
    userId: session.user.id,
    newValue: JSON.stringify({
      changedCount: changed.length,
      changedRoles: changed.map((row) => row.roleName),
    }),
  });

  return NextResponse.json({
    success: true,
    changedCount: changed.length,
    summary,
  });
}
