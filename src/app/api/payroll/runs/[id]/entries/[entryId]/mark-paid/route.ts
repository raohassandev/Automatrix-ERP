import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { settlePayrollEntry } from "@/lib/payroll-settlement";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; entryId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canApprove = await requirePermission(session.user.id, "payroll.approve");
  if (!canApprove) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: payrollRunId, entryId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const paymentMode = String((body as { paymentMode?: string }).paymentMode || "BANK_TRANSFER").trim();
  const companyAccountId = String((body as { companyAccountId?: string }).companyAccountId || "").trim();
  const paymentReference = String((body as { paymentReference?: string }).paymentReference || "").trim();

  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    select: { id: true, status: true },
  });
  if (!run) {
    return NextResponse.json({ success: false, error: "Payroll run not found." }, { status: 404 });
  }
  if (!["APPROVED", "POSTED"].includes(String(run.status || "").toUpperCase())) {
    return NextResponse.json(
      { success: false, error: "Approve payroll run before marking individual entries paid." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return settlePayrollEntry({
        tx,
        payrollRunId,
        payrollEntryId: entryId,
        postedById: session.user.id,
        paymentMode,
        companyAccountId: companyAccountId || null,
        paymentReference: paymentReference || null,
      });
    });

    await logAudit({
      action: "MARK_PAYROLL_ENTRY_PAID",
      entity: "PayrollEntry",
      entityId: entryId,
      userId: session.user.id,
      newValue: JSON.stringify({ payrollRunId, runStatus: result.runStatus, paymentMode, companyAccountId }),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark payroll entry as paid.";
    const status =
      /not found/i.test(message) ? 404 :
      /already paid/i.test(message) ? 400 :
      400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
