import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EXPENSE_APPROVAL_LEVELS, INCOME_APPROVAL_LEVELS } from "@/lib/constants";
import type { ApprovalLevel as ExpenseApprovalLevel } from "@/lib/approvals";

export type ApprovalModule = "expense" | "income";
export type ApprovalLevel = ExpenseApprovalLevel;

type DefaultPolicy = {
  module: ApprovalModule;
  level: ApprovalLevel;
  minAmount: number;
  maxAmount: number | null;
  roleNames: string[];
};

const DEFAULT_ROLES: Record<ApprovalModule, Record<ApprovalLevel, string[]>> = {
  expense: {
    L1: ["Manager", "Finance Manager", "CFO", "CEO", "Owner", "Admin"],
    L2: ["Finance Manager", "CFO", "CEO", "Owner", "Admin"],
    L3: ["CEO", "Owner", "Admin"],
  },
  income: {
    L1: ["Finance Manager", "CFO", "CEO", "Owner", "Admin"],
    L2: ["CEO", "Owner", "Admin"],
    L3: ["CEO", "Owner", "Admin"],
  },
};

function buildDefaultPolicies(): DefaultPolicy[] {
  const expensePolicies: DefaultPolicy[] = EXPENSE_APPROVAL_LEVELS.map((level, idx) => {
    const minAmount = idx === 0 ? 0 : EXPENSE_APPROVAL_LEVELS[idx - 1]?.max ?? 0;
    return {
      module: "expense",
      level: level.level,
      minAmount,
      maxAmount: Number.isFinite(level.max) ? level.max : null,
      roleNames: DEFAULT_ROLES.expense[level.level],
    };
  });

  const incomePolicies: DefaultPolicy[] = INCOME_APPROVAL_LEVELS.map((level, idx) => {
    const minAmount = idx === 0 ? 0 : INCOME_APPROVAL_LEVELS[idx - 1]?.max ?? 0;
    return {
      module: "income",
      level: level.level,
      minAmount,
      maxAmount: Number.isFinite(level.max) ? level.max : null,
      roleNames: DEFAULT_ROLES.income[level.level],
    };
  });

  return [...expensePolicies, ...incomePolicies];
}

export async function ensureApprovalPolicies() {
  const existingCount = await prisma.approvalPolicy.count();
  if (existingCount > 0) return;

  const defaults = buildDefaultPolicies();
  const roleNames = Array.from(
    new Set(defaults.flatMap((policy) => policy.roleNames))
  );

  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
  });
  const roleMap = new Map(roles.map((role) => [role.name, role.id]));

  await prisma.$transaction(
    defaults.map((policy) => {
      const roleIds = policy.roleNames
        .map((name) => roleMap.get(name))
        .filter((id): id is string => Boolean(id));

      return prisma.approvalPolicy.create({
        data: {
          module: policy.module,
          level: policy.level,
          minAmount: new Prisma.Decimal(policy.minAmount),
          maxAmount: policy.maxAmount !== null ? new Prisma.Decimal(policy.maxAmount) : null,
          roles: {
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
      });
    })
  );
}

export async function getApprovalPolicies() {
  await ensureApprovalPolicies();
  return prisma.approvalPolicy.findMany({
    include: {
      roles: {
        include: { role: true },
      },
    },
    orderBy: [{ module: "asc" }, { minAmount: "asc" }],
  });
}

export async function getAllowedRolesForPolicy(
  module: ApprovalModule,
  level: ApprovalLevel
): Promise<string[]> {
  await ensureApprovalPolicies();

  const policy = await prisma.approvalPolicy.findUnique({
    where: { module_level: { module, level } },
    include: { roles: { include: { role: true } } },
  });

  if (!policy) {
    return DEFAULT_ROLES[module]?.[level] ?? [];
  }

  return policy.roles.map((item) => item.role.name);
}

export async function getApprovalPolicyRoleMap() {
  const policies = await getApprovalPolicies();
  const map: Record<string, Record<string, string[]>> = {};

  for (const policy of policies) {
    if (!map[policy.module]) map[policy.module] = {};
    map[policy.module][policy.level] = policy.roles.map((item) => item.role.name);
  }

  return map;
}

export async function userHasApprovalAssignment(userId: string) {
  await ensureApprovalPolicies();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user?.role?.id) return false;

  const assignments = await prisma.approvalPolicyRole.count({
    where: { roleId: user.role.id },
  });
  return assignments > 0;
}
