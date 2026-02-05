import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incentiveSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "incentives.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let where: Record<string, unknown> = {};
  if (!canViewAll) {
    if (!session.user.email) {
      return NextResponse.json({ success: false, error: "User email missing" }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ success: true, data: [] });
    }
    where.employeeId = employee.id;
  }

  const data = await prisma.incentiveEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { employee: true },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = incentiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const status = parsed.data.status ? sanitizeString(parsed.data.status) : "PENDING";
  const canApprove = await requirePermission(session.user.id, "incentives.approve");

  const projectRef = sanitizeString(parsed.data.projectRef);
  const resolvedProject = await resolveProjectId(projectRef);
  if (!resolvedProject) {
    return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
  }
  const project = await prisma.project.findFirst({
    where: { projectId: resolvedProject },
    select: { status: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  const statusValue = (project.status || "").toLowerCase();
  if (!statusValue.includes("complete") && !statusValue.includes("closed") && !statusValue.includes("done")) {
    return NextResponse.json(
      { success: false, error: "Incentives can only be recorded for completed projects" },
      { status: 400 }
    );
  }

  const created = await prisma.incentiveEntry.create({
    data: {
      employeeId: sanitizeString(parsed.data.employeeId),
      projectRef,
      amount: new Prisma.Decimal(parsed.data.amount),
      status: status === "APPROVED" && canApprove ? "APPROVED" : "PENDING",
      reason: parsed.data.reason ? sanitizeString(parsed.data.reason) : null,
      approvedById: status === "APPROVED" && canApprove ? session.user.id : null,
    },
    include: { employee: true },
  });

  await logAudit({
    action: "CREATE_INCENTIVE",
    entity: "IncentiveEntry",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
