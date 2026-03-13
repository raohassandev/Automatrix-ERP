import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { toTaskPriority, toTaskStatus } from "@/lib/tasks";

const createTaskSchema = z.object({
  projectId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.string().trim().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  assignedToId: z.string().trim().min(1).optional(),
});

function toDateOrNull(raw: string | undefined) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [canViewAllTasks, canViewAssignedTasks, canViewAllProjects] = await Promise.all([
    requirePermission(session.user.id, "tasks.view_all"),
    requirePermission(session.user.id, "tasks.view_assigned"),
    requirePermission(session.user.id, "projects.view_all"),
  ]);

  if (!canViewAllTasks && !canViewAssignedTasks && !canViewAllProjects) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "my").trim().toLowerCase();
  const status = (url.searchParams.get("status") || "").trim().toUpperCase();
  const priority = (url.searchParams.get("priority") || "").trim().toUpperCase();
  const projectId = (url.searchParams.get("projectId") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();

  const assignedProjects = await prisma.projectAssignment.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });
  const assignedProjectIds = assignedProjects.map((row) => row.projectId);

  const canSeeAllRows = canViewAllTasks || canViewAllProjects;
  const andConditions: Array<Record<string, unknown>> = [];

  if (!canSeeAllRows || scope === "my") {
    andConditions.push({
      OR: [
        { assignedToId: session.user.id },
        { createdById: session.user.id },
        ...(assignedProjectIds.length > 0 ? [{ projectId: { in: assignedProjectIds } }] : []),
      ],
    });
  }

  if (scope === "created") {
    andConditions.push({ createdById: session.user.id });
  }

  if (status && ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"].includes(status)) {
    andConditions.push({ status });
  }
  if (priority && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) {
    andConditions.push({ priority });
  }
  if (projectId) {
    andConditions.push({ projectId });
  }
  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
        { project: { projectId: { contains: q, mode: "insensitive" as const } } },
        { project: { name: { contains: q, mode: "insensitive" as const } } },
        { assignedTo: { name: { contains: q, mode: "insensitive" as const } } },
        { assignedTo: { email: { contains: q, mode: "insensitive" as const } } },
      ],
    });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const rows = await prisma.projectTask.findMany({
    where,
    include: {
      project: { select: { id: true, projectId: true, name: true, status: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, title: true, intervalType: true, intervalValue: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [canManage, canAssign] = await Promise.all([
    (await requirePermission(session.user.id, "tasks.manage")) || (await requirePermission(session.user.id, "projects.edit")),
    requirePermission(session.user.id, "tasks.assign"),
  ]);
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true, projectId: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
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

  const dueDate = toDateOrNull(parsed.data.dueDate);
  if (parsed.data.dueDate && !dueDate) {
    return NextResponse.json({ success: false, error: "Invalid due date" }, { status: 400 });
  }

  const created = await prisma.projectTask.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: toTaskStatus(parsed.data.status || "TODO"),
      priority: toTaskPriority(parsed.data.priority || "MEDIUM"),
      dueDate,
      progress: Math.max(0, Math.min(100, Number(parsed.data.progress || 0))),
      assignedToId: parsed.data.assignedToId || null,
      createdById: session.user.id,
      updatedById: session.user.id,
      sourceType: "MANUAL",
    },
    include: {
      project: { select: { id: true, projectId: true, name: true, status: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    action: "TASK_CREATE",
    entity: "ProjectTask",
    entityId: created.id,
    userId: session.user.id,
    newValue: JSON.stringify({
      projectId: created.projectId,
      title: created.title,
      status: created.status,
      priority: created.priority,
      dueDate: created.dueDate?.toISOString() || null,
      assignedToId: created.assignedToId || null,
    }),
  });

  return NextResponse.json({ success: true, data: created });
}
