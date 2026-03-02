import { PermissionOverrideEffect } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { requirePermission } from "@/lib/rbac";
import {
  getEffectivePermissionsForUser,
  groupPermissionKeys,
  permissionKeyToLabel,
  replaceUserPermissionOverrides,
} from "@/lib/access-control";
import { logAudit } from "@/lib/audit";

async function canManageAccess(userId: string) {
  const [canManageEmployees, canManageAccounting] = await Promise.all([
    requirePermission(userId, "employees.view_all"),
    requirePermission(userId, "accounting.manage"),
  ]);
  return canManageEmployees || canManageAccounting;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageAccess(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const users = await prisma.user.findMany({
    include: {
      role: { select: { name: true } },
      permissionOverrides: { include: { permission: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const grouped = groupPermissionKeys(PERMISSION_KEYS);
  const permissionCatalog = Object.entries(grouped).map(([module, keys]) => ({
    module,
    permissions: keys.map((key) => ({ key, label: permissionKeyToLabel(key) })),
  }));

  let selectedUser: {
    id: string;
    name: string | null;
    email: string;
    roleName: string;
    overrides: Array<{ permissionKey: string; effect: PermissionOverrideEffect; reason: string | null }>;
    effectivePermissions: string[];
  } | null = null;

  if (userId) {
    const user = users.find((entry) => entry.id === userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const effective = await getEffectivePermissionsForUser(user.id);
    selectedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Guest",
      overrides: user.permissionOverrides
        .map((item) => ({
          permissionKey: item.permission.key,
          effect: item.effect,
          reason: item.reason,
        }))
        .sort((a, b) => a.permissionKey.localeCompare(b.permissionKey)),
      effectivePermissions: Array.from(effective.permissions).sort((a, b) => a.localeCompare(b)),
    };
  }

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Guest",
      overrideCount: user.permissionOverrides.length,
      allowCount: user.permissionOverrides.filter((item) => item.effect === "ALLOW").length,
      denyCount: user.permissionOverrides.filter((item) => item.effect === "DENY").length,
    })),
    selectedUser,
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
  const userId = typeof body?.userId === "string" ? body.userId : "";
  type OverridePayload = { permissionKey: string; effect: PermissionOverrideEffect; reason?: string | null };
  const overrides = Array.isArray(body?.overrides)
    ? body.overrides.filter(
        (item: unknown): item is OverridePayload => {
          if (!item || typeof item !== "object") return false;
          const record = item as Record<string, unknown>;
          return (
            typeof record.permissionKey === "string" &&
            (record.effect === "ALLOW" || record.effect === "DENY") &&
            (typeof record.reason === "undefined" || typeof record.reason === "string" || record.reason === null)
          );
        }
      )
    : null;

  if (!userId || overrides === null) {
    return NextResponse.json({ error: "userId and overrides are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await replaceUserPermissionOverrides(userId, overrides);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user overrides" },
      { status: 400 }
    );
  }

  await logAudit({
    action: "UPDATE_USER_PERMISSION_OVERRIDES",
    entity: "User",
    entityId: userId,
    userId: session.user.id,
    newValue: JSON.stringify({
      targetUserEmail: user.email,
      overrides: overrides
        .map((item: OverridePayload) => ({ key: item.permissionKey, effect: item.effect, reason: item.reason ?? null }))
        .sort((a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key)),
    }),
  });

  return NextResponse.json({ success: true });
}
