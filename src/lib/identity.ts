import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function normalizeEmail(email: string | null | undefined) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function findEmployeeByEmailInsensitive<T extends Prisma.EmployeeFindFirstArgs>(
  email: string | null | undefined,
  args?: Prisma.SelectSubset<T, Prisma.EmployeeFindFirstArgs>
): Promise<Prisma.EmployeeGetPayload<T> | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const safeArgs = (args ?? {}) as Prisma.EmployeeFindFirstArgs;
  return prisma.employee.findFirst({
    ...safeArgs,
    where: {
      ...((safeArgs.where as object | undefined) ?? {}),
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
  }) as Promise<Prisma.EmployeeGetPayload<T> | null>;
}

export async function findUserByEmailInsensitive<T extends Prisma.UserFindFirstArgs>(
  email: string | null | undefined,
  args?: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>
): Promise<Prisma.UserGetPayload<T> | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const safeArgs = (args ?? {}) as Prisma.UserFindFirstArgs;
  return prisma.user.findFirst({
    ...safeArgs,
    where: {
      ...((safeArgs.where as object | undefined) ?? {}),
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
  }) as Promise<Prisma.UserGetPayload<T> | null>;
}
