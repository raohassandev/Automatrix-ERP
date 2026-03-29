import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { DATA_OPS_ACTIONS, DATA_OPS_ENTITY, DATA_OPS_JOB_TYPES, runDataOpsJobWithAudit, type DataOpsJobType } from "@/lib/data-ops";

const rerunSchema = z.object({
  dryRun: z.boolean().optional(),
});

function safeJson(input: string | null | undefined): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canManage =
    (await requirePermission(session.user.id, "accounting.manage")) ||
    (await requirePermission(session.user.id, "reports.export"));
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsedBody = rerunSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const queued = await prisma.auditLog.findFirst({
    where: {
      entity: DATA_OPS_ENTITY,
      entityId: id,
      action: DATA_OPS_ACTIONS.QUEUED,
    },
    orderBy: { createdAt: "asc" },
  });
  if (!queued) {
    return NextResponse.json({ success: false, error: "Base job payload not found" }, { status: 404 });
  }

  const payload = safeJson(queued.newValue);
  const jobTypeRaw = String(payload.jobType || "").trim();
  if (!DATA_OPS_JOB_TYPES.includes(jobTypeRaw as DataOpsJobType)) {
    return NextResponse.json({ success: false, error: "Unsupported or missing jobType in base job" }, { status: 400 });
  }
  const input = (payload.input && typeof payload.input === "object" ? payload.input : {}) as Record<string, unknown>;
  const dryRun = parsedBody.data.dryRun ?? (typeof payload.dryRun === "boolean" ? payload.dryRun : false);

  const run = await runDataOpsJobWithAudit({
    jobType: jobTypeRaw as DataOpsJobType,
    input,
    dryRun,
    userId: session.user.id,
    idempotencyKey: `rerun:${id}:${Date.now()}`,
  });

  if (run.status === "FAILED") {
    return NextResponse.json(
      { success: false, error: run.error || "Rerun failed", data: { originalJobId: id, rerunJobId: run.jobId } },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      originalJobId: id,
      rerunJobId: run.jobId,
      status: run.status,
      result: run.result,
    },
  });
}

