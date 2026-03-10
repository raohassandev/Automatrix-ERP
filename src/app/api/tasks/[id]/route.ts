import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { toTaskPriority, toTaskStatus } from "@/lib/tasks";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.string().trim().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  assignedToId: z.string().trim().min(1).nullable().optional(),
  reviewScore: z.number().int().min(1).max(5).nullable().optional(),
  reviewNotes: z.string().trim().max(2000).optional().nullable(),
  reopen: z.boolean().optional(),
});

function toDateOrNull(raw: string | undefined) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.projectTask.findUnique({
    where: { id },
    include: { project: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
  }

  const [canManage, canUpdateAssigned, canReview] = await Promise.all([
    requirePermission(session.user.id, "tasks.manage"),
    requirePermission(session.user.id, "tasks.update_assigned"),
    requirePermission(session.user.id, "tasks.review"),
  ]);
  const isAssignee = existing.assignedToId === session.user.id;

  if (!canManage && !(canUpdateAssigned && isAssignee) && !canReview) {
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

  const payload = parsed.data;
  const data: Record<string, unknown> = { updatedById: session.user.id };

  if (payload.reopen) {
    if (!canReview) {
      return NextResponse.json({ success: false, error: "Review permission required to reopen tasks" }, { status: 403 });
    }
    data.status = "IN_PROGRESS";
    data.progress = Math.min(90, Number(existing.progress || 0));
    data.reviewScore = null;
    data.reviewNotes = null;
    data.reviewedById = null;
    data.reviewedAt = null;
  } else if (canManage) {
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description || null;
    if (payload.status !== undefined) data.status = toTaskStatus(payload.status);
    if (payload.priority !== undefined) data.priority = toTaskPriority(payload.priority);
    if (payload.progress !== undefined) data.progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));
    if (payload.dueDate !== undefined) {
      if (!payload.dueDate) {
        data.dueDate = null;
      } else {
        const dueDate = toDateOrNull(payload.dueDate);
        if (!dueDate) {
          return NextResponse.json({ success: false, error: "Invalid due date" }, { status: 400 });
        }
        data.dueDate = dueDate;
      }
    }
    if (payload.assignedToId !== undefined) {
      if (payload.assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: payload.assignedToId },
          select: { id: true },
        });
        if (!assignee) {
          return NextResponse.json({ success: false, error: "Assigned user not found" }, { status: 400 });
        }
        data.assignedToId = payload.assignedToId;
      } else {
        data.assignedToId = null;
      }
    }
  } else if (canUpdateAssigned && isAssignee) {
    if (payload.status !== undefined) data.status = toTaskStatus(payload.status);
    if (payload.progress !== undefined) data.progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));
    if (payload.reviewScore !== undefined || payload.reviewNotes !== undefined || payload.assignedToId !== undefined || payload.priority !== undefined || payload.title !== undefined || payload.description !== undefined) {
      return NextResponse.json(
        { success: false, error: "Only status and progress can be updated for assigned tasks." },
        { status: 403 },
      );
    }
  }

  if ((payload.reviewScore !== undefined || payload.reviewNotes !== undefined) && !canReview) {
    return NextResponse.json({ success: false, error: "Review permission required." }, { status: 403 });
  }
  if (canReview && (payload.reviewScore !== undefined || payload.reviewNotes !== undefined)) {
    data.reviewScore = payload.reviewScore === null ? null : payload.reviewScore;
    data.reviewNotes = payload.reviewNotes || null;
    data.reviewedById = session.user.id;
    data.reviewedAt = new Date();
  }

  const updated = await prisma.projectTask.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, projectId: true, name: true, status: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, title: true, intervalType: true, intervalValue: true } },
    },
  });

  await logAudit({
    action: payload.reopen ? "TASK_REOPEN" : "TASK_UPDATE",
    entity: "ProjectTask",
    entityId: updated.id,
    userId: session.user.id,
    oldValue: JSON.stringify({
      status: existing.status,
      progress: existing.progress,
      priority: existing.priority,
      dueDate: existing.dueDate?.toISOString() || null,
      assignedToId: existing.assignedToId || null,
      reviewScore: existing.reviewScore,
    }),
    newValue: JSON.stringify({
      status: updated.status,
      progress: updated.progress,
      priority: updated.priority,
      dueDate: updated.dueDate?.toISOString() || null,
      assignedToId: updated.assignedToId || null,
      reviewScore: updated.reviewScore,
    }),
  });

  return NextResponse.json({ success: true, data: updated });
}
