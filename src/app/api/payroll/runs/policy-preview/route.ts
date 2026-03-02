import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { buildPayrollEntriesByPolicy } from "@/lib/payroll-policy";

function getPreviousMonthRange(now: Date) {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startRaw = (searchParams.get("periodStart") || "").trim();
  const endRaw = (searchParams.get("periodEnd") || "").trim();
  if (!startRaw || !endRaw) {
    return NextResponse.json(
      { success: false, error: "periodStart and periodEnd are required." },
      { status: 400 },
    );
  }
  const periodStart = new Date(startRaw);
  const periodEnd = new Date(endRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid period dates." }, { status: 400 });
  }

  const prev = getPreviousMonthRange(new Date());
  if (
    periodStart.toDateString() !== prev.start.toDateString() ||
    periodEnd.toDateString() !== prev.end.toDateString()
  ) {
    return NextResponse.json(
      { success: false, error: "Payroll policy preview is only for previous month." },
      { status: 400 },
    );
  }

  const entries = await buildPayrollEntriesByPolicy(prisma, periodStart, periodEnd);
  return NextResponse.json({ success: true, data: entries });
}
