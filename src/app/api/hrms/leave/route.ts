import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveHrmsScope } from "@/lib/hrms-access";
import { logAudit } from "@/lib/audit";

function normalizeDate(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function leaveDays(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const scope = await resolveHrmsScope(session.user.id, session.user.email);
  if (!scope.canManage && !scope.employeeId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "").trim();
  const employeeIdParam = (searchParams.get("employeeId") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const take = Math.min(100, Math.max(1, Number(searchParams.get("take") || "25")));
  const skip = (page - 1) * take;

  const where: Prisma.LeaveRequestWhereInput = {};
  if (scope.employeeId) where.employeeId = scope.employeeId;
  else if (employeeIdParam) where.employeeId = employeeIdParam;
  if (status) where.status = status;
  if (from || to) {
    where.startDate = {
      ...(from ? { gte: normalizeDate(from) } : {}),
      ...(to ? { lte: normalizeDate(to) } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rows, page, total, totalPages: Math.max(1, Math.ceil(total / take)) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const scope = await resolveHrmsScope(session.user.id, session.user.email);
  if (!scope.canManage && !scope.employeeId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const leaveType = String(body.leaveType || "ANNUAL").toUpperCase();
  const startRaw = String(body.startDate || "").trim();
  const endRaw = String(body.endDate || "").trim();
  if (!startRaw || !endRaw) {
    return NextResponse.json({ success: false, error: "Start date and end date are required." }, { status: 400 });
  }
  const startDate = normalizeDate(startRaw);
  const endDate = normalizeDate(endRaw);
  if (endDate < startDate) {
    return NextResponse.json({ success: false, error: "End date cannot be earlier than start date." }, { status: 400 });
  }

  const employeeId = scope.canManage
    ? String(body.employeeId || "").trim()
    : (scope.employeeId || "");
  if (!employeeId) {
    return NextResponse.json({ success: false, error: "Employee is required." }, { status: 400 });
  }

  const totalDays = leaveDays(startDate, endDate);
  const row = await prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalDays: new Prisma.Decimal(totalDays),
      reason: body.reason ? String(body.reason).trim() : null,
      status: "PENDING",
      createdById: session.user.id,
    },
  });

  await logAudit({
    action: "CREATE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: row.id,
    newValue: JSON.stringify({ employeeId, leaveType, startDate, endDate, totalDays }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: row });
}
