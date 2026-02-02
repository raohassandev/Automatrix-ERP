import { prisma } from "@/lib/prisma";
import { hasPermission, RoleName } from "@/lib/permissions";

export async function getUserRoleName(userId: string): Promise<RoleName> {
  // Handle development bypass user
  if (process.env.NODE_ENV === "development" && userId === "dev-admin-id") {
    return "CEO";
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user?.role?.name) return "Guest";
  return user.role.name as RoleName;
}

export async function requirePermission(userId: string, permission: string) {
  const role = await getUserRoleName(userId);
  return hasPermission(role, permission);
}
