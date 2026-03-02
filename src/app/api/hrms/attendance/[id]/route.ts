import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveHrmsScope } from "@/lib/hrms-access";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const scope = await resolveHrmsScope(session.user.id, session.user.email);
  if (!scope.canManage && !scope.employeeId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const current = await prisma.attendanceEntry.findUnique({
    where: { id },
    select: { id: true, employeeId: true },
  });
  if (!current) {
    return NextResponse.json({ success: false, error: "Attendance entry not found." }, { status: 404 });
  }
  if (!scope.canManage && current.employeeId !== scope.employeeId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const status = body.status ? String(body.status).toUpperCase() : undefined;
  const notes = body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : undefined;
  const checkIn = body.checkIn !== undefined ? (body.checkIn ? new Date(body.checkIn) : null) : undefined;
  const checkOut = body.checkOut !== undefined ? (body.checkOut ? new Date(body.checkOut) : null) : undefined;
  if (checkIn && Number.isNaN(checkIn.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid check-in timestamp." }, { status: 400 });
  }
  if (checkOut && Number.isNaN(checkOut.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid check-out timestamp." }, { status: 400 });
  }
  if (checkIn && checkOut && checkOut < checkIn) {
    return NextResponse.json({ success: false, error: "Check-out cannot be earlier than check-in." }, { status: 400 });
  }

  const updated = await prisma.attendanceEntry.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(checkIn !== undefined ? { checkIn } : {}),
      ...(checkOut !== undefined ? { checkOut } : {}),
      source: scope.canManage ? "MANUAL" : "SELF",
      createdById: session.user.id,
    },
  });

  await logAudit({
    action: "UPDATE_ATTENDANCE",
    entity: "AttendanceEntry",
    entityId: id,
    newValue: JSON.stringify({ status, notes }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = await resolveHrmsScope(session.user.id, session.user.email);
  if (!scope.canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.attendanceEntry.delete({ where: { id } });
  await logAudit({
    action: "DELETE_ATTENDANCE",
    entity: "AttendanceEntry",
    entityId: id,
    userId: session.user.id,
  });
  return NextResponse.json({ success: true });
}
