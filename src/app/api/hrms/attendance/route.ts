import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveHrmsScope } from "@/lib/hrms-access";
import { logAudit } from "@/lib/audit";

function startOfDay(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
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

  const where: Record<string, unknown> = {};
  if (scope.employeeId) {
    where.employeeId = scope.employeeId;
  } else if (employeeIdParam) {
    where.employeeId = employeeIdParam;
  }
  if (status) where.status = status;
  if (from || to) {
    where.date = {
      ...(from ? { gte: startOfDay(from) } : {}),
      ...(to ? { lte: startOfDay(to) } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.attendanceEntry.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.attendanceEntry.count({ where }),
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
  const status = String(body.status || "PRESENT").toUpperCase();
  const dateRaw = String(body.date || "").trim();
  const notes = body.notes ? String(body.notes).trim() : null;
  if (!dateRaw) {
    return NextResponse.json({ success: false, error: "Date is required." }, { status: 400 });
  }

  const employeeId = scope.canManage
    ? String(body.employeeId || "").trim()
    : (scope.employeeId || "");
  if (!employeeId) {
    return NextResponse.json({ success: false, error: "Employee is required." }, { status: 400 });
  }

  const date = startOfDay(dateRaw);
  const checkIn = body.checkIn ? new Date(body.checkIn) : null;
  const checkOut = body.checkOut ? new Date(body.checkOut) : null;
  if (checkIn && Number.isNaN(checkIn.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid check-in timestamp." }, { status: 400 });
  }
  if (checkOut && Number.isNaN(checkOut.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid check-out timestamp." }, { status: 400 });
  }
  if (checkIn && checkOut && checkOut < checkIn) {
    return NextResponse.json({ success: false, error: "Check-out cannot be earlier than check-in." }, { status: 400 });
  }

  const existing = await prisma.attendanceEntry.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: { id: true },
  });

  const row = existing
    ? await prisma.attendanceEntry.update({
        where: { id: existing.id },
        data: {
          status,
          checkIn,
          checkOut,
          notes,
          source: scope.canManage ? "MANUAL" : "SELF",
          createdById: session.user.id,
        },
      })
    : await prisma.attendanceEntry.create({
        data: {
          employeeId,
          date,
          status,
          checkIn,
          checkOut,
          notes,
          source: scope.canManage ? "MANUAL" : "SELF",
          createdById: session.user.id,
        },
      });

  await logAudit({
    action: existing ? "UPDATE_ATTENDANCE" : "CREATE_ATTENDANCE",
    entity: "AttendanceEntry",
    entityId: row.id,
    newValue: JSON.stringify({
      employeeId,
      date: date.toISOString(),
      status,
      checkIn: checkIn?.toISOString() || null,
      checkOut: checkOut?.toISOString() || null,
    }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: row });
}
