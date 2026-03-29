import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  DATA_OPS_ACTIONS,
  DATA_OPS_ENTITY,
  DATA_OPS_JOB_TYPES,
  runDataOpsJobWithAudit,
  summarizeDataOpsJobs,
  type DataOpsJobType,
} from "@/lib/data-ops";

const runJobSchema = z.object({
  jobType: z.enum(DATA_OPS_JOB_TYPES),
  input: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(4).max(128).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(500, Math.max(10, Number(searchParams.get("limit") || 100)));
  const status = String(searchParams.get("status") || "").trim().toUpperCase();
  const jobType = String(searchParams.get("jobType") || "").trim().toUpperCase();
  const search = String(searchParams.get("search") || "").trim().toLowerCase();

  const rows = await prisma.auditLog.findMany({
    where: {
      entity: DATA_OPS_ENTITY,
      action: {
        in: [
          DATA_OPS_ACTIONS.QUEUED,
          DATA_OPS_ACTIONS.STARTED,
          DATA_OPS_ACTIONS.COMPLETED,
          DATA_OPS_ACTIONS.FAILED,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 4000,
  });

  let jobs = summarizeDataOpsJobs(rows);
  if (status && ["QUEUED", "RUNNING", "COMPLETED", "FAILED"].includes(status)) {
    jobs = jobs.filter((job) => job.status === status);
  }
  if (jobType) {
    jobs = jobs.filter((job) => String(job.jobType || "").toUpperCase() === jobType);
  }
  if (search) {
    jobs = jobs.filter((job) => {
      return (
        job.id.toLowerCase().includes(search) ||
        String(job.jobType || "").toLowerCase().includes(search) ||
        String(job.idempotencyKey || "").toLowerCase().includes(search)
      );
    });
  }
  const start = (page - 1) * limit;
  const data = jobs.slice(start, start + limit);

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total: jobs.length,
      totalPages: Math.max(1, Math.ceil(jobs.length / limit)),
    },
  });
}

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => null);
  const parsed = runJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const jobType = parsed.data.jobType as DataOpsJobType;
  const input = parsed.data.input || {};
  const dryRun = parsed.data.dryRun !== false;
  const headerKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  const idempotencyKey = parsed.data.idempotencyKey || (headerKey ? headerKey.trim() : undefined);

  const run = await runDataOpsJobWithAudit({
    jobType,
    input,
    dryRun,
    userId: session.user.id,
    idempotencyKey,
  });

  if (run.status === "FAILED") {
    return NextResponse.json(
      { success: false, error: run.error || "Data ops job failed", data: { jobId: run.jobId, jobType, dryRun } },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      jobId: run.jobId,
      jobType,
      dryRun,
      status: run.status,
      reused: run.reused,
      result: run.result,
    },
  });
}
