import { Prisma, type PermissionOverrideEffect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSION_KEYS, PERMISSIONS, type RoleName } from "@/lib/permissions";

type EffectivePermissionsResult = {
  roleName: RoleName;
  permissions: Set<string>;
  denied: Set<string>;
};

type PermissionCacheEntry = {
  expiresAt: number;
  data: EffectivePermissionsResult;
};

const PERMISSION_CACHE_TTL_MS = 5_000;
const permissionCache = new Map<string, PermissionCacheEntry>();

function mapDbRoleToRoleName(name: string | null | undefined): RoleName {
  if (!name) return "Guest";
  return (name in PERMISSIONS ? name : "Guest") as RoleName;
}

function hasStaticPermission(roleName: RoleName, permission: string) {
  const rolePermissions = (PERMISSIONS[roleName] ?? []) as readonly string[];
  if (rolePermissions.includes("*")) return true;
  if (rolePermissions.includes(permission)) return true;

  const moduleKey = permission.split(".")[0];
  return rolePermissions.includes(`${moduleKey}.*`);
}

function hasPermissionInSet(permissionSet: Set<string>, permission: string) {
  if (permissionSet.has("*")) return true;
  if (permissionSet.has(permission)) return true;
  const moduleKey = permission.split(".")[0];
  return permissionSet.has(`${moduleKey}.*`);
}

export async function ensurePermissionCatalog() {
  await prisma.permission.createMany({
    data: PERMISSION_KEYS.map((key) => ({ key })),
    skipDuplicates: true,
  });
}

export async function getEffectivePermissionsForUser(userId: string): Promise<EffectivePermissionsResult> {
  const cached = permissionCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  await ensurePermissionCatalog();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      permissionOverrides: {
        include: { permission: true },
      },
    },
  });

  const roleName = mapDbRoleToRoleName(user?.role?.name);
  const rolePermissionSet = new Set<string>(
    user?.role?.permissions.map((entry) => entry.permission.key) ?? []
  );

  // Always include static baseline permissions for known built-in roles.
  // DB matrix can extend this; user overrides can still ALLOW/DENY at user level.
  if (hasStaticPermission(roleName, "*")) {
    rolePermissionSet.add("*");
  }
  for (const permissionKey of PERMISSION_KEYS) {
    if (hasStaticPermission(roleName, permissionKey)) {
      rolePermissionSet.add(permissionKey);
    }
  }

  const denied = new Set<string>();
  for (const override of user?.permissionOverrides ?? []) {
    if (override.effect === "DENY") {
      rolePermissionSet.delete(override.permission.key);
      denied.add(override.permission.key);
    }
  }

  for (const override of user?.permissionOverrides ?? []) {
    if (override.effect === "ALLOW") {
      rolePermissionSet.add(override.permission.key);
      denied.delete(override.permission.key);
    }
  }

  const data = { roleName, permissions: rolePermissionSet, denied };
  permissionCache.set(userId, { expiresAt: now + PERMISSION_CACHE_TTL_MS, data });
  return data;
}

export async function userHasEffectivePermission(userId: string, permission: string) {
  const { permissions } = await getEffectivePermissionsForUser(userId);
  return hasPermissionInSet(permissions, permission);
}

export async function getEffectivePermissionsList(userId: string) {
  const { permissions } = await getEffectivePermissionsForUser(userId);
  return Array.from(permissions).sort((a, b) => a.localeCompare(b));
}

export function hasPermissionFromList(permissionList: string[], permission: string) {
  return hasPermissionInSet(new Set(permissionList), permission);
}

export async function replaceRolePermissions(roleId: string, permissionKeys: string[]) {
  await ensurePermissionCatalog();

  const uniqueKeys = Array.from(new Set(permissionKeys));
  const dbPermissions = await prisma.permission.findMany({
    where: { key: { in: uniqueKeys } },
    select: { id: true, key: true },
  });

  const foundKeys = new Set(dbPermissions.map((permission) => permission.key));
  const missing = uniqueKeys.filter((key) => !foundKeys.has(key));
  if (missing.length > 0) {
    throw new Error(`Unknown permissions: ${missing.join(", ")}`);
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    ...(dbPermissions.length > 0
      ? [
          prisma.rolePermission.createMany({
            data: dbPermissions.map((permission) => ({
              roleId,
              permissionId: permission.id,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  invalidatePermissionCache();
}

export async function replaceUserPermissionOverrides(
  userId: string,
  overrides: Array<{ permissionKey: string; effect: PermissionOverrideEffect; reason?: string | null }>
) {
  await ensurePermissionCatalog();

  const uniqueByPermission = new Map<string, { effect: PermissionOverrideEffect; reason?: string | null }>();
  for (const override of overrides) {
    uniqueByPermission.set(override.permissionKey, {
      effect: override.effect,
      reason: override.reason ?? null,
    });
  }

  const keys = Array.from(uniqueByPermission.keys());
  const dbPermissions = keys.length
    ? await prisma.permission.findMany({
        where: { key: { in: keys } },
        select: { id: true, key: true },
      })
    : [];

  const found = new Set(dbPermissions.map((permission) => permission.key));
  const missing = keys.filter((key) => !found.has(key));
  if (missing.length > 0) {
    throw new Error(`Unknown permissions: ${missing.join(", ")}`);
  }

  await prisma.$transaction([
    prisma.userPermissionOverride.deleteMany({ where: { userId } }),
    ...(dbPermissions.length > 0
      ? [
          prisma.userPermissionOverride.createMany({
            data: dbPermissions.map((permission) => ({
              userId,
              permissionId: permission.id,
              effect: uniqueByPermission.get(permission.key)?.effect ?? "ALLOW",
              reason: uniqueByPermission.get(permission.key)?.reason ?? null,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  invalidatePermissionCache(userId);
}

export function invalidatePermissionCache(userId?: string) {
  if (userId) {
    permissionCache.delete(userId);
    return;
  }

  permissionCache.clear();
}

export function permissionKeyToLabel(permissionKey: string) {
  const [module, action] = permissionKey.split(".");
  const moduleLabel = (module || "general")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const actionLabel = (action || "access")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return `${moduleLabel} - ${actionLabel}`;
}

export function groupPermissionKeys(permissionKeys: string[]) {
  return permissionKeys
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, string[]>>((acc, key) => {
      const module = key.split(".")[0] || "general";
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(key);
      return acc;
    }, {});
}

export function toPrismaDecimal(value: number) {
  return new Prisma.Decimal(value);
}
