import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  dueDate: z.string().trim().optional(),
  assignedToId: z.string().trim().min(1).optional(),
});

type ProjectTaskRecord = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  assignedToId: string | null;
};

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [canViewAll, canViewAssigned, canViewAllTasks, canViewAssignedTasks] = await Promise.all([
    requirePermission(session.user.id, "projects.view_all"),
    requirePermission(session.user.id, "projects.view_assigned"),
    requirePermission(session.user.id, "tasks.view_all"),
    requirePermission(session.user.id, "tasks.view_assigned"),
  ]);
  if (!canViewAll && !canViewAssigned && !canViewAllTasks && !canViewAssignedTasks) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!canViewAll && !canViewAllTasks) {
    const assignment = await prisma.projectAssignment.findFirst({
      where: { projectId: id, userId: session.user.id },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const projectTaskClient = (prisma as unknown as {
    projectTask: { findMany: (args: unknown) => Promise<unknown> };
  }).projectTask;
  const rows = (await projectTaskClient.findMany({
    where: { projectId: id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
    take: 300,
  })) as unknown;

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [canEdit, canAssign] = await Promise.all([
    (await requirePermission(session.user.id, "projects.edit")) ||
      (await requirePermission(session.user.id, "tasks.manage")),
    requirePermission(session.user.id, "tasks.assign"),
  ]);
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, projectId: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid due date" }, { status: 400 });
  }

  if (parsed.data.assignedToId) {
    const assigningOtherUser = parsed.data.assignedToId !== session.user.id;
    if (assigningOtherUser && !canAssign) {
      return NextResponse.json({ success: false, error: "Task assign permission required" }, { status: 403 });
    }
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId },
      select: { id: true },
    });
    if (!assignee) {
      return NextResponse.json({ success: false, error: "Assigned user not found" }, { status: 400 });
    }
  }

  const projectTaskClient = (prisma as unknown as {
    projectTask: { create: (args: unknown) => Promise<unknown> };
  }).projectTask;
  const created = (await projectTaskClient.create({
    data: {
      projectId: project.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      dueDate,
      assignedToId: parsed.data.assignedToId || null,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })) as ProjectTaskRecord;

  await logAudit({
    action: "PROJECT_TASK_CREATE",
    entity: "Project",
    entityId: project.id,
    userId: session.user.id,
    newValue: JSON.stringify({
      taskId: created.id,
      title: created.title,
      priority: created.priority,
      dueDate: created.dueDate?.toISOString() || null,
      assignedToId: created.assignedToId,
    }),
  });

  return NextResponse.json({ success: true, data: created });
}
