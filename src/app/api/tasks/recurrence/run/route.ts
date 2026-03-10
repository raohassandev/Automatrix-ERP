import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { computeNextTemplateRun, toTaskPriority } from "@/lib/tasks";

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canRun = (await requirePermission(session.user.id, "tasks.templates_manage")) || (await requirePermission(session.user.id, "tasks.manage"));
  if (!canRun) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const templates = await prisma.taskTemplate.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { nextRunAt: "asc" },
    include: {
      project: { select: { id: true } },
    },
    take: 200,
  });

  let generated = 0;
  let advanced = 0;
  const touchedTemplateIds: string[] = [];

  for (const template of templates) {
    let currentRunAt = new Date(template.nextRunAt);
    let localCycles = 0;
    let latestRunAt: Date | null = null;

    while (currentRunAt.getTime() <= now.getTime() && localCycles < 24) {
      localCycles += 1;

      const dueDate = addDays(currentRunAt, Math.max(0, Number(template.dueAfterDays || 0)));

      try {
        await prisma.projectTask.create({
          data: {
            projectId: template.projectId,
            title: template.title,
            description: template.description || null,
            status: "TODO",
            priority: toTaskPriority(template.priority || "MEDIUM"),
            dueDate,
            progress: 0,
            assignedToId: template.assignedToId || null,
            templateId: template.id,
            instanceDate: currentRunAt,
            sourceType: "RECURRING",
            createdById: template.createdById,
            updatedById: session.user.id,
          },
        });
        generated += 1;
      } catch {
        // Unique(templateId, instanceDate) prevents duplicate generation.
      }

      latestRunAt = currentRunAt;
      const nextRunAt = computeNextTemplateRun({
        intervalType: template.intervalType,
        intervalValue: template.intervalValue,
        weekdays: template.weekdays,
        dayOfMonth: template.dayOfMonth,
        startDate: template.startDate,
        fromDate: currentRunAt,
      });
      currentRunAt = nextRunAt;
      advanced += 1;

      if (template.endDate && currentRunAt.getTime() > template.endDate.getTime()) {
        break;
      }
    }

    const shouldDeactivate = Boolean(template.endDate && currentRunAt.getTime() > template.endDate.getTime());
    await prisma.taskTemplate.update({
      where: { id: template.id },
      data: {
        nextRunAt: currentRunAt,
        lastRunAt: latestRunAt || template.lastRunAt,
        isActive: shouldDeactivate ? false : template.isActive,
      },
    });

    touchedTemplateIds.push(template.id);
  }

  await logAudit({
    action: "TASK_RECURRENCE_RUN",
    entity: "TaskTemplate",
    entityId: touchedTemplateIds.join(",") || "none",
    userId: session.user.id,
    newValue: JSON.stringify({
      templatesEvaluated: templates.length,
      templatesTouched: touchedTemplateIds.length,
      generated,
      scheduleAdvanced: advanced,
      ranAt: now.toISOString(),
    }),
  });

  return NextResponse.json({
    success: true,
    data: {
      templatesEvaluated: templates.length,
      templatesTouched: touchedTemplateIds.length,
      generated,
      scheduleAdvanced: advanced,
      ranAt: now.toISOString(),
    },
  });
}
