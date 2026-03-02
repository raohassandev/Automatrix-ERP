import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { ensureApprovalPolicies } from "@/lib/approval-policies";
import { logAudit } from "@/lib/audit";

async function canManageAccess(userId: string) {
  const [canManageEmployees, canManageApprovals, canManageAccounting] = await Promise.all([
    requirePermission(userId, "employees.view_all"),
    requirePermission(userId, "approvals.view_all"),
    requirePermission(userId, "accounting.manage"),
  ]);
  return canManageEmployees || canManageApprovals || canManageAccounting;
}

function moduleLabel(module: string) {
  if (module === "expense") return "Expense";
  if (module === "income") return "Income";
  if (module === "procurement") return "Procurement";
  return module.charAt(0).toUpperCase() + module.slice(1);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canManageAccess(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureApprovalPolicies();

  const [roles, policies] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.approvalPolicy.findMany({
      include: {
        roles: { include: { role: true } },
      },
      orderBy: [{ module: "asc" }, { minAmount: "asc" }],
    }),
  ]);

  const grouped = policies.reduce<Record<string, typeof policies>>((acc, policy) => {
    if (!acc[policy.module]) {
      acc[policy.module] = [];
    }
    acc[policy.module].push(policy);
    return acc;
  }, {});

  const approvalRoutes = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, modulePolicies]) => ({
      module,
      moduleLabel: moduleLabel(module),
      stages: modulePolicies.map((policy, index) => ({
        id: policy.id,
        stageNumber: index + 1,
        stageLabel: `Stage ${index + 1}`,
        amountFrom: Number(policy.minAmount),
        amountTo: policy.maxAmount == null ? null : Number(policy.maxAmount),
        roleIds: policy.roles.map((entry) => entry.roleId),
        roleNames: policy.roles.map((entry) => entry.role.name),
      })),
    }));

  return NextResponse.json({
    roles,
    approvalRoutes,
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
  const routeId = typeof body?.routeId === "string" ? body.routeId : "";
  const roleIds = Array.isArray(body?.roleIds)
    ? body.roleIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  const amountFrom = typeof body?.amountFrom === "number" ? body.amountFrom : null;
  const amountTo = typeof body?.amountTo === "number" ? body.amountTo : body?.amountTo === null ? null : undefined;

  if (!routeId || !roleIds || amountFrom === null || amountFrom < 0 || amountTo === undefined || (amountTo !== null && amountTo < amountFrom)) {
    return NextResponse.json(
      { error: "routeId, roleIds, amountFrom and valid amountTo are required" },
      { status: 400 }
    );
  }

  const policy = await prisma.approvalPolicy.findUnique({ where: { id: routeId } });
  if (!policy) {
    return NextResponse.json({ error: "Approval route not found" }, { status: 404 });
  }

  const siblingPolicies = await prisma.approvalPolicy.findMany({
    where: { module: policy.module, id: { not: routeId } },
    select: { id: true, minAmount: true, maxAmount: true },
  });

  for (const sibling of siblingPolicies) {
    const siblingMin = Number(sibling.minAmount);
    const siblingMax = sibling.maxAmount === null ? Number.POSITIVE_INFINITY : Number(sibling.maxAmount);
    const currentMin = amountFrom;
    const currentMax = amountTo === null ? Number.POSITIVE_INFINITY : amountTo;
    const overlaps = currentMin < siblingMax && siblingMin < currentMax;
    if (overlaps) {
      return NextResponse.json(
        { error: "Amount range overlaps another stage in the same module. Adjust ranges to avoid overlap." },
        { status: 400 }
      );
    }
  }

  const uniqueRoleIds: string[] = Array.from(new Set(roleIds));

  await prisma.$transaction(async (tx) => {
    await tx.approvalPolicy.update({
      where: { id: routeId },
      data: {
        minAmount: new Prisma.Decimal(amountFrom),
        maxAmount: amountTo === null ? null : new Prisma.Decimal(amountTo),
      },
    });

    await tx.approvalPolicyRole.deleteMany({ where: { policyId: routeId } });
    if (uniqueRoleIds.length > 0) {
      await tx.approvalPolicyRole.createMany({
        data: uniqueRoleIds.map((roleId) => ({
          policyId: routeId,
          roleId,
        })),
        skipDuplicates: true,
      });
    }
  });

  await logAudit({
    action: "UPDATE_APPROVAL_ROUTE",
    entity: "ApprovalPolicy",
    entityId: routeId,
    userId: session.user.id,
    newValue: JSON.stringify({ module: policy.module, level: policy.level, amountFrom, amountTo, roleIds: uniqueRoleIds }),
  });

  return NextResponse.json({ success: true });
}
