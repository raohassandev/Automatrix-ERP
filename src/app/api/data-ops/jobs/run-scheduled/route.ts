import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { runDataOpsJobWithAudit, type DataOpsJobType } from "@/lib/data-ops";

type ScheduledRun = {
  jobType: DataOpsJobType;
  input?: Record<string, unknown>;
};

const SCHEDULED_JOBS: ScheduledRun[] = [
  { jobType: "PROJECT_FINANCIALS_RECON" },
  { jobType: "CONTROL_REGISTERS_SNAPSHOT" },
  { jobType: "EFFECTIVE_PERMISSIONS_SNAPSHOT" },
  { jobType: "EXPORT_CONTROL_REGISTERS_CSV" },
];

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const cronToken = process.env.DATA_OPS_CRON_TOKEN || "";
  const headerToken = req.headers.get("x-data-ops-cron-token") || "";
  const hasValidCronToken = Boolean(cronToken) && headerToken === cronToken;

  let userId: string | null = null;
  if (!hasValidCronToken) {
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
    userId = session.user.id;
  }

  const results: Array<Record<string, unknown>> = [];
  const dayKey = utcDayKey();
  for (const job of SCHEDULED_JOBS) {
    const idempotencyKey = `scheduled:${dayKey}:${job.jobType}`;
    const run = await runDataOpsJobWithAudit({
      jobType: job.jobType,
      input: job.input,
      dryRun: false,
      userId,
      idempotencyKey,
      idempotencyWindowMinutes: 24 * 60,
    });
    results.push({
      jobType: job.jobType,
      jobId: run.jobId,
      status: run.status,
      reused: run.reused,
      error: run.error || null,
    });
  }

  const failed = results.filter((row) => row.status === "FAILED");
  if (failed.length > 0) {
    return NextResponse.json(
      { success: false, error: `${failed.length} scheduled jobs failed`, data: results },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: results });
}

