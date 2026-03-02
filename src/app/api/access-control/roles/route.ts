import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { requirePermission } from "@/lib/rbac";
import { ensureBuiltInRoleTemplateDefaults, groupPermissionKeys, permissionKeyToLabel, replaceRolePermissions } from "@/lib/access-control";
import { logAudit } from "@/lib/audit";

async function canManageAccess(userId: string) {
  const [canManageEmployees, canManageAccounting] = await Promise.all([
    requirePermission(userId, "employees.view_all"),
    requirePermission(userId, "accounting.manage"),
  ]);
  return canManageEmployees || canManageAccounting;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageAccess(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Keep built-in roles usable if they were created without DB permissions.
  await ensureBuiltInRoleTemplateDefaults();

  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const grouped = groupPermissionKeys(PERMISSION_KEYS);
  const permissionCatalog = Object.entries(grouped).map(([module, keys]) => ({
    module,
    permissions: keys.map((key) => ({ key, label: permissionKeyToLabel(key) })),
  }));

  return NextResponse.json({
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissionKeys: role.permissions.map((rp) => rp.permission.key).sort((a, b) => a.localeCompare(b)),
    })),
    permissionCatalog,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageAccess(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const roleId = typeof body?.roleId === "string" ? body.roleId : "";
  const permissionKeys = Array.isArray(body?.permissionKeys)
    ? body.permissionKeys.filter((key: unknown): key is string => typeof key === "string")
    : null;

  if (!roleId || !permissionKeys) {
    return NextResponse.json({ error: "roleId and permissionKeys are required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  try {
    await replaceRolePermissions(roleId, permissionKeys);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update role template" },
      { status: 400 }
    );
  }

  await logAudit({
    action: "UPDATE_ROLE_TEMPLATE",
    entity: "Role",
    entityId: roleId,
    newValue: JSON.stringify({ roleName: role.name, permissionKeys: Array.from(new Set(permissionKeys)).sort() }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
