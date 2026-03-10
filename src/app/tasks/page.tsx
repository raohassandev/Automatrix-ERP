import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { TasksWorkspace } from "@/components/TasksWorkspace";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [canViewAll, canViewAssigned, canManage, canUpdateAssigned, canReview, canManageTemplates] =
    await Promise.all([
      requirePermission(session.user.id, "tasks.view_all"),
      requirePermission(session.user.id, "tasks.view_assigned"),
      requirePermission(session.user.id, "tasks.manage"),
      requirePermission(session.user.id, "tasks.update_assigned"),
      requirePermission(session.user.id, "tasks.review"),
      requirePermission(session.user.id, "tasks.templates_manage"),
    ]);

  if (!canViewAll && !canViewAssigned && !canManage && !canUpdateAssigned && !canReview) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to tasks.</p>
      </div>
    );
  }

  const assignedProjects = await prisma.projectAssignment.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });
  const assignedProjectIds = assignedProjects.map((row) => row.projectId);

  const taskWhere: Record<string, unknown> = {};
  if (!canViewAll) {
    taskWhere.OR = [
      { assignedToId: session.user.id },
      { createdById: session.user.id },
      ...(assignedProjectIds.length > 0 ? [{ projectId: { in: assignedProjectIds } }] : []),
    ];
  }

  const templateWhere: Record<string, unknown> = {};
  if (!canManageTemplates && !canViewAll) {
    templateWhere.OR = [{ assignedToId: session.user.id }, { createdById: session.user.id }];
  }

  const [tasks, templates, projects, users] = await Promise.all([
    prisma.projectTask.findMany({
      where: taskWhere,
      include: {
        project: { select: { id: true, projectId: true, name: true, status: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        template: { select: { id: true, title: true, intervalType: true, intervalValue: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      take: 500,
    }),
    prisma.taskTemplate.findMany({
      where: templateWhere,
      include: {
        project: { select: { id: true, projectId: true, name: true, status: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ isActive: "desc" }, { nextRunAt: "asc" }],
      take: 300,
    }),
    prisma.project.findMany({
      where: canViewAll
        ? {}
        : assignedProjectIds.length > 0
          ? { id: { in: assignedProjectIds } }
          : { id: "__none__" },
      select: { id: true, projectId: true, name: true, status: true },
      orderBy: { projectId: "asc" },
      take: 500,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" },
      take: 500,
    }),
  ]);

  return (
    <TasksWorkspace
      currentUserId={session.user.id}
      canViewAll={canViewAll}
      canManage={canManage}
      canUpdateAssigned={canUpdateAssigned}
      canReview={canReview}
      canManageTemplates={canManageTemplates}
      initialTasks={tasks.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description || "",
        status: row.status,
        priority: row.priority,
        dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
        progress: row.progress,
        sourceType: row.sourceType,
        projectId: row.projectId,
        projectRef: row.project?.projectId || "",
        projectName: row.project?.name || "",
        assignedToId: row.assignedToId || "",
        assignedToName: row.assignedTo?.name || row.assignedTo?.email || "",
        assignedToEmail: row.assignedTo?.email || "",
        reviewedByName: row.reviewedBy?.name || row.reviewedBy?.email || "",
        reviewScore: row.reviewScore,
        reviewNotes: row.reviewNotes || "",
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : "",
        templateId: row.templateId || "",
        templateTitle: row.template?.title || "",
        instanceDate: row.instanceDate ? row.instanceDate.toISOString().slice(0, 10) : "",
        createdById: row.createdById,
        createdByName: row.createdBy?.name || row.createdBy?.email || "",
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))}
      initialTemplates={templates.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description || "",
        priority: row.priority,
        intervalType: row.intervalType,
        intervalValue: row.intervalValue,
        weekdays: row.weekdays || "",
        dayOfMonth: row.dayOfMonth || null,
        dueAfterDays: row.dueAfterDays,
        startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : "",
        nextRunAt: row.nextRunAt.toISOString(),
        isActive: row.isActive,
        projectId: row.projectId,
        projectRef: row.project?.projectId || "",
        projectName: row.project?.name || "",
        assignedToId: row.assignedToId || "",
        assignedToName: row.assignedTo?.name || row.assignedTo?.email || "",
        assignedToEmail: row.assignedTo?.email || "",
      }))}
      projects={projects}
      users={users.map((u) => ({ id: u.id, name: u.name || "", email: u.email || "" }))}
    />
  );
}
