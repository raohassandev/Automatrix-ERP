"use client";

import { useEffect, useMemo, useState } from "react";
import { PERMISSION_KEYS, hasPermission, type RoleName } from "@/lib/permissions";

type EffectivePermissionsResponse = {
  permissions: string[];
};

function hasPermissionFromSet(permissionSet: Set<string>, permission: string) {
  if (permissionSet.has("*")) return true;
  if (permissionSet.has(permission)) return true;
  const moduleKey = permission.split(".")[0];
  return permissionSet.has(`${moduleKey}.*`);
}

export function useEffectivePermissions(roleName: RoleName) {
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/me/effective-permissions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load permissions");
        }
        return (await response.json()) as EffectivePermissionsResponse;
      })
      .then((data) => {
        if (!isMounted) return;
        setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setPermissions(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const permissionSet = useMemo(() => {
    if (permissions) {
      return new Set(permissions);
    }

    const fallback = new Set<string>();
    for (const permissionKey of PERMISSION_KEYS) {
      if (hasPermission(roleName, permissionKey)) {
        fallback.add(permissionKey);
      }
    }
    return fallback;
  }, [permissions, roleName]);

  const canAccess = (requiredPermissions?: string[]) => {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    return requiredPermissions.some((permission) => hasPermissionFromSet(permissionSet, permission));
  };

  return {
    permissions: permissions ?? Array.from(permissionSet),
    canAccess,
    isLoaded: permissions !== null,
  };
}
