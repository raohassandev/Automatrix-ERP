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

  const current = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true },
  });
  if (!current) {
    return NextResponse.json({ success: false, error: "Leave request not found." }, { status: 404 });
  }
  const ownRequest = scope.employeeId && current.employeeId === scope.employeeId;
  if (!scope.canManage && !ownRequest) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const action = body.action ? String(body.action).toUpperCase() : "";

  if (action === "APPROVE" || action === "REJECT") {
    if (!scope.canApprove && !scope.canManage) {
      return NextResponse.json({ success: false, error: "Only approvers can decide leave requests." }, { status: 403 });
    }
    if (current.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Only pending leave requests can be decided." }, { status: 400 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        decisionNote: body.decisionNote ? String(body.decisionNote).trim() : null,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });
    await logAudit({
      action: action === "APPROVE" ? "APPROVE_LEAVE_REQUEST" : "REJECT_LEAVE_REQUEST",
      entity: "LeaveRequest",
      entityId: id,
      newValue: JSON.stringify({ status: updated.status, decisionNote: updated.decisionNote }),
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  }

  if (action === "CANCEL") {
    if (!ownRequest && !scope.canManage) {
      return NextResponse.json({ success: false, error: "Only requester can cancel this request." }, { status: 403 });
    }
    if (!["PENDING", "APPROVED"].includes(current.status)) {
      return NextResponse.json({ success: false, error: "This leave request cannot be cancelled." }, { status: 400 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        decisionNote: body.decisionNote ? String(body.decisionNote).trim() : "Cancelled by requester",
      },
    });
    await logAudit({
      action: "CANCEL_LEAVE_REQUEST",
      entity: "LeaveRequest",
      entityId: id,
      newValue: JSON.stringify({ status: updated.status }),
      userId: session.user.id,
    });
    return NextResponse.json({ success: true, data: updated });
  }

  if (!scope.canManage && !ownRequest) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (current.status !== "PENDING") {
    return NextResponse.json({ success: false, error: "Only pending leave requests can be edited." }, { status: 400 });
  }

  const startDate = body.startDate ? normalizeDate(String(body.startDate)) : undefined;
  const endDate = body.endDate ? normalizeDate(String(body.endDate)) : undefined;
  if (startDate && endDate && endDate < startDate) {
    return NextResponse.json({ success: false, error: "End date cannot be earlier than start date." }, { status: 400 });
  }

  const nextStart = startDate || (await prisma.leaveRequest.findUnique({ where: { id }, select: { startDate: true } }))?.startDate;
  const nextEnd = endDate || (await prisma.leaveRequest.findUnique({ where: { id }, select: { endDate: true } }))?.endDate;
  const totalDays = nextStart && nextEnd ? leaveDays(nextStart, nextEnd) : undefined;

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      ...(body.leaveType ? { leaveType: String(body.leaveType).toUpperCase() } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(body.reason !== undefined ? { reason: body.reason ? String(body.reason).trim() : null } : {}),
      ...(totalDays !== undefined ? { totalDays: new Prisma.Decimal(totalDays) } : {}),
    },
  });
  await logAudit({
    action: "UPDATE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: id,
    newValue: JSON.stringify({ leaveType: updated.leaveType, startDate: updated.startDate, endDate: updated.endDate }),
    userId: session.user.id,
  });
  return NextResponse.json({ success: true, data: updated });
}
