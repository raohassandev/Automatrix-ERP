import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

type AssignmentInput = { userId: string; role?: string };

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "projects.view_all");
  const canViewAssigned = await requirePermission(session.user.id, "projects.view_assigned");
  if (!canViewAll && !canViewAssigned) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  if (!canViewAll) {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId: id, userId: session.user.id },
      select: { id: true },
    });
    if (!assigned) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    include: { user: { include: { role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: assignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      role: assignment.role,
      user: {
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
        role: assignment.user.role?.name || null,
      },
    })),
  });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canAssign = await requirePermission(session.user.id, "projects.assign");
  if (!canAssign) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();
  const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
  const sanitizedAssignments: AssignmentInput[] = assignments
    .filter((assignment: AssignmentInput) => typeof assignment?.userId === "string")
    .map((assignment: AssignmentInput) => ({
      userId: sanitizeString(assignment.userId),
      role: assignment.role ? sanitizeString(assignment.role) : "MEMBER",
    }));

  if (sanitizedAssignments.length === 0) {
    await prisma.projectAssignment.deleteMany({ where: { projectId: id } });
    return NextResponse.json({ success: true, data: [] });
  }

  const userIds = sanitizedAssignments.map((assignment) => assignment.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  if (users.length !== userIds.length) {
    return NextResponse.json({ success: false, error: "One or more users not found" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.projectAssignment.deleteMany({ where: { projectId: id } });
    await tx.projectAssignment.createMany({
      data: sanitizedAssignments.map((assignment) => ({
        projectId: id,
        userId: assignment.userId,
        role: assignment.role || "MEMBER",
      })),
    });
    return tx.projectAssignment.findMany({
      where: { projectId: id },
      include: { user: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    });
  });

  await logAudit({
    action: "UPDATE_PROJECT_ASSIGNMENTS",
    entity: "Project",
    entityId: id,
    newValue: JSON.stringify(sanitizedAssignments),
    userId: session.user.id,
  });

  return NextResponse.json({
    success: true,
    data: result.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      role: assignment.role,
      user: {
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
        role: assignment.user.role?.name || null,
      },
    })),
  });
}
