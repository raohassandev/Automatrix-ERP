import { prisma } from "@/lib/prisma";
import { getControlRegistersSummary } from "@/lib/control-registers";
import { logAudit } from "@/lib/audit";

export const DATA_OPS_ENTITY = "DataOpsJob";
export const DATA_OPS_ACTIONS = {
  QUEUED: "DATA_OPS_JOB_QUEUED",
  STARTED: "DATA_OPS_JOB_STARTED",
  COMPLETED: "DATA_OPS_JOB_COMPLETED",
  FAILED: "DATA_OPS_JOB_FAILED",
} as const;

export const DATA_OPS_JOB_TYPES = [
  "PROJECT_FINANCIALS_RECON",
  "CONTROL_REGISTERS_SNAPSHOT",
  "EFFECTIVE_PERMISSIONS_SNAPSHOT",
  "EXPORT_CONTROL_REGISTERS_CSV",
] as const;

export type DataOpsJobType = (typeof DATA_OPS_JOB_TYPES)[number];
export type DataOpsJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

type AuditRow = {
  id: string;
  action: string;
  entityId: string;
  userId: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: Date;
};

export type DataOpsJobSummary = {
  id: string;
  jobType: DataOpsJobType | "UNKNOWN";
  status: DataOpsJobStatus;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  requestedById?: string;
  dryRun?: boolean;
  idempotencyKey?: string;
  artifact?: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    downloadPath?: string;
  };
  result?: unknown;
  error?: string;
};

function safeJson(input: string | null | undefined): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function summarizeDataOpsJobs(rows: AuditRow[]): DataOpsJobSummary[] {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const byJob = new Map<string, DataOpsJobSummary>();

  for (const row of sorted) {
    const payload = safeJson(row.newValue);
    const existing =
      byJob.get(row.entityId) ||
      ({
        id: row.entityId,
        jobType: "UNKNOWN",
        status: "QUEUED",
        queuedAt: row.createdAt.toISOString(),
      } as DataOpsJobSummary);

    const payloadType = String(payload.jobType || "").trim();
    if (payloadType && DATA_OPS_JOB_TYPES.includes(payloadType as DataOpsJobType)) {
      existing.jobType = payloadType as DataOpsJobType;
    }
    if (row.userId && !existing.requestedById) existing.requestedById = row.userId;
    if (typeof payload.dryRun === "boolean") existing.dryRun = payload.dryRun;
    if (typeof payload.idempotencyKey === "string" && payload.idempotencyKey.trim()) {
      existing.idempotencyKey = payload.idempotencyKey.trim();
    }

    if (row.action === DATA_OPS_ACTIONS.QUEUED) {
      existing.queuedAt = row.createdAt.toISOString();
    }
    if (row.action === DATA_OPS_ACTIONS.STARTED) {
      existing.status = "RUNNING";
      existing.startedAt = row.createdAt.toISOString();
    }
    if (row.action === DATA_OPS_ACTIONS.COMPLETED) {
      existing.status = "COMPLETED";
      existing.finishedAt = row.createdAt.toISOString();
      if (payload.result !== undefined) {
        existing.result = payload.result;
        const resultRecord = payload.result as Record<string, unknown>;
        const artifact = resultRecord.artifact as Record<string, unknown> | undefined;
        if (artifact && typeof artifact === "object") {
          const fileName = String(artifact.fileName || "").trim();
          const contentType = String(artifact.contentType || "").trim();
          const sizeBytes = Number(artifact.sizeBytes || 0);
          if (fileName && contentType && Number.isFinite(sizeBytes) && sizeBytes >= 0) {
            existing.artifact = {
              fileName,
              contentType,
              sizeBytes,
              downloadPath:
                typeof artifact.downloadPath === "string" && artifact.downloadPath.trim()
                  ? artifact.downloadPath
                  : undefined,
            };
          }
        }
      }
    }
    if (row.action === DATA_OPS_ACTIONS.FAILED) {
      existing.status = "FAILED";
      existing.finishedAt = row.createdAt.toISOString();
      existing.error = String(payload.error || row.reason || "Data ops job failed");
    }

    byJob.set(row.entityId, existing);
  }

  return Array.from(byJob.values()).sort((a, b) => {
    const ta = new Date(a.queuedAt).getTime();
    const tb = new Date(b.queuedAt).getTime();
    return tb - ta;
  });
}

