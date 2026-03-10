import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { buildPayrollEntriesByPolicy } from "@/lib/payroll-policy";

function getPreviousMonthRange(now: Date) {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function isAutomationAuthorized(req: Request) {
  const expected = String(process.env.PAYROLL_AUTOMATION_TOKEN || "").trim();
  if (!expected) return false;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const direct = String(req.headers.get("x-payroll-automation-token") || "").trim();
  return bearer === expected || direct === expected;
}

export async function POST(req: Request) {
  const session = await auth();
  const hasUser = Boolean(session?.user?.id);
  const tokenAuthorized = isAutomationAuthorized(req);

  let canEditPayroll = false;
  if (hasUser && session?.user?.id) {
    canEditPayroll = await requirePermission(session.user.id, "payroll.edit");
  }

  if (!tokenAuthorized && !canEditPayroll) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const force = Boolean((body as { force?: boolean }).force);
  const runDateRaw = String((body as { runDate?: string }).runDate || "").trim();
  const runDate = runDateRaw ? new Date(runDateRaw) : new Date();
  if (Number.isNaN(runDate.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid runDate." }, { status: 400 });
  }

  const configuredDayRaw = Number(process.env.PAYROLL_AUTO_DRAFT_DAY || "1");
  const configuredDay = Number.isFinite(configuredDayRaw)
    ? Math.min(28, Math.max(1, Math.floor(configuredDayRaw)))
    : 1;

  if (!force && runDate.getDate() !== configuredDay) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `Payroll auto-draft runs only on day ${configuredDay}.`,
      runDate: runDate.toISOString().slice(0, 10),
    });
  }

  const { start, end } = getPreviousMonthRange(runDate);
  const existing = await prisma.payrollRun.findFirst({
    where: { periodStart: start, periodEnd: end },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "Payroll run for the previous month already exists.",
      data: existing,
    });
  }

  const entries = await buildPayrollEntriesByPolicy(prisma, start, end);
  if (entries.length === 0) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "No active employee entries available for payroll auto-draft.",
    });
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      return tx.payrollRun.create({
        data: {
          periodStart: start,
          periodEnd: end,
          status: "DRAFT",
          notes: `Auto-created on ${new Date().toISOString()} for monthly payroll review.`,
          entries: {
            create: entries.map((entry) => {
              const incentiveTotal = entry.incentiveTotal ?? 0;
              const deductions = entry.deductions ?? 0;
              const netPay = entry.baseSalary + incentiveTotal - deductions;
              return {
                employeeId: entry.employeeId,
                baseSalary: new Prisma.Decimal(entry.baseSalary),
                incentiveTotal: new Prisma.Decimal(incentiveTotal),
                deductions: new Prisma.Decimal(deductions),
                deductionReason: entry.deductionReason || null,
                netPay: new Prisma.Decimal(netPay),
              };
            }),
          },
        },
        include: { entries: true },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to auto-create payroll run.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  await logAudit({
    action: "AUTO_CREATE_PAYROLL_RUN",
    entity: "PayrollRun",
    entityId: created.id,
    userId: session?.user?.id || null,
    newValue: JSON.stringify({
      trigger: tokenAuthorized ? "TOKEN" : "MANUAL",
      force,
      configuredDay,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      entries: created.entries.length,
    }),
  });

  return NextResponse.json({
    success: true,
    data: {
      id: created.id,
      status: created.status,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      entries: created.entries.length,
    },
  });
}

