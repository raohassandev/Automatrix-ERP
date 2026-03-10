import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.string().trim().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  assignedToId: z.string().trim().min(1).nullable().optional(),
});

type ProjectTaskRecord = {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: Date | null;
  assignedToId: string | null;
};

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await context.params;
  const projectTaskClient = (prisma as unknown as {
    projectTask: {
      findFirst: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  }).projectTask;

  const existing = (await projectTaskClient.findFirst({
    where: { id: taskId, projectId: id },
  })) as ProjectTaskRecord | null;
  if (!existing) {
    return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
  }

  const [canProjectEdit, canTaskManage, canUpdateAssigned] = await Promise.all([
    requirePermission(session.user.id, "projects.edit"),
    requirePermission(session.user.id, "tasks.manage"),
    requirePermission(session.user.id, "tasks.update_assigned"),
  ]);
  const canManage = canProjectEdit || canTaskManage;
  const isAssignee = existing.assignedToId === session.user.id;
  if (!canManage && !(canUpdateAssigned && isAssignee)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (canManage) {
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = parsed.data.description || null;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
    if (parsed.data.progress !== undefined) data.progress = parsed.data.progress;
    if (parsed.data.dueDate !== undefined) {
      if (!parsed.data.dueDate) {
        data.dueDate = null;
      } else {
        const dueDate = new Date(parsed.data.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid due date" }, { status: 400 });
        }
        data.dueDate = dueDate;
      }
    }
    if (parsed.data.assignedToId !== undefined) {
      if (parsed.data.assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: parsed.data.assignedToId },
          select: { id: true },
        });
        if (!assignee) {
          return NextResponse.json({ success: false, error: "Assigned user not found" }, { status: 400 });
        }
        data.assignedToId = parsed.data.assignedToId;
      } else {
        data.assignedToId = null;
      }
    }
  } else {
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.progress !== undefined) data.progress = parsed.data.progress;
    if (
      parsed.data.title !== undefined ||
      parsed.data.description !== undefined ||
      parsed.data.priority !== undefined ||
      parsed.data.dueDate !== undefined ||
      parsed.data.assignedToId !== undefined
    ) {
      return NextResponse.json(
        { success: false, error: "Only status and progress are allowed for assigned task updates." },
        { status: 403 },
      );
    }
  }
  data.updatedById = session.user.id;

  const updated = (await projectTaskClient.update({
    where: { id: taskId },
    data,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })) as ProjectTaskRecord;

  await logAudit({
    action: "PROJECT_TASK_UPDATE",
    entity: "Project",
    entityId: id,
    userId: session.user.id,
    oldValue: JSON.stringify({
      title: existing.title,
      status: existing.status,
      priority: existing.priority,
      progress: existing.progress,
      dueDate: existing.dueDate?.toISOString() || null,
      assignedToId: existing.assignedToId,
    }),
    newValue: JSON.stringify({
      taskId: updated.id,
      title: updated.title,
      status: updated.status,
      priority: updated.priority,
      progress: updated.progress,
      dueDate: updated.dueDate?.toISOString() || null,
      assignedToId: updated.assignedToId,
    }),
  });

  return NextResponse.json({ success: true, data: updated });
}
