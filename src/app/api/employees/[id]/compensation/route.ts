import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import { canManageEmployeeCompensation } from "@/lib/employee-compensation-access";

const compensationPatchSchema = z.object({
  baseSalary: z.preprocess(
    (value) => {
      if (typeof value === "string") return Number(value);
      return value;
    },
    z.number().finite().nonnegative(),
  ),
  currency: z.string().trim().min(1).max(8).optional(),
  effectiveFrom: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await prisma.employee.findUnique({
    where: { email: session.user.email || "__none__" },
    select: { id: true },
  });
  const canManage = await canManageEmployeeCompensation(session.user.id);
  const { id } = await context.params;
  const canViewOwn = canView?.id === id;

  if (!canManage && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.employeeCompensation.findUnique({
    where: { employeeId: id },
  });
  return NextResponse.json({ success: true, data: row });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEmployeeCompensation(session.user.id);
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!employee) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = compensationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let effectiveFrom: Date | null = null;
  if (parsed.data.effectiveFrom) {
    const date = new Date(parsed.data.effectiveFrom);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid effective date" }, { status: 400 });
    }
    effectiveFrom = date;
  }

  const updated = await prisma.employeeCompensation.upsert({
    where: { employeeId: id },
    create: {
      employeeId: id,
      baseSalary: new Prisma.Decimal(parsed.data.baseSalary),
      currency: sanitizeString(parsed.data.currency || "PKR"),
      effectiveFrom,
      notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : null,
    },
    update: {
      baseSalary: new Prisma.Decimal(parsed.data.baseSalary),
      currency: sanitizeString(parsed.data.currency || "PKR"),
      effectiveFrom,
      notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : null,
    },
  });

  await logAudit({
    action: "UPSERT_EMPLOYEE_COMPENSATION",
    entity: "EmployeeCompensation",
    entityId: updated.id,
    userId: session.user.id,
    newValue: JSON.stringify({
      employeeId: id,
      employeeName: employee.name,
      baseSalary: parsed.data.baseSalary,
      currency: parsed.data.currency || "PKR",
      effectiveFrom: parsed.data.effectiveFrom || null,
      notes: parsed.data.notes || null,
    }),
  });

  return NextResponse.json({ success: true, data: updated });
}
