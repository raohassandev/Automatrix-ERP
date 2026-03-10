import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { computeNextTemplateRun, parseWeekdays, toIntervalType, toTaskPriority } from "@/lib/tasks";

const createTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  intervalType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  intervalValue: z.number().int().min(1).max(90).optional(),
  weekdays: z.string().trim().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dueAfterDays: z.number().int().min(0).max(365).optional(),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().optional(),
  projectId: z.string().trim().min(1),
  assignedToId: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

function parseDate(raw: string, label: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${label}`);
  }
  return d;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [canManageTemplates, canViewAllTasks, canViewAssigned] = await Promise.all([
    requirePermission(session.user.id, "tasks.templates_manage"),
    requirePermission(session.user.id, "tasks.view_all"),
    requirePermission(session.user.id, "tasks.view_assigned"),
  ]);

  if (!canManageTemplates && !canViewAllTasks && !canViewAssigned) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (!(canManageTemplates || canViewAllTasks)) {
    where.OR = [{ assignedToId: session.user.id }, { createdById: session.user.id }];
  }

  const rows = await prisma.taskTemplate.findMany({
    where,
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
    orderBy: [{ isActive: "desc" }, { nextRunAt: "asc" }],
    take: 300,
  });

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManageTemplates = await requirePermission(session.user.id, "tasks.templates_manage");
  if (!canManageTemplates) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
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

  let startDate: Date;
  let endDate: Date | null = null;
  try {
    startDate = parseDate(parsed.data.startDate, "start date");
    if (parsed.data.endDate) {
      endDate = parseDate(parsed.data.endDate, "end date");
      if (endDate.getTime() < startDate.getTime()) {
        return NextResponse.json({ success: false, error: "End date cannot be before start date" }, { status: 400 });
      }
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid dates" }, { status: 400 });
  }

  const intervalType = toIntervalType(parsed.data.intervalType);
  const intervalValue = Math.max(1, Number(parsed.data.intervalValue || 1));
  const normalizedWeekdays = parseWeekdays(parsed.data.weekdays);
  const weekdays = normalizedWeekdays.length > 0 ? normalizedWeekdays.join(",") : null;
  const dayOfMonth = parsed.data.dayOfMonth ? Math.max(1, Math.min(31, parsed.data.dayOfMonth)) : null;
  const dueAfterDays = Math.max(0, Number(parsed.data.dueAfterDays || 0));
  const nextRunAt =
    startDate.getTime() > Date.now()
      ? startDate
      : computeNextTemplateRun({
          intervalType,
          intervalValue,
          weekdays,
          dayOfMonth,
          startDate,
          fromDate: new Date(Date.now() - 1000),
        });

  const created = await prisma.taskTemplate.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: toTaskPriority(parsed.data.priority || "MEDIUM"),
      intervalType,
      intervalValue,
      weekdays,
      dayOfMonth,
      dueAfterDays,
      startDate,
      endDate,
      nextRunAt,
      isActive: parsed.data.isActive !== false,
      projectId: parsed.data.projectId,
      assignedToId: parsed.data.assignedToId || null,
      createdById: session.user.id,
    },
    include: {
      project: { select: { id: true, projectId: true, name: true, status: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    action: "TASK_TEMPLATE_CREATE",
    entity: "TaskTemplate",
    entityId: created.id,
    userId: session.user.id,
    newValue: JSON.stringify({
      title: created.title,
      intervalType: created.intervalType,
      intervalValue: created.intervalValue,
      nextRunAt: created.nextRunAt.toISOString(),
      projectId: created.projectId,
      assignedToId: created.assignedToId,
    }),
  });

  return NextResponse.json({ success: true, data: created });
}
