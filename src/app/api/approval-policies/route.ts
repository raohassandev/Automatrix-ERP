import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApprovalPolicies } from "@/lib/approval-policies";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    (await requirePermission(session.user.id, "employees.view_all")) ||
    (await requirePermission(session.user.id, "approvals.view_all"));
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [policies, roles] = await Promise.all([
    getApprovalPolicies(),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    policies: policies.map((policy) => ({
      id: policy.id,
      module: policy.module,
      level: policy.level,
      minAmount: parseFloat(policy.minAmount.toString()),
      maxAmount: policy.maxAmount ? parseFloat(policy.maxAmount.toString()) : null,
      roleIds: policy.roles.map((role) => role.roleId),
      roleNames: policy.roles.map((role) => role.role.name),
    })),
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage =
    (await requirePermission(session.user.id, "employees.view_all")) ||
    (await requirePermission(session.user.id, "approvals.view_all"));
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const policyId = typeof body?.policyId === "string" ? body.policyId : null;
  const roleIds = Array.isArray(body?.roleIds) ? body.roleIds.filter((id) => typeof id === "string") : null;

  if (!policyId || !roleIds) {
    return NextResponse.json({ error: "policyId and roleIds are required" }, { status: 400 });
  }

  const policy = await prisma.approvalPolicy.findUnique({ where: { id: policyId } });
  if (!policy) {
    return NextResponse.json({ error: "Approval policy not found" }, { status: 404 });
  }

  const uniqueRoleIds = Array.from(new Set(roleIds));

  await prisma.$transaction([
    prisma.approvalPolicyRole.deleteMany({ where: { policyId } }),
    ...(uniqueRoleIds.length > 0
      ? [
          prisma.approvalPolicyRole.createMany({
            data: uniqueRoleIds.map((roleId) => ({ policyId, roleId })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
