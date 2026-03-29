import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "employees.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "").trim().toUpperCase();
  const data = await prisma.employee.findMany({
    where: status ? { status } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "employees.view_all");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Sanitize string inputs after validation
  const sanitizedData = {
    ...parsed.data,
    email: sanitizeString(parsed.data.email),
    name: sanitizeString(parsed.data.name),
    phone: parsed.data.phone ? sanitizeString(parsed.data.phone) : undefined,
    cnic: parsed.data.cnic ? sanitizeString(parsed.data.cnic) : undefined,
    address: parsed.data.address ? sanitizeString(parsed.data.address) : undefined,
    education: parsed.data.education ? sanitizeString(parsed.data.education) : undefined,
    experience: parsed.data.experience ? sanitizeString(parsed.data.experience) : undefined,
    department: parsed.data.department ? sanitizeString(parsed.data.department) : undefined,
    designation: parsed.data.designation ? sanitizeString(parsed.data.designation) : undefined,
    reportingOfficerId: parsed.data.reportingOfficerId ? sanitizeString(parsed.data.reportingOfficerId) : undefined,
    joinDate: parsed.data.joinDate,
    role: sanitizeString(parsed.data.role),
  };

  const initialWalletBalance = body.initialWalletBalance || 0;
  if (sanitizedData.reportingOfficerId) {
    const officer = await prisma.employee.findUnique({
      where: { id: sanitizedData.reportingOfficerId },
      select: { id: true },
    });
    if (!officer) {
      return NextResponse.json({ success: false, error: "Reporting officer not found" }, { status: 400 });
    }
  }

  // Create employee and initial wallet entry in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        email: sanitizedData.email,
        name: sanitizedData.name,
        phone: sanitizedData.phone,
        cnic: sanitizedData.cnic,
        address: sanitizedData.address,
        education: sanitizedData.education,
        experience: sanitizedData.experience,
        department: sanitizedData.department,
        designation: sanitizedData.designation,
        reportingOfficerId: sanitizedData.reportingOfficerId,
        joinDate: sanitizedData.joinDate ? new Date(sanitizedData.joinDate) : null,
        role: sanitizedData.role,
        walletBalance: new Prisma.Decimal(initialWalletBalance),
      },
    });

    // If initial wallet balance > 0, create a CREDIT wallet ledger entry
    if (initialWalletBalance > 0) {
      await tx.walletLedger.create({
        data: {
          employeeId: created.id,
          type: "CREDIT",
          amount: new Prisma.Decimal(initialWalletBalance),
          date: new Date(),
          reference: "Initial Balance",
          balance: new Prisma.Decimal(initialWalletBalance),
        },
      });
    }

    return created;
  });

  await logAudit({
    action: "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: result.id,
    newValue: JSON.stringify({ ...sanitizedData, initialWalletBalance }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: result });
}
