import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "projects.view_all");
  const canViewAssigned = await requirePermission(session.user.id, "projects.view_assigned");
  if (!canViewAll && !canViewAssigned) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let where: Record<string, unknown> | undefined = undefined;
  if (!canViewAll && canViewAssigned) {
    const assignments = await prisma.projectAssignment.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    const projectIds = assignments.map((assignment) => assignment.projectId);
    if (projectIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }
    where = { id: { in: projectIds } };
  }

  const data = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: true },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "projects.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Sanitize string inputs after validation
  const sanitizedData = {
    ...parsed.data,
    projectId: sanitizeString(parsed.data.projectId),
    name: sanitizeString(parsed.data.name),
    clientId: sanitizeString(parsed.data.clientId),
    status: parsed.data.status ? sanitizeString(parsed.data.status) : "ACTIVE",
  };

  const client = await prisma.client.findUnique({ where: { id: sanitizedData.clientId } });
  if (!client) {
    return NextResponse.json({ success: false, error: "Client not found" }, { status: 400 });
  }

  const created = await prisma.project.create({
    data: {
      projectId: sanitizedData.projectId,
      name: sanitizedData.name,
      clientId: sanitizedData.clientId,
      startDate: new Date(sanitizedData.startDate),
      endDate: sanitizedData.endDate ? new Date(sanitizedData.endDate) : null,
      status: sanitizedData.status,
      contractValue: new Prisma.Decimal(sanitizedData.contractValue),
      invoicedAmount: new Prisma.Decimal(0),
      receivedAmount: new Prisma.Decimal(0),
      pendingRecovery: new Prisma.Decimal(0),
      costToDate: new Prisma.Decimal(0),
      grossMargin: new Prisma.Decimal(0),
      marginPercent: new Prisma.Decimal(0),
    },
  });

  await logAudit({
    action: "CREATE_PROJECT",
    entity: "Project",
    entityId: created.id,
    newValue: JSON.stringify(sanitizedData),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