export async function executeDataOpsJob(
  jobType: DataOpsJobType,
  input?: Record<string, unknown>,
  options?: { jobId?: string },
) {
  if (jobType === "PROJECT_FINANCIALS_RECON") {
    const projects = await prisma.project.findMany({
      select: {
        projectId: true,
        pendingRecovery: true,
        costToDate: true,
        grossMargin: true,
        marginPercent: true,
      },
      take: 2000,
    });
    const anomalies = projects.filter((p) => Number(p.pendingRecovery || 0) < -0.01).map((p) => p.projectId);
    return {
      scannedProjects: projects.length,
      pendingRecoveryNegativeCount: anomalies.length,
      sampleProjectIds: anomalies.slice(0, 20),
      input: input || {},
    };
  }

  if (jobType === "CONTROL_REGISTERS_SNAPSHOT") {
    const from = typeof input?.from === "string" ? input.from : undefined;
    const to = typeof input?.to === "string" ? input.to : undefined;
    const summary = await getControlRegistersSummary({ from, to });
    return {
      from: from || null,
      to: to || null,
      payrollNetPay: summary.payroll.totalNetPay,
      procurementOutstanding: summary.procurement.outstanding,
      taskApprovalOverdue: summary.taskApprovals.overdue,
      taskApprovalItems: summary.taskApprovals.items,
    };
  }

  if (jobType === "EFFECTIVE_PERMISSIONS_SNAPSHOT") {
    const [usersTotal, activeRoleUsers, missingRoleUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { roleId: { not: null } } }),
      prisma.user.count({ where: { roleId: null } }),
    ]);
    return {
      usersTotal,
      activeRoleUsers,
      missingRoleUsers,
      generatedAt: new Date().toISOString(),
    };
  }

  if (jobType === "EXPORT_CONTROL_REGISTERS_CSV") {
    const from = typeof input?.from === "string" ? input.from : undefined;
    const to = typeof input?.to === "string" ? input.to : undefined;
    const summary = await getControlRegistersSummary({ from, to });
    const rows = [
      ["metric", "value"],
      ["generatedAt", summary.generatedAt],
      ["payroll.count", String(summary.payroll.count)],
      ["payroll.totalNetPay", String(summary.payroll.totalNetPay)],
      ["payroll.totalOverdue", String(summary.payroll.totalOverdue)],
      ["procurement.rows", String(summary.procurement.rows)],
      ["procurement.outstanding", String(summary.procurement.outstanding)],
      ["procurement.blocked", String(summary.procurement.blocked)],
      ["taskApprovals.items", String(summary.taskApprovals.items)],
      ["taskApprovals.overdue", String(summary.taskApprovals.overdue)],
    ];
    const csv = rows.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const contentBase64 = Buffer.from(csv, "utf8").toString("base64");
    const fileName = `control-registers-${new Date().toISOString().slice(0, 10)}.csv`;
    const jobId = options?.jobId || "unknown";
    return {
      from: from || null,
      to: to || null,
      artifact: {
        fileName,
        contentType: "text/csv; charset=utf-8",
        sizeBytes: Buffer.byteLength(csv, "utf8"),
        encoding: "base64",
        contentBase64,
        downloadPath: `/api/data-ops/jobs/${jobId}/artifact`,
      },
      preview: {
        payrollCount: summary.payroll.count,
        procurementRows: summary.procurement.rows,
      },
    };
  }

  throw new Error(`Unsupported data ops job type: ${jobType}`);
}

function createJobId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function findIdempotentJob(args: { jobType: DataOpsJobType; idempotencyKey: string; windowMinutes: number }) {
  const since = new Date(Date.now() - Math.max(1, args.windowMinutes) * 60_000);
  const queueRows = await prisma.auditLog.findMany({
    where: {
      entity: DATA_OPS_ENTITY,
      action: DATA_OPS_ACTIONS.QUEUED,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 4000,
  });

  for (const row of queueRows) {
    const payload = safeJson(row.newValue);
    const payloadType = String(payload.jobType || "").trim();
    const payloadKey = String(payload.idempotencyKey || "").trim();
    if (payloadType !== args.jobType || payloadKey !== args.idempotencyKey) continue;

    const events = await prisma.auditLog.findMany({
      where: { entity: DATA_OPS_ENTITY, entityId: row.entityId },
      orderBy: { createdAt: "asc" },
    });
    if (events.length === 0) continue;
    const summary = summarizeDataOpsJobs(events).find((job) => job.id === row.entityId);
    if (!summary) continue;
    return { jobId: row.entityId, summary };
  }
  return null;
}

export async function runDataOpsJobWithAudit(args: {
  jobType: DataOpsJobType;
  input?: Record<string, unknown>;
  dryRun: boolean;
  userId?: string | null;
  idempotencyKey?: string | null;
  idempotencyWindowMinutes?: number;
}) {
  const idempotencyKey = String(args.idempotencyKey || "").trim();
  if (idempotencyKey) {
    const existing = await findIdempotentJob({
      jobType: args.jobType,
      idempotencyKey,
      windowMinutes: args.idempotencyWindowMinutes || 24 * 60,
    });
    if (existing) {
      return {
        reused: true,
        jobId: existing.jobId,
        status: existing.summary.status,
        result: existing.summary.result,
        error: existing.summary.error,
      };
    }
  }

  const jobId = createJobId();
  const input = args.input || {};

  await logAudit({
    action: DATA_OPS_ACTIONS.QUEUED,
    entity: DATA_OPS_ENTITY,
    entityId: jobId,
    userId: args.userId || null,
    newValue: JSON.stringify({
      jobType: args.jobType,
      input,
      dryRun: args.dryRun,
      idempotencyKey: idempotencyKey || null,
    }),
  });

  try {
    await logAudit({
      action: DATA_OPS_ACTIONS.STARTED,
      entity: DATA_OPS_ENTITY,
      entityId: jobId,
      userId: args.userId || null,
      newValue: JSON.stringify({
        jobType: args.jobType,
        dryRun: args.dryRun,
        idempotencyKey: idempotencyKey || null,
      }),
    });

    const result = args.dryRun
      ? { dryRun: true, jobType: args.jobType, input }
      : await executeDataOpsJob(args.jobType, input, { jobId });

    await logAudit({
      action: DATA_OPS_ACTIONS.COMPLETED,
      entity: DATA_OPS_ENTITY,
      entityId: jobId,
      userId: args.userId || null,
      newValue: JSON.stringify({
        jobType: args.jobType,
        dryRun: args.dryRun,
        idempotencyKey: idempotencyKey || null,
        result,
      }),
    });

    return { reused: false, jobId, status: "COMPLETED" as const, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data ops job failed";
    await logAudit({
      action: DATA_OPS_ACTIONS.FAILED,
      entity: DATA_OPS_ENTITY,
      entityId: jobId,
      userId: args.userId || null,
      reason: message,
      newValue: JSON.stringify({
        jobType: args.jobType,
        dryRun: args.dryRun,
        idempotencyKey: idempotencyKey || null,
        error: message,
      }),
    });
    return { reused: false, jobId, status: "FAILED" as const, error: message };
  }
}
