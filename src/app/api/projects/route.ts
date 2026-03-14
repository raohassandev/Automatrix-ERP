import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { recalculateProjectFinancials } from "@/lib/projects";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "projects.view_all");
  const canViewAssigned = await requirePermission(session.user.id, "projects.view_assigned");
  const canViewFinancials =
    (await requirePermission(session.user.id, "projects.view_financials")) ||
    (await requirePermission(session.user.id, "dashboard.view_all_metrics"));
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
    select: {
      id: true,
      projectId: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      clientId: true,
      client: { select: { id: true, name: true } },
      contractValue: canViewFinancials,
      invoicedAmount: canViewFinancials,
      receivedAmount: canViewFinancials,
      pendingRecovery: canViewFinancials,
      costToDate: canViewFinancials,
      grossMargin: canViewFinancials,
      marginPercent: canViewFinancials,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  try {
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
        // Keep commercial baseline truthful from day one: pending starts at contract value.
        pendingRecovery: new Prisma.Decimal(sanitizedData.contractValue),
        costToDate: new Prisma.Decimal(0),
        grossMargin: new Prisma.Decimal(0),
        marginPercent: new Prisma.Decimal(0),
      },
    });

    // Enforce canonical snapshot after create so list/detail/report surfaces stay in sync.
    await recalculateProjectFinancials(created.id);

    await logAudit({
      action: "CREATE_PROJECT",
      entity: "Project",
      entityId: created.id,
      newValue: JSON.stringify(sanitizedData),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Project ID already exists. Use a unique Project ID." },
          { status: 409 },
        );
      }
    }
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
