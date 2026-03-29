import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  DATA_OPS_ACTIONS,
  DATA_OPS_ENTITY,
  summarizeDataOpsJobs,
} from "@/lib/data-ops";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const rows = await prisma.auditLog.findMany({
    where: {
      entity: DATA_OPS_ENTITY,
      entityId: id,
      action: {
        in: [
          DATA_OPS_ACTIONS.QUEUED,
          DATA_OPS_ACTIONS.STARTED,
          DATA_OPS_ACTIONS.COMPLETED,
          DATA_OPS_ACTIONS.FAILED,
        ],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
  }

  const summary = summarizeDataOpsJobs(rows).find((job) => job.id === id) || null;
  return NextResponse.json({
    success: true,
    data: {
      summary,
      events: rows.map((row) => ({
        id: row.id,
        action: row.action,
        reason: row.reason,
        payload: row.newValue,
        userId: row.userId,
        createdAt: row.createdAt,
      })),
    },
  });
}

