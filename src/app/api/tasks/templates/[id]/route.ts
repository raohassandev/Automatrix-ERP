import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { computeNextTemplateRun, parseWeekdays, toIntervalType, toTaskPriority } from "@/lib/tasks";

const updateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  intervalType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  intervalValue: z.number().int().min(1).max(90).optional(),
  weekdays: z.string().trim().optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  dueAfterDays: z.number().int().min(0).max(365).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional().nullable(),
  projectId: z.string().trim().min(1).optional(),
  assignedToId: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

function parseDate(raw: string, label: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${label}`);
  }
  return d;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManageTemplates = await requirePermission(session.user.id, "tasks.templates_manage");
  if (!canManageTemplates) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.taskTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }
  }
  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId },
      select: { id: true },
    });
    if (!assignee) {
      return NextResponse.json({ success: false, error: "Assigned user not found" }, { status: 400 });
    }
  }

  const intervalType = toIntervalType(parsed.data.intervalType || existing.intervalType);
  const intervalValue = Math.max(1, Number(parsed.data.intervalValue || existing.intervalValue || 1));
  const weekdays =
    parsed.data.weekdays !== undefined
      ? (() => {
          const list = parseWeekdays(parsed.data.weekdays || "");
          return list.length > 0 ? list.join(",") : null;
        })()
      : existing.weekdays;
  const dayOfMonth =
    parsed.data.dayOfMonth !== undefined
      ? parsed.data.dayOfMonth
        ? Math.max(1, Math.min(31, parsed.data.dayOfMonth))
        : null
      : existing.dayOfMonth;

  let startDate = existing.startDate;
  let endDate = existing.endDate;
  try {
    if (parsed.data.startDate !== undefined) {
      startDate = parseDate(parsed.data.startDate, "start date");
    }
    if (parsed.data.endDate !== undefined) {
      endDate = parsed.data.endDate ? parseDate(parsed.data.endDate, "end date") : null;
    }
    if (endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ success: false, error: "End date cannot be before start date" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid dates" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description || null;
  if (parsed.data.priority !== undefined) data.priority = toTaskPriority(parsed.data.priority);
  if (parsed.data.intervalType !== undefined) data.intervalType = intervalType;
  if (parsed.data.intervalValue !== undefined) data.intervalValue = intervalValue;
  if (parsed.data.weekdays !== undefined) data.weekdays = weekdays;
  if (parsed.data.dayOfMonth !== undefined) data.dayOfMonth = dayOfMonth;
  if (parsed.data.dueAfterDays !== undefined) data.dueAfterDays = Math.max(0, parsed.data.dueAfterDays);
  if (parsed.data.startDate !== undefined) data.startDate = startDate;
  if (parsed.data.endDate !== undefined) data.endDate = endDate;
  if (parsed.data.projectId !== undefined) data.projectId = parsed.data.projectId;
  if (parsed.data.assignedToId !== undefined) data.assignedToId = parsed.data.assignedToId || null;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  const shouldRecalculateNext =
    parsed.data.intervalType !== undefined ||
    parsed.data.intervalValue !== undefined ||
    parsed.data.weekdays !== undefined ||
    parsed.data.dayOfMonth !== undefined ||
    parsed.data.startDate !== undefined;

  if (shouldRecalculateNext) {
    data.nextRunAt = computeNextTemplateRun({
      intervalType,
      intervalValue,
      weekdays,
      dayOfMonth,
      startDate,
      fromDate: new Date(Date.now() - 1000),
    });
  }

  const updated = await prisma.taskTemplate.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, projectId: true, name: true, status: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      tasks: {
        select: { id: true, status: true, createdAt: true, instanceDate: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  await logAudit({
    action: "TASK_TEMPLATE_UPDATE",
    entity: "TaskTemplate",
    entityId: updated.id,
    userId: session.user.id,
    oldValue: JSON.stringify({
      title: existing.title,
      intervalType: existing.intervalType,
      intervalValue: existing.intervalValue,
      nextRunAt: existing.nextRunAt?.toISOString() || null,
      isActive: existing.isActive,
    }),
    newValue: JSON.stringify({
      title: updated.title,
      intervalType: updated.intervalType,
      intervalValue: updated.intervalValue,
      nextRunAt: updated.nextRunAt?.toISOString() || null,
      isActive: updated.isActive,
    }),
  });

  return NextResponse.json({ success: true, data: updated });
}
