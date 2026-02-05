import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incentiveSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

async function applyIncentiveApproval(
  tx: Prisma.TransactionClient,
  incentive: {
    id: string;
    employeeId: string;
    amount: Prisma.Decimal;
    projectRef?: string | null;
  },
  approvedById: string
) {
  const employee = await tx.employee.findUnique({ where: { id: incentive.employeeId } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  const projectRef = incentive.projectRef || null;
  const expense = await tx.expense.create({
    data: {
      date: new Date(),
      description: `Incentive for ${projectRef || "project"}`,
      category: "Incentive",
      amount: new Prisma.Decimal(incentive.amount),
      paymentMode: "Wallet Credit",
      paymentSource: "COMPANY_ACCOUNT",
      expenseType: "COMPANY",
      project: projectRef || undefined,
      status: "APPROVED",
      approvalLevel: "INCENTIVE",
      submittedById: approvedById,
      approvedById,
      approvedAmount: new Prisma.Decimal(incentive.amount),
    },
  });

  const newBalance = Number(employee.walletBalance) + Number(incentive.amount);
  const ledger = await tx.walletLedger.create({
    data: {
      date: new Date(),
      employeeId: employee.id,
      type: "CREDIT",
      amount: new Prisma.Decimal(incentive.amount),
      reference: `INCENTIVE:${incentive.id}`,
      balance: new Prisma.Decimal(newBalance),
    },
  });
  await tx.employee.update({
    where: { id: employee.id },
    data: { walletBalance: new Prisma.Decimal(newBalance) },
  });

  return { expenseId: expense.id, walletLedgerId: ledger.id };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "incentives.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (!canViewAll) {
    if (!session.user.email) {
      return NextResponse.json({ success: false, error: "User email missing" }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ success: true, data: [] });
    }
    where.employeeId = employee.id;
  }

  const data = await prisma.incentiveEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { employee: true },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = incentiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const status = parsed.data.status ? sanitizeString(parsed.data.status) : "PENDING";
  const canApprove = await requirePermission(session.user.id, "incentives.approve");

  const projectRef = sanitizeString(parsed.data.projectRef);
  const resolvedProject = await resolveProjectId(projectRef);
  if (!resolvedProject) {
    return NextResponse.json({ success: false, error: "Invalid project reference" }, { status: 400 });
  }
  const project = await prisma.project.findFirst({
    where: { projectId: resolvedProject },
    select: { status: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  const statusValue = (project.status || "").toLowerCase();
  if (!statusValue.includes("complete") && !statusValue.includes("closed") && !statusValue.includes("done")) {
    return NextResponse.json(
      { success: false, error: "Incentives can only be recorded for completed projects" },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.incentiveEntry.create({
      data: {
        employeeId: sanitizeString(parsed.data.employeeId),
        projectRef,
        amount: new Prisma.Decimal(parsed.data.amount),
        status: status === "APPROVED" && canApprove ? "APPROVED" : "PENDING",
        reason: parsed.data.reason ? sanitizeString(parsed.data.reason) : null,
        approvedById: status === "APPROVED" && canApprove ? session.user.id : null,
      },
      include: { employee: true },
    });

    if (entry.status === "APPROVED") {
      const approval = await applyIncentiveApproval(tx, entry, session.user.id);
      return tx.incentiveEntry.update({
        where: { id: entry.id },
        data: {
          expenseId: approval.expenseId,
          walletLedgerId: approval.walletLedgerId,
        },
        include: { employee: true },
      });
    }

    return entry;
  });

  await logAudit({
    action: "CREATE_INCENTIVE",
    entity: "IncentiveEntry",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
