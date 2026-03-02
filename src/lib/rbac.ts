import { prisma } from "@/lib/prisma";
import { RoleName } from "@/lib/permissions";
import { userHasEffectivePermission } from "@/lib/access-control";

export async function getUserRoleName(userId: string): Promise<RoleName> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user?.role?.name) return "Guest";
  return user.role.name as RoleName;
}

export async function requirePermission(userId: string, permission: string) {
  return userHasEffectivePermission(userId, permission);
}
